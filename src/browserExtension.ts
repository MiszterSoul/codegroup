import * as vscode from 'vscode';

type WebGroupFile = {
  path: string;
  name: string;
  isDirectory?: boolean;
  tags?: string[];
};

type WebGroup = {
  id: string;
  name: string;
  icon: string;
  color: string;
  files: WebGroupFile[];
  order: number;
  parentId?: string;
  collapsed?: boolean;
  pinned?: boolean;
  shortDescription?: string;
  details?: string;
  tags?: string[];
};

type WebConfig = {
  version: number;
  groups: WebGroup[];
};

type WebTreeNode =
  | { kind: 'action'; id: string; label: string; description: string; icon: string; command: string }
  | { kind: 'group'; group: WebGroup }
  | { kind: 'file'; group: WebGroup; file: WebGroupFile };

const STORAGE_KEY = 'fileGroups';
const CONFIG_PATH = ['.vscode', 'file-groups.json'];

function normalizeTags(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of values) {
    const tag = value.trim().replace(/^#+/, '').replace(/\s+/g, '-').toLowerCase().slice(0, 32);
    if (!tag || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    tags.push(tag);
    if (tags.length === 24) {
      break;
    }
  }
  return tags;
}

function parseTags(value: string): string[] {
  return normalizeTags(value.split(/[,;\n]+/));
}

function formatTags(tags?: readonly string[]): string {
  return normalizeTags(tags ?? []).map(tag => `#${tag}`).join(' ');
}

function createId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function fileName(uri: vscode.Uri): string {
  const parts = uri.path.split('/').filter(Boolean);
  return parts.at(-1) ?? uri.path;
}

class WebGroupStore {
  private groups: WebGroup[] = [];
  private readonly changes = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changes.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  getGroups(): WebGroup[] {
    return this.groups;
  }

  async load(): Promise<void> {
    const stored = this.context.workspaceState.get<WebGroup[]>(STORAGE_KEY, []);
    this.groups = this.normalizeGroups(stored);

    const configUri = this.getConfigUri();
    if (!configUri) {
      return;
    }

    try {
      const content = await vscode.workspace.fs.readFile(configUri);
      const parsed = JSON.parse(new TextDecoder().decode(content)) as WebConfig;
      if (Array.isArray(parsed.groups)) {
        this.groups = this.normalizeGroups(parsed.groups);
        await this.context.workspaceState.update(STORAGE_KEY, this.groups);
      }
    } catch {
      // A workspace without a CodeGroup file starts from workspace state.
    }
  }

  async save(groups: WebGroup[] = this.groups): Promise<void> {
    this.groups = this.normalizeGroups(groups);
    await this.context.workspaceState.update(STORAGE_KEY, this.groups);

    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri;
    const configUri = this.getConfigUri();
    if (workspace && configUri) {
      const directory = vscode.Uri.joinPath(workspace, '.vscode');
      await vscode.workspace.fs.createDirectory(directory);
      await vscode.workspace.fs.writeFile(
        configUri,
        new TextEncoder().encode(JSON.stringify({ version: 2, groups: this.groups }, null, 2))
      );
    }
    this.changes.fire();
  }

  async updateGroup(groupId: string, updates: Partial<WebGroup>): Promise<void> {
    const group = this.groups.find(item => item.id === groupId);
    if (!group) {
      return;
    }
    Object.assign(group, updates);
    await this.save();
  }

  async updateFile(groupId: string, path: string, updates: Partial<WebGroupFile>): Promise<void> {
    const file = this.groups.find(group => group.id === groupId)?.files.find(item => item.path === path);
    if (!file) {
      return;
    }
    Object.assign(file, updates);
    await this.save();
  }

  uriFor(path: string): vscode.Uri | undefined {
    if (/^[a-z][a-z0-9+.-]*:/i.test(path) && !/^[a-z]:[\\/]/i.test(path)) {
      return vscode.Uri.parse(path);
    }

    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!workspace) {
      return undefined;
    }
    return vscode.Uri.joinPath(workspace, ...path.replace(/\\/g, '/').split('/').filter(Boolean));
  }

  relativePath(uri: vscode.Uri): string {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) {
      return uri.toString();
    }
    const base = folder.uri.path.endsWith('/') ? folder.uri.path : `${folder.uri.path}/`;
    return uri.path.startsWith(base) ? decodeURIComponent(uri.path.slice(base.length)) : uri.toString();
  }

  private getConfigUri(): vscode.Uri | undefined {
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri;
    return workspace ? vscode.Uri.joinPath(workspace, ...CONFIG_PATH) : undefined;
  }

  private normalizeGroups(groups: readonly WebGroup[]): WebGroup[] {
    return groups.map((group, index) => ({
      ...group,
      order: group.order ?? index,
      icon: group.icon || 'folder',
      color: group.color || '',
      tags: normalizeTags(group.tags ?? []),
      files: (group.files ?? []).map(file => ({ ...file, tags: normalizeTags(file.tags ?? []) }))
    }));
  }
}

class WebGroupsProvider implements vscode.TreeDataProvider<WebTreeNode> {
  private readonly changes = new vscode.EventEmitter<WebTreeNode | undefined>();
  readonly onDidChangeTreeData = this.changes.event;

  constructor(private readonly store: WebGroupStore) {
    store.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this.changes.fire(undefined);
  }

  getTreeItem(node: WebTreeNode): vscode.TreeItem {
    if (node.kind === 'action') {
      const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
      item.id = `web-action:${node.id}`;
      item.description = node.description;
      item.iconPath = new vscode.ThemeIcon(node.icon);
      item.contextValue = 'action';
      item.command = { command: node.command, title: node.label };
      return item;
    }

    if (node.kind === 'file') {
      const uri = this.store.uriFor(node.file.path);
      const item = new vscode.TreeItem(node.file.name, vscode.TreeItemCollapsibleState.None);
      item.id = `${node.group.id}:file:${node.file.path}`;
      item.contextValue = 'file';
      item.resourceUri = uri;
      item.description = formatTags(node.file.tags);
      if (uri && !node.file.isDirectory) {
        item.command = {
          command: 'fileGroups.openGroupedFile',
          title: 'Open File',
          arguments: [{ groupId: node.group.id, filePath: node.file.path }]
        };
      }
      return item;
    }

    const childCount = this.store.getGroups().filter(group => group.parentId === node.group.id).length;
    const item = new vscode.TreeItem(
      node.group.name,
      node.group.collapsed ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded
    );
    item.id = node.group.id;
    item.contextValue = node.group.pinned ? 'group_pinned' : 'group_unpinned';
    item.iconPath = new vscode.ThemeIcon(node.group.icon || 'folder');
    item.description = [formatTags(node.group.tags), `${node.group.files.length + childCount} items`].filter(Boolean).join(' • ');
    return item;
  }

  getChildren(node?: WebTreeNode): WebTreeNode[] {
    if (!node) {
      const groups = this.store.getGroups()
        .filter(group => !group.parentId)
        .sort((left, right) => Number(right.pinned) - Number(left.pinned) || left.order - right.order)
        .map(group => ({ kind: 'group', group }) as WebTreeNode);
      return [
        ...groups,
        { kind: 'action', id: 'getting-started', label: 'Open Getting Started', description: 'Reopen the CodeGroup guide', icon: 'book', command: 'fileGroups.openGettingStarted' },
        { kind: 'action', id: 'create', label: 'Create Group', description: 'Start a bookmark group', icon: 'add', command: 'fileGroups.createGroup' },
        { kind: 'action', id: 'quick-open', label: 'Quick Open Grouped Files', description: 'Search names, paths, groups, and tags', icon: 'search', command: 'fileGroups.quickOpen' }
      ];
    }

    if (node.kind !== 'group') {
      return [];
    }

    const childGroups = this.store.getGroups()
      .filter(group => group.parentId === node.group.id)
      .sort((left, right) => left.order - right.order)
      .map(group => ({ kind: 'group', group }) as WebTreeNode);
    const files = node.group.files.map(file => ({ kind: 'file', group: node.group, file }) as WebTreeNode);
    return [...childGroups, ...files];
  }
}

async function pickGroup(store: WebGroupStore, placeHolder: string, selected?: WebGroup): Promise<WebGroup | undefined> {
  if (selected) {
    return selected;
  }
  const pick = await vscode.window.showQuickPick(
    store.getGroups().map(group => ({ label: group.name, description: formatTags(group.tags), group })),
    { placeHolder, matchOnDescription: true }
  );
  return pick?.group;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  await vscode.commands.executeCommand('setContext', 'codegroup.web', true);
  const store = new WebGroupStore(context);
  await store.load();
  const provider = new WebGroupsProvider(store);
  context.subscriptions.push(vscode.window.registerTreeDataProvider('fileGroupsView', provider));

  const command = (id: string, handler: (...args: unknown[]) => unknown) => {
    context.subscriptions.push(vscode.commands.registerCommand(id, handler));
  };

  command('fileGroups.openGettingStarted', () => vscode.commands.executeCommand(
    'workbench.action.openWalkthrough',
    `${context.extension.id}#codegroup.gettingStarted`,
    false
  ));

  command('fileGroups.createGroup', async () => {
    const name = await vscode.window.showInputBox({ prompt: 'Name your bookmark group', placeHolder: 'Feature, bugfix, review…' });
    if (!name?.trim()) {
      return;
    }
    await store.save([...store.getGroups(), {
      id: createId(),
      name: name.trim(),
      icon: 'folder',
      color: '',
      files: [],
      order: store.getGroups().length,
      collapsed: false
    }]);
  });

  command('fileGroups.addFile', async (resource?: unknown) => {
    const uri = resource instanceof vscode.Uri ? resource : vscode.window.activeTextEditor?.document.uri;
    if (!uri) {
      return;
    }
    const group = await pickGroup(store, 'Choose a bookmark group');
    if (!group || group.files.some(file => file.path === store.relativePath(uri))) {
      return;
    }
    group.files.push({ path: store.relativePath(uri), name: fileName(uri) });
    await store.save();
  });

  command('fileGroups.quickOpen', async () => {
    const items = store.getGroups().flatMap(group => group.files.filter(file => !file.isDirectory).map(file => ({
      label: file.name,
      description: `${group.name}${formatTags(group.tags) ? ` • ${formatTags(group.tags)}` : ''}`,
      detail: [file.path, formatTags(file.tags)].filter(Boolean).join(' • '),
      group,
      file
    })));
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Search bookmarks by file, group, path, or tag',
      matchOnDescription: true,
      matchOnDetail: true
    });
    const uri = selected ? store.uriFor(selected.file.path) : undefined;
    if (uri) {
      await vscode.commands.executeCommand('vscode.open', uri, { preview: false });
    }
  });

  command('fileGroups.editGroupTags', async (node?: unknown) => {
    const selected = node && typeof node === 'object' && 'kind' in node && node.kind === 'group'
      ? (node as Extract<WebTreeNode, { kind: 'group' }>).group
      : undefined;
    const group = await pickGroup(store, 'Choose a group to tag', selected);
    if (!group) {
      return;
    }
    const value = await vscode.window.showInputBox({
      prompt: `Tags for group "${group.name}"`,
      placeHolder: 'frontend, urgent, review',
      value: group.tags?.join(', ') ?? ''
    });
    if (value !== undefined) {
      await store.updateGroup(group.id, { tags: parseTags(value) });
    }
  });

  command('fileGroups.editFileTags', async (node?: unknown) => {
    type FilePick = { label: string; description: string; group: WebGroup; file: WebGroupFile };
    let selected: FilePick | undefined = node && typeof node === 'object' && 'kind' in node && node.kind === 'file'
      ? {
          label: (node as Extract<WebTreeNode, { kind: 'file' }>).file.name,
          description: (node as Extract<WebTreeNode, { kind: 'file' }>).group.name,
          group: (node as Extract<WebTreeNode, { kind: 'file' }>).group,
          file: (node as Extract<WebTreeNode, { kind: 'file' }>).file
        }
      : undefined;
    if (!selected) {
      selected = await vscode.window.showQuickPick<FilePick>(
        store.getGroups().flatMap(group => group.files.map(file => ({ label: file.name, description: group.name, group, file }))),
        { placeHolder: 'Choose a bookmark to tag' }
      );
    }
    if (!selected) {
      return;
    }
    const value = await vscode.window.showInputBox({
      prompt: `Tags for bookmark "${selected.file.name}"`,
      placeHolder: 'frontend, urgent, review',
      value: selected.file.tags?.join(', ') ?? ''
    });
    if (value !== undefined) {
      await store.updateFile(selected.group.id, selected.file.path, { tags: parseTags(value) });
    }
  });

  const openFiles = async (groupId: string, includeChildren: boolean) => {
    const groupIds = new Set([groupId]);
    if (includeChildren) {
      const pending = [groupId];
      while (pending.length) {
        const parentId = pending.pop()!;
        for (const child of store.getGroups().filter(group => group.parentId === parentId)) {
          if (!groupIds.has(child.id)) {
            groupIds.add(child.id);
            pending.push(child.id);
          }
        }
      }
    }
    for (const file of store.getGroups().filter(group => groupIds.has(group.id)).flatMap(group => group.files)) {
      const uri = !file.isDirectory ? store.uriFor(file.path) : undefined;
      if (uri) {
        await vscode.commands.executeCommand('vscode.open', uri, { preview: false, preserveFocus: true });
      }
    }
  };

  command('fileGroups.openDirect', (node?: unknown) => {
    if (node && typeof node === 'object' && 'kind' in node && node.kind === 'group') {
      return openFiles((node as Extract<WebTreeNode, { kind: 'group' }>).group.id, false);
    }
  });
  command('fileGroups.openAll', (node?: unknown) => {
    if (node && typeof node === 'object' && 'kind' in node && node.kind === 'group') {
      return openFiles((node as Extract<WebTreeNode, { kind: 'group' }>).group.id, true);
    }
  });
  command('fileGroups.openGroupedFile', async (args?: unknown) => {
    const path = args && typeof args === 'object' && 'filePath' in args ? String(args.filePath) : '';
    const uri = store.uriFor(path);
    if (uri) {
      await vscode.commands.executeCommand('vscode.open', uri, { preview: false });
    }
  });
  command('fileGroups.removeFile', async (node?: unknown) => {
    if (!node || typeof node !== 'object' || !('kind' in node) || node.kind !== 'file') {
      return;
    }
    const target = node as Extract<WebTreeNode, { kind: 'file' }>;
    target.group.files = target.group.files.filter(file => file.path !== target.file.path);
    await store.save();
  });
  command('fileGroups.refresh', () => provider.refresh());
  command('fileGroups.openGroupEditor', (node?: unknown) => vscode.commands.executeCommand('fileGroups.editGroupTags', node));

  const webUnavailable = [
    'fileGroups.createGroupFromGitChanges',
    'fileGroups.openGlobalConfig',
    'fileGroups.moveToGlobal',
    'fileGroups.moveToLocal'
  ];
  for (const id of webUnavailable) {
    command(id, () => vscode.window.showInformationMessage('This action requires the desktop or Codespaces workspace extension host.'));
  }
}

export function deactivate(): void {}
