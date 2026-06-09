import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { countLabel, getLocalizedTemplateText, t } from './i18n';
import { FileGroup, GroupFile, GROUP_COLORS, GROUP_ICONS, isHexColor } from './models';
import { FileGroupDecorationProvider } from './fileDecorationProvider';
import { FileGroupsProvider } from './fileGroupsProvider';
import { GROUP_EDITOR_TEMPLATES } from './smartGroups';
import { StorageService } from './storageService';

type StatusLevel = 'info' | 'warning' | 'error';

type GroupEditorStatus = {
  level: StatusLevel;
  text: string;
};

type SavePayload = {
  name: string;
  shortDescription: string;
  details: string;
  icon: string;
  colorId: string;
  customColor: string;
  badgeText: string;
  sortOrder: string;
  pinned: boolean;
  scope: 'local' | 'global';
};

type GroupEditorMessage =
  | { type: 'save'; payload: SavePayload }
  | { type: 'change-language' }
  | { type: 'add-active-file' }
  | { type: 'add-open-editors' }
  | { type: 'pick-files' }
  | { type: 'remove-file'; path: string }
  | { type: 'open-file'; path: string; isDirectory: boolean }
  | { type: 'remove-missing-files' };

const VIEW_TYPE = 'fileGroups.groupEditor';

const SORT_OPTIONS: Array<{ value: string; labelKey: Parameters<typeof t>[0] }> = [
  { value: 'manual', labelKey: 'sort.manual' },
  { value: 'name-asc', labelKey: 'sort.nameAsc' },
  { value: 'name-desc', labelKey: 'sort.nameDesc' },
  { value: 'date-asc', labelKey: 'sort.dateAsc' },
  { value: 'date-desc', labelKey: 'sort.dateDesc' },
  { value: 'type', labelKey: 'sort.type' }
];

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';

  for (let index = 0; index < 32; index += 1) {
    nonce += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return nonce;
}

function escapeHtml(value?: string): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFileName(filePath: string): string {
  return path.basename(filePath);
}

function normalizeText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function dedupeFiles(files: GroupFile[]): GroupFile[] {
  const seen = new Set<string>();

  return files.filter((file) => {
    if (seen.has(file.path)) {
      return false;
    }

    seen.add(file.path);
    return true;
  });
}

function dedupeUris(uris: vscode.Uri[]): vscode.Uri[] {
  const seen = new Set<string>();

  return uris.filter((uri) => {
    if (seen.has(uri.fsPath)) {
      return false;
    }

    seen.add(uri.fsPath);
    return true;
  });
}

async function toGroupFile(uri: vscode.Uri): Promise<GroupFile> {
  let isDirectory = false;

  try {
    const stat = await vscode.workspace.fs.stat(uri);
    isDirectory = (stat.type & vscode.FileType.Directory) !== 0;
  } catch {
    // Fall back to treating the selected resource as a file.
  }

  return {
    path: uri.fsPath,
    name: getFileName(uri.fsPath),
    isDirectory
  };
}

function collectOpenEditorUris(): vscode.Uri[] {
  const uris: vscode.Uri[] = [];

  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      const tabInput = tab.input;
      if (!tabInput || typeof tabInput !== 'object' || !('uri' in tabInput)) {
        continue;
      }

      const uri = (tabInput as { uri: vscode.Uri }).uri;
      if (uri.scheme !== 'file') {
        continue;
      }

      uris.push(uri);
    }
  }

  return dedupeUris(uris);
}

export class GroupEditorPanel {
  private static readonly panels = new Map<string, GroupEditorPanel>();

  static refreshAll(): void {
    for (const panel of GroupEditorPanel.panels.values()) {
      void panel.render();
    }
  }

  static show(
    context: vscode.ExtensionContext,
    storageService: StorageService,
    provider: FileGroupsProvider,
    decorationProvider: FileGroupDecorationProvider,
    groupId: string
  ): void {
    const existingPanel = GroupEditorPanel.panels.get(groupId);
    if (existingPanel) {
      existingPanel.panel.reveal(vscode.ViewColumn.Active);
      void existingPanel.render();
      return;
    }

    const group = storageService.getGroup(groupId);
    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      group ? t('editor.titleWithName', { name: group.name }) : t('editor.title'),
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    void context;
    const groupEditorPanel = new GroupEditorPanel(panel, storageService, provider, decorationProvider, groupId);
    GroupEditorPanel.panels.set(groupId, groupEditorPanel);
  }

  private readonly disposables: vscode.Disposable[] = [];
  private lastStatus?: GroupEditorStatus;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly storageService: StorageService,
    private readonly provider: FileGroupsProvider,
    private readonly decorationProvider: FileGroupDecorationProvider,
    private readonly groupId: string
  ) {
    this.disposables.push(
      this.panel.onDidDispose(() => this.dispose()),
      this.panel.webview.onDidReceiveMessage((message: GroupEditorMessage) => {
        void this.handleMessage(message);
      })
    );

    void this.render();
  }

  private dispose(): void {
    GroupEditorPanel.panels.delete(this.groupId);

    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      disposable?.dispose();
    }
  }

  private async handleMessage(message: GroupEditorMessage): Promise<void> {
    switch (message.type) {
      case 'save':
        await this.save(message.payload);
        break;
      case 'change-language':
        await vscode.commands.executeCommand('fileGroups.changeLanguage');
        break;
      case 'add-active-file':
        await this.addActiveFile();
        break;
      case 'add-open-editors':
        await this.addOpenEditors();
        break;
      case 'pick-files':
        await this.pickFiles();
        break;
      case 'remove-file':
        await this.removeFile(message.path);
        break;
      case 'open-file':
        await this.openFile(message.path, message.isDirectory);
        break;
      case 'remove-missing-files':
        await this.removeMissingFiles();
        break;
    }
  }

  private async save(payload: SavePayload): Promise<void> {
    const group = this.storageService.getGroup(this.groupId);
    if (!group) {
      this.notify('error', t('editor.status.groupMissing'));
      return;
    }

    const name = payload.name.trim();
    if (name.length === 0) {
      this.notify('error', t('editor.status.nameRequired'));
      return;
    }

    const badgeText = payload.badgeText.trim();
    if (badgeText.length > 2) {
      this.notify('error', t('editor.status.badgeTooLong'));
      return;
    }

    const resolvedColor = this.resolveColor(payload.colorId, payload.customColor, group.color);
    if (resolvedColor === undefined) {
      this.notify('error', t('editor.status.invalidHex'));
      return;
    }

    const fileUris = this.getAllGroupUris(group.id);
    const targetIsGlobal = payload.scope === 'global';
    const scopeChanged = targetIsGlobal !== Boolean(group.isGlobal);

    if (scopeChanged) {
      await this.storageService.updateGroupRecursive(group.id, { isGlobal: targetIsGlobal });

      if (group.parentId) {
        await this.storageService.updateGroup(group.id, { parentId: undefined });
      }
    }

    const sortOrder = SORT_OPTIONS.some((option) => option.value === payload.sortOrder)
      ? payload.sortOrder
      : 'manual';

    await this.storageService.updateGroup(group.id, {
      name,
      shortDescription: normalizeText(payload.shortDescription),
      details: normalizeText(payload.details),
      icon: payload.icon,
      color: resolvedColor,
      badgeText: badgeText.length > 0 ? badgeText : undefined,
      sortOrder,
      pinned: payload.pinned
    });

    this.provider.refresh();
    this.decorationProvider.refresh(fileUris);

    this.lastStatus = {
      level: 'info',
      text: scopeChanged && group.parentId
        ? t('editor.status.savedScopeMoved')
        : t('editor.status.saved')
    };

    await this.render();
  }

  private async addActiveFile(): Promise<void> {
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    if (!activeUri || activeUri.scheme !== 'file') {
      this.notify('warning', t('editor.status.noActiveFile'));
      return;
    }

    await this.addFiles([await toGroupFile(activeUri)], t('editor.status.addedActive'));
  }

  private async addOpenEditors(): Promise<void> {
    const editorUris = collectOpenEditorUris();
    if (editorUris.length === 0) {
      this.notify('warning', t('editor.status.noOpenEditors'));
      return;
    }

    const files = await Promise.all(editorUris.map((uri) => toGroupFile(uri)));
    await this.addFiles(files, t('editor.status.addedOpenEditors'));
  }

  private async pickFiles(): Promise<void> {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    const selectedUris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: true,
      canSelectMany: true,
      defaultUri: workspaceUri,
      openLabel: t('editor.openLabel.addToGroup')
    });

    if (!selectedUris || selectedUris.length === 0) {
      return;
    }

    const files = await Promise.all(selectedUris.map((uri) => toGroupFile(uri)));
    await this.addFiles(files, t('editor.status.addedSelected'));
  }

  private async addFiles(files: GroupFile[], successMessage: string): Promise<void> {
    const group = this.storageService.getGroup(this.groupId);
    if (!group) {
      this.notify('error', t('editor.status.groupMissing'));
      return;
    }

    const uniqueFiles = dedupeFiles(files);
    const addedCount = await this.storageService.addFilesToGroup(group.id, uniqueFiles);
    if (addedCount === 0) {
      this.notify('info', t('editor.status.noNewFiles'));
      return;
    }

    this.provider.refresh();
    this.decorationProvider.refresh(uniqueFiles.map((file) => vscode.Uri.file(file.path)));
    this.lastStatus = {
      level: 'info',
      text: addedCount === 1 ? successMessage : `${successMessage} (${addedCount} items)`
    };
    await this.render();
  }

  private async removeFile(filePath: string): Promise<void> {
    const group = this.storageService.getGroup(this.groupId);
    if (!group) {
      this.notify('error', t('editor.status.groupMissing'));
      return;
    }

    await this.storageService.removeFileFromGroup(group.id, filePath);
    this.provider.refresh();
    this.decorationProvider.refresh([vscode.Uri.file(filePath)]);
    this.lastStatus = {
      level: 'info',
      text: t('editor.status.removedFile', { name: getFileName(filePath) })
    };
    await this.render();
  }

  private async removeMissingFiles(): Promise<void> {
    const group = this.storageService.getGroup(this.groupId);
    if (!group) {
      this.notify('error', t('editor.status.groupMissing'));
      return;
    }

    const missingFiles = group.files.filter((file) => !fileExists(file.path));
    if (missingFiles.length === 0) {
      this.notify('info', t('editor.status.noMissingFiles'));
      return;
    }

    await this.storageService.updateGroup(group.id, {
      files: group.files.filter((file) => fileExists(file.path))
    });

    this.provider.refresh();
    this.decorationProvider.refresh(missingFiles.map((file) => vscode.Uri.file(file.path)));
    this.lastStatus = {
      level: 'info',
      text: t('editor.status.removedMissing', {
        count: missingFiles.length,
        itemLabel: missingFiles.length === 1 ? t('noun.item.one') : t('noun.item.other')
      })
    };
    await this.render();
  }

  private async openFile(filePath: string, isDirectory: boolean): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    if (!fileExists(filePath)) {
      this.notify('warning', t('editor.status.fileMissingOnDisk'));
      return;
    }

    if (isDirectory) {
      await vscode.commands.executeCommand('revealInExplorer', uri);
      return;
    }

    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, { preview: false });
  }

  private resolveColor(colorId: string, customColor: string, currentColor: string): string | undefined {
    if (colorId === 'custom' || isHexColor(currentColor)) {
      const trimmed = customColor.trim().toUpperCase();
      return /^#[0-9A-F]{6}$/.test(trimmed) ? trimmed : undefined;
    }

    return colorId;
  }

  private getAllGroupUris(groupId: string): vscode.Uri[] {
    return this.storageService.getAllFilesInGroup(groupId).map((file) => vscode.Uri.file(file.path));
  }

  private notify(level: StatusLevel, text: string): void {
    void this.panel.webview.postMessage({ type: 'status', level, text });
  }

  private async render(): Promise<void> {
    const group = this.storageService.getGroup(this.groupId);
    if (!group) {
      this.panel.title = t('editor.title');
      this.panel.webview.html = this.getMissingGroupHtml();
      return;
    }

    this.panel.title = t('editor.titleWithName', { name: group.name });
    this.panel.webview.html = this.getHtml(group);
  }

  private getMissingGroupHtml(): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(t('editor.title'))}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 32px;
        }

        .empty {
            max-width: 520px;
            margin: 48px auto;
            padding: 24px;
            border-radius: 16px;
            background: linear-gradient(135deg, var(--vscode-sideBar-background), var(--vscode-editorWidget-background));
            border: 1px solid var(--vscode-widget-border);
        }

        h1 {
            margin-top: 0;
        }
    </style>
</head>
<body>
    <div class="empty">
    <h1>${escapeHtml(t('editor.missing.title'))}</h1>
    <p>${escapeHtml(t('editor.missing.body'))}</p>
    </div>
</body>
</html>`;
  }

  private getHtml(group: FileGroup): string {
    const nonce = getNonce();
    const directFiles = group.files;
    const childGroups = this.storageService.getSubgroups(group.id);
    const selectedColor = isHexColor(group.color) ? 'custom' : group.color;
    const customColor = isHexColor(group.color) ? group.color : '#';
    const missingFiles = directFiles.filter((file) => !fileExists(file.path)).length;
    const status = this.lastStatus;
    const scopeHint = group.parentId
      ? t('editor.scope.hint.nested')
      : t('editor.scope.hint.root');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(t('editor.title'))}</title>
    <style>
        :root {
            color-scheme: light dark;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 24px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            background:
                radial-gradient(circle at top right, color-mix(in srgb, var(--vscode-focusBorder) 20%, transparent) 0, transparent 36%),
                linear-gradient(180deg, var(--vscode-editor-background), color-mix(in srgb, var(--vscode-sideBar-background) 80%, var(--vscode-editor-background)) 100%);
        }

        .shell {
            display: grid;
            gap: 20px;
        }

        .hero {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-start;
            padding: 20px 22px;
            border-radius: 18px;
            background: linear-gradient(135deg, color-mix(in srgb, var(--vscode-button-background) 18%, transparent), color-mix(in srgb, var(--vscode-sideBar-background) 92%, transparent));
            border: 1px solid color-mix(in srgb, var(--vscode-focusBorder) 35%, transparent);
        }

        .hero h1 {
            margin: 0 0 8px;
            font-size: 24px;
        }

        .hero p {
            margin: 0;
            color: var(--vscode-descriptionForeground);
            max-width: 720px;
            line-height: 1.5;
        }

        .hero button {
            white-space: nowrap;
        }

        .hero-actions {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }

        .status {
            display: ${status ? 'block' : 'none'};
            padding: 12px 14px;
            border-radius: 12px;
            font-size: 13px;
            line-height: 1.5;
        }

        .status.info {
            background: color-mix(in srgb, var(--vscode-terminal-ansiBlue) 12%, transparent);
            border: 1px solid color-mix(in srgb, var(--vscode-terminal-ansiBlue) 35%, transparent);
        }

        .status.warning {
            background: color-mix(in srgb, var(--vscode-terminal-ansiYellow) 18%, transparent);
            border: 1px solid color-mix(in srgb, var(--vscode-terminal-ansiYellow) 35%, transparent);
        }

        .status.error {
            background: color-mix(in srgb, var(--vscode-errorForeground) 16%, transparent);
            border: 1px solid color-mix(in srgb, var(--vscode-errorForeground) 35%, transparent);
        }

        .hidden {
            display: none;
        }

        .grid {
            display: grid;
            grid-template-columns: minmax(320px, 1.2fr) minmax(300px, 1fr);
            gap: 20px;
        }

        .card {
            padding: 18px;
            border-radius: 16px;
            border: 1px solid var(--vscode-widget-border);
            background: color-mix(in srgb, var(--vscode-editorWidget-background) 85%, transparent);
            box-shadow: 0 8px 30px color-mix(in srgb, var(--vscode-editor-background) 60%, transparent);
        }

        .card h2 {
            margin: 0 0 14px;
            font-size: 14px;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
        }

        .form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
        }

        .field {
            display: grid;
            gap: 8px;
        }

        .field.full {
            grid-column: 1 / -1;
        }

        label {
            font-size: 12px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            letter-spacing: 0.03em;
            text-transform: uppercase;
        }

        input,
        textarea,
        select,
        button {
            font: inherit;
        }

        input,
        textarea,
        select {
            width: 100%;
            padding: 10px 12px;
            border-radius: 10px;
            color: var(--vscode-input-foreground);
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
        }

        input:focus,
        textarea:focus,
        select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }

        textarea {
            min-height: 128px;
            resize: vertical;
        }

        .toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 12px 14px;
            border-radius: 12px;
            background: color-mix(in srgb, var(--vscode-sideBar-background) 80%, transparent);
            border: 1px solid color-mix(in srgb, var(--vscode-widget-border) 80%, transparent);
        }

        .toggle-row input {
            width: auto;
            margin: 0;
        }

        .meta {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 16px;
        }

        .meta-item {
            padding: 12px;
            border-radius: 12px;
            background: color-mix(in srgb, var(--vscode-editor-background) 55%, var(--vscode-sideBar-background));
            border: 1px solid color-mix(in srgb, var(--vscode-widget-border) 70%, transparent);
        }

        .meta-item .label {
            display: block;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin-bottom: 6px;
        }

        .meta-item .value {
            font-size: 13px;
            line-height: 1.4;
        }

        .hint {
            margin-top: 8px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 16px;
        }

        .template-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
          margin-bottom: 18px;
        }

        .template-button {
          padding: 14px 12px;
          border-radius: 14px;
          border: 1px solid color-mix(in srgb, var(--vscode-widget-border) 80%, transparent);
          background: color-mix(in srgb, var(--vscode-editor-background) 56%, var(--vscode-sideBar-background));
          text-align: left;
        }

        .template-button strong {
          display: block;
          margin-bottom: 4px;
        }

        .template-button span {
          display: block;
          font-size: 12px;
          line-height: 1.45;
          color: var(--vscode-descriptionForeground);
        }

        .template-kicker {
          margin: 0 0 10px;
          font-size: 12px;
          color: var(--vscode-descriptionForeground);
        }

        button {
            border: 0;
            border-radius: 10px;
            padding: 9px 14px;
            cursor: pointer;
            transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
        }

        button:hover {
            transform: translateY(-1px);
        }

        .primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .ghost {
            background: color-mix(in srgb, var(--vscode-editor-background) 58%, var(--vscode-sideBar-background));
            color: var(--vscode-editor-foreground);
            border: 1px solid color-mix(in srgb, var(--vscode-widget-border) 85%, transparent);
        }

        .danger {
            background: color-mix(in srgb, var(--vscode-errorForeground) 18%, transparent);
            color: var(--vscode-editor-foreground);
            border: 1px solid color-mix(in srgb, var(--vscode-errorForeground) 40%, transparent);
        }

        .file-list {
            display: grid;
            gap: 10px;
            max-height: 520px;
            overflow: auto;
            padding-right: 4px;
        }

        .file-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            border-radius: 12px;
            background: color-mix(in srgb, var(--vscode-editor-background) 55%, var(--vscode-sideBar-background));
            border: 1px solid color-mix(in srgb, var(--vscode-widget-border) 70%, transparent);
        }

        .file-main {
            min-width: 0;
        }

        .file-name {
            font-weight: 600;
            margin-bottom: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .file-path {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            word-break: break-all;
        }

        .file-badges {
            display: flex;
            gap: 8px;
            margin-top: 8px;
            flex-wrap: wrap;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            padding: 4px 8px;
            border-radius: 999px;
            font-size: 11px;
            background: color-mix(in srgb, var(--vscode-badge-background) 70%, transparent);
            color: var(--vscode-badge-foreground);
        }

        .file-actions {
            display: flex;
            flex-direction: column;
            gap: 8px;
            align-items: flex-end;
        }

        .empty-state {
            padding: 18px;
            border-radius: 14px;
            border: 1px dashed color-mix(in srgb, var(--vscode-widget-border) 90%, transparent);
            color: var(--vscode-descriptionForeground);
        }

        .footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 4px;
        }

        @media (max-width: 980px) {
            .grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="shell">
        <section class="hero">
            <div>
            <h1>${escapeHtml(t('editor.hero.title'))}</h1>
            <p>${escapeHtml(t('editor.hero.body', { name: group.name }))}</p>
            </div>
          <div class="hero-actions">
            <button type="button" class="ghost" data-action="change-language">${escapeHtml(t('action.changeLanguage'))}</button>
            <button type="submit" form="editor-form" class="primary">${escapeHtml(t('action.saveChanges'))}</button>
          </div>
        </section>

        <div id="status" class="status ${status?.level ?? 'info'}" ${status ? '' : 'hidden'}>${escapeHtml(status?.text)}</div>

        <div class="grid">
            <section class="card">
                <h2>${escapeHtml(t('editor.settings.title'))}</h2>
              <p class="template-kicker">${escapeHtml(t('editor.template.kicker'))}</p>
              <div class="template-grid">
                ${GROUP_EDITOR_TEMPLATES.map((template) => `<button
                  class="template-button"
                  type="button"
                  data-action="apply-template"
                  data-template-icon="${escapeHtml(template.icon)}"
                  data-template-color="${escapeHtml(template.color)}"
                  data-template-badge="${escapeHtml(template.badgeText)}"
                    data-template-summary="${escapeHtml(getLocalizedTemplateText(template.id).summary)}"
                >
                    <strong>${escapeHtml(getLocalizedTemplateText(template.id).label)}</strong>
                    <span>${escapeHtml(getLocalizedTemplateText(template.id).summary)}</span>
                </button>`).join('')}
              </div>
                <form id="editor-form">
                    <div class="form-grid">
                        <div class="field full">
                        <label for="name">${escapeHtml(t('editor.name.label'))}</label>
                            <input id="name" name="name" type="text" value="${escapeHtml(group.name)}" maxlength="120" required>
                        </div>

                        <div class="field full">
                        <label for="shortDescription">${escapeHtml(t('editor.summary.label'))}</label>
                        <input id="shortDescription" name="shortDescription" type="text" value="${escapeHtml(group.shortDescription)}" maxlength="160" placeholder="${escapeHtml(t('editor.summary.placeholder'))}">
                        </div>

                        <div class="field">
                        <label for="icon">${escapeHtml(t('editor.icon.label'))}</label>
                            <select id="icon" name="icon">
                                ${GROUP_ICONS.map((icon) => `<option value="${escapeHtml(icon.id)}" ${icon.id === group.icon ? 'selected' : ''}>${escapeHtml(icon.label)}</option>`).join('')}
                            </select>
                        </div>

                        <div class="field">
                        <label for="colorId">${escapeHtml(t('editor.color.label'))}</label>
                            <select id="colorId" name="colorId">
                                ${GROUP_COLORS.map((color) => `<option value="${escapeHtml(color.id)}" ${color.id === selectedColor ? 'selected' : ''}>${escapeHtml(color.label)}</option>`).join('')}
                            </select>
                        </div>

                        <div id="custom-color-row" class="field ${selectedColor === 'custom' ? '' : 'hidden'}">
                        <label for="customColor">${escapeHtml(t('editor.customColor.label'))}</label>
                            <input id="customColor" name="customColor" type="text" value="${escapeHtml(customColor)}" placeholder="#FF5733" spellcheck="false">
                        </div>

                        <div class="field">
                        <label for="badgeText">${escapeHtml(t('editor.badge.label'))}</label>
                            <input id="badgeText" name="badgeText" type="text" value="${escapeHtml(group.badgeText)}" maxlength="2" placeholder="UI">
                        </div>

                        <div class="field">
                        <label for="sortOrder">${escapeHtml(t('editor.sort.label'))}</label>
                            <select id="sortOrder" name="sortOrder">
                          ${SORT_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === (group.sortOrder ?? 'manual') ? 'selected' : ''}>${escapeHtml(t(option.labelKey))}</option>`).join('')}
                            </select>
                        </div>

                        <div class="field full">
                        <label for="details">${escapeHtml(t('editor.details.label'))}</label>
                        <textarea id="details" name="details" placeholder="${escapeHtml(t('editor.details.placeholder'))}">${escapeHtml(group.details)}</textarea>
                        </div>

                        <div class="field">
                        <label for="scope">${escapeHtml(t('editor.scope.label'))}</label>
                            <select id="scope" name="scope">
                          <option value="local" ${group.isGlobal ? '' : 'selected'}>${escapeHtml(t('editor.scope.local'))}</option>
                          <option value="global" ${group.isGlobal ? 'selected' : ''}>${escapeHtml(t('editor.scope.global'))}</option>
                            </select>
                            <div class="hint">${escapeHtml(scopeHint)}</div>
                        </div>

                        <div class="field">
                        <label>${escapeHtml(t('editor.options.label'))}</label>
                            <div class="toggle-row">
                                <div>
                            <strong>${escapeHtml(t('editor.pin.title'))}</strong>
                            <div class="hint">${escapeHtml(t('editor.pin.hint'))}</div>
                                </div>
                                <input id="pinned" name="pinned" type="checkbox" ${group.pinned ? 'checked' : ''}>
                            </div>
                        </div>
                    </div>

                    <div class="footer">
                      <button type="submit" class="primary">${escapeHtml(t('action.saveChanges'))}</button>
                    </div>
                </form>
            </section>

            <section class="card">
                  <h2>${escapeHtml(t('editor.membership.title'))}</h2>

                <div class="meta">
                    <div class="meta-item">
                      <span class="label">${escapeHtml(t('editor.meta.storage'))}</span>
                      <span class="value">${group.isGlobal ? escapeHtml(t('editor.scope.global')) : escapeHtml(t('editor.scope.local'))}</span>
                    </div>
                    <div class="meta-item">
                      <span class="label">${escapeHtml(t('editor.meta.directItems'))}</span>
                        <span class="value">${directFiles.length}</span>
                    </div>
                    <div class="meta-item">
                      <span class="label">${escapeHtml(t('editor.meta.childGroups'))}</span>
                        <span class="value">${childGroups.length}</span>
                    </div>
                    <div class="meta-item">
                      <span class="label">${escapeHtml(t('editor.meta.missingFiles'))}</span>
                        <span class="value">${missingFiles}</span>
                    </div>
                </div>

                <div class="actions">
                    <button class="secondary" type="button" data-action="add-active-file">${escapeHtml(t('editor.actions.addActive'))}</button>
                    <button class="secondary" type="button" data-action="add-open-editors">${escapeHtml(t('editor.actions.addOpenEditors'))}</button>
                    <button class="ghost" type="button" data-action="pick-files">${escapeHtml(t('editor.actions.pickFiles'))}</button>
                    <button class="danger" type="button" data-action="remove-missing-files">${escapeHtml(t('editor.actions.removeMissing'))}</button>
                </div>

                <div class="file-list">
                    ${directFiles.length === 0 ? `<div class="empty-state">${escapeHtml(t('editor.emptyState'))}</div>` : directFiles.map((file) => {
      const exists = fileExists(file.path);
      const parentDirectory = path.dirname(file.path);
      const badges: string[] = [];

      if (file.isDirectory) {
        badges.push(`<span class="badge">${escapeHtml(t('editor.badge.folder'))}</span>`);
      }

      if (!exists) {
        badges.push(`<span class="badge">${escapeHtml(t('editor.badge.missing'))}</span>`);
      }

      return `<div class="file-row">
                            <div class="file-main">
                                <div class="file-name">${escapeHtml(file.name)}</div>
                                <div class="file-path">${escapeHtml(parentDirectory)}</div>
                                <div class="file-badges">${badges.join('')}</div>
                            </div>
                            <div class="file-actions">
                              <button class="ghost" type="button" data-action="open-file" data-path="${escapeHtml(file.path)}" data-directory="${file.isDirectory ? 'true' : 'false'}" ${exists ? '' : 'disabled'}>${escapeHtml(t('action.open'))}</button>
                              <button class="danger" type="button" data-action="remove-file" data-path="${escapeHtml(file.path)}">${escapeHtml(t('action.remove'))}</button>
                            </div>
                        </div>`;
    }).join('')}
                </div>
            </section>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const form = document.getElementById('editor-form');
        const colorSelect = document.getElementById('colorId');
        const customColorRow = document.getElementById('custom-color-row');
        const statusElement = document.getElementById('status');

        function syncCustomColorVisibility() {
            customColorRow.hidden = colorSelect.value !== 'custom';
        }

        function setStatus(level, text) {
            if (!text) {
                statusElement.hidden = true;
                statusElement.textContent = '';
                return;
            }

            statusElement.hidden = false;
            statusElement.className = 'status ' + level;
            statusElement.textContent = text;
        }

        colorSelect.addEventListener('change', syncCustomColorVisibility);
        syncCustomColorVisibility();

        form.addEventListener('submit', (event) => {
            event.preventDefault();

            const formData = new FormData(form);
            vscode.postMessage({
                type: 'save',
                payload: {
                    name: String(formData.get('name') || ''),
                    shortDescription: String(formData.get('shortDescription') || ''),
                    details: String(formData.get('details') || ''),
                    icon: String(formData.get('icon') || 'folder'),
                    colorId: String(formData.get('colorId') || ''),
                    customColor: String(formData.get('customColor') || ''),
                    badgeText: String(formData.get('badgeText') || ''),
                    sortOrder: String(formData.get('sortOrder') || 'manual'),
                    pinned: formData.get('pinned') === 'on',
                    scope: String(formData.get('scope') || 'local')
                }
            });
        });

        document.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }

            const button = target.closest('button[data-action]');
            if (!(button instanceof HTMLButtonElement)) {
                return;
            }

            const action = button.dataset.action;
            if (!action) {
                return;
            }

            switch (action) {
              case 'change-language':
                vscode.postMessage({ type: 'change-language' });
                return;
              case 'apply-template':
                const iconValue = button.dataset.templateIcon || 'folder';
                const colorValue = button.dataset.templateColor || '';
                const badgeValue = button.dataset.templateBadge || '';
                const summaryValue = button.dataset.templateSummary || '';

                const iconField = document.getElementById('icon');
                const colorField = document.getElementById('colorId');
                const badgeField = document.getElementById('badgeText');
                const summaryField = document.getElementById('shortDescription');
                const customColorField = document.getElementById('customColor');

                if (iconField instanceof HTMLSelectElement) {
                  iconField.value = iconValue;
                }
                if (colorField instanceof HTMLSelectElement) {
                  colorField.value = colorValue;
                }
                if (badgeField instanceof HTMLInputElement) {
                  badgeField.value = badgeValue;
                }
                if (summaryField instanceof HTMLInputElement) {
                  summaryField.value = summaryValue;
                }
                if (customColorField instanceof HTMLInputElement) {
                  customColorField.value = '#';
                }

                syncCustomColorVisibility();
                setStatus('info', ${JSON.stringify(t('editor.status.presetApplied'))});
                return;
                case 'add-active-file':
                case 'add-open-editors':
                case 'pick-files':
                case 'remove-missing-files':
                    vscode.postMessage({ type: action });
                    return;
                case 'remove-file':
                    vscode.postMessage({ type: 'remove-file', path: button.dataset.path || '' });
                    return;
                case 'open-file':
                    vscode.postMessage({
                        type: 'open-file',
                        path: button.dataset.path || '',
                        isDirectory: button.dataset.directory === 'true'
                    });
                    return;
            }
        });

        window.addEventListener('message', (event) => {
            const message = event.data;
            if (!message || message.type !== 'status') {
                return;
            }

            setStatus(message.level, message.text);
        });
    </script>
</body>
</html>`;
  }
}