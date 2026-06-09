import { execFile } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileGroup, FileGroupTreeItem, GroupFile, GROUP_ICONS, GROUP_COLORS, generateId, isHexColor } from './models';
import { CURRENT_USERNAME } from './userInfo';
import { StorageService } from './storageService';
import { FileGroupsProvider, FileGroupsDragDropController } from './fileGroupsProvider';
import { FileGroupDecorationProvider } from './fileDecorationProvider';
import { GroupEditorPanel } from './groupEditorPanel';
import { CODEGROUP_LANGUAGE_CONFIGURATION_KEY, countLabel, getLanguageLabel, getLanguageOptions, getLocalizedSmartGroupText, normalizeCodeGroupLanguage, t } from './i18n';
import { buildGroupedFileQuickOpenSections, makeRecentGroupFileKey, normalizeRecentGroupFileKeys } from './quickOpen';
import { buildSharedGroupPayload, importSharedGroupPayload, isSharedGroupPayload } from './sharedGroups';
import { SmartGroupSuggestion, suggestSmartGroups } from './smartGroups';

let storageService: StorageService;
let fileGroupsProvider: FileGroupsProvider;
let fileDecorationProvider: FileGroupDecorationProvider;
let treeView: vscode.TreeView<FileGroupTreeItem>;

const RECENT_GROUP_FILES_STORAGE_KEY = 'recentGroupFiles';
const SMART_GROUP_FILE_LIMIT = 4000;

type PresetGroupOptions = {
    defaultName: string;
    prompt: string;
    emptyMessage: string;
    files: GroupFile[];
    icon: string;
    color: string;
    shortDescription: string;
};

function getFileName(filePath: string): string {
    return path.basename(filePath);
}

function getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function createFileGroupEntry(filePath: string): GroupFile {
    return {
        path: filePath,
        name: getFileName(filePath),
        isDirectory: false
    };
}

function dedupeGroupFiles(files: GroupFile[]): GroupFile[] {
    const seen = new Set<string>();

    return files.filter((file) => {
        if (seen.has(file.path)) {
            return false;
        }

        seen.add(file.path);
        return true;
    });
}

function getRecentGroupFileKeys(context: vscode.ExtensionContext): string[] {
    const recentKeys = context.workspaceState.get<string[]>(RECENT_GROUP_FILES_STORAGE_KEY, []);
    return normalizeRecentGroupFileKeys(recentKeys);
}

async function rememberRecentGroupFile(context: vscode.ExtensionContext, groupId: string, filePath: string): Promise<void> {
    const recentKeys = getRecentGroupFileKeys(context);
    const nextKeys = normalizeRecentGroupFileKeys([
        makeRecentGroupFileKey(groupId, filePath),
        ...recentKeys
    ]);

    await context.workspaceState.update(RECENT_GROUP_FILES_STORAGE_KEY, nextKeys);
}

async function openGroupedFile(
    context: vscode.ExtensionContext,
    groupId: string,
    filePath: string,
    options?: vscode.TextDocumentShowOptions
): Promise<void> {
    const fileUri = vscode.Uri.file(filePath);

    try {
        await vscode.workspace.fs.stat(fileUri);
    } catch {
        const selection = await vscode.window.showWarningMessage(
            t('groupedFile.missing.prompt'),
            t('action.cleanUp')
        );

        if (selection === t('action.cleanUp')) {
            await vscode.commands.executeCommand('fileGroups.cleanupMissingFiles');
        }
        return;
    }

    await vscode.commands.executeCommand('vscode.open', fileUri, options);
    await rememberRecentGroupFile(context, groupId, filePath);
}

function getAllStoredGroups(): FileGroup[] {
    const localGroups = storageService.getGroups().filter((group) => !group.isGlobal);
    return [...storageService.getGlobalGroups(), ...localGroups];
}

function makeUniqueGroupName(existingNames: Set<string>, baseName: string): string {
    let candidate = baseName;
    let suffix = 2;

    while (existingNames.has(candidate.toLowerCase())) {
        candidate = `${baseName} (${suffix})`;
        suffix += 1;
    }

    existingNames.add(candidate.toLowerCase());
    return candidate;
}

async function collectWorkspaceFilesForSmartGroups(): Promise<GroupFile[]> {
    const uris = await vscode.workspace.findFiles(
        '**/*',
        '**/{node_modules,.git,out,dist,build,.next,coverage,.turbo,.vscode}/**',
        SMART_GROUP_FILE_LIMIT
    );

    return dedupeGroupFiles(
        uris.map((uri) => ({
            path: uri.fsPath,
            name: getFileName(uri.fsPath),
            isDirectory: false
        }))
    );
}

async function createSuggestedGroups(suggestions: readonly SmartGroupSuggestion[]): Promise<FileGroup[]> {
    const existingGroups = getAllStoredGroups();
    const existingNames = new Set(existingGroups.map((group) => group.name.toLowerCase()));
    const nextGroups = [...existingGroups];
    const createdGroups: FileGroup[] = [];

    for (const suggestion of suggestions) {
        const newGroup: FileGroup = {
            id: generateId(),
            name: makeUniqueGroupName(existingNames, suggestion.name),
            icon: suggestion.icon,
            color: suggestion.color,
            shortDescription: suggestion.shortDescription,
            files: dedupeGroupFiles(suggestion.files),
            order: nextGroups.length,
            parentId: undefined,
            createdBy: CURRENT_USERNAME,
            collapsed: false
        };

        nextGroups.push(newGroup);
        createdGroups.push(newGroup);
    }

    if (createdGroups.length === 0) {
        return [];
    }

    await storageService.saveGroups(nextGroups);
    fileGroupsProvider.refresh();
    fileDecorationProvider.refresh(createdGroups.flatMap((group) => group.files.map((file) => vscode.Uri.file(file.path))));
    return createdGroups;
}

function isWithinWorkspace(filePath: string, workspaceRoot: string): boolean {
    const relativePath = path.relative(workspaceRoot, filePath);
    return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function collectOpenEditorFiles(): GroupFile[] {
    const files: GroupFile[] = [];

    for (const tabGroup of vscode.window.tabGroups.all) {
        for (const tab of tabGroup.tabs) {
            const tabInput = tab.input;
            if (!tabInput || typeof tabInput !== 'object' || !('uri' in tabInput)) {
                continue;
            }

            const tabUri = (tabInput as { uri: vscode.Uri }).uri;
            if (tabUri.scheme !== 'file') {
                continue;
            }

            files.push(createFileGroupEntry(tabUri.fsPath));
        }
    }

    return dedupeGroupFiles(files);
}

function runGitCommand(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile('git', args, { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(stdout);
        });
    });
}

async function readNullSeparatedGitPaths(args: string[], cwd: string): Promise<string[]> {
    const stdout = await runGitCommand(args, cwd);
    return stdout
        .split('\0')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

async function collectGitChangedFiles(): Promise<GroupFile[] | undefined> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return [];
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;

    let repositoryRoot: string;
    try {
        repositoryRoot = (await runGitCommand(['rev-parse', '--show-toplevel'], workspaceRoot)).trim();
    } catch {
        return undefined;
    }

    let diffPaths: string[];
    try {
        diffPaths = await readNullSeparatedGitPaths(['diff', '--name-only', '--diff-filter=ACMR', '-z', 'HEAD', '--'], repositoryRoot);
    } catch {
        const [stagedPaths, unstagedPaths] = await Promise.all([
            readNullSeparatedGitPaths(['diff', '--name-only', '--diff-filter=ACMR', '-z', '--cached', '--'], repositoryRoot).catch(() => []),
            readNullSeparatedGitPaths(['diff', '--name-only', '--diff-filter=ACMR', '-z', '--'], repositoryRoot).catch(() => [])
        ]);
        diffPaths = [...stagedPaths, ...unstagedPaths];
    }

    const untrackedPaths = await readNullSeparatedGitPaths(['ls-files', '--others', '--exclude-standard', '-z', '--'], repositoryRoot).catch(() => []);
    const allPaths = [...new Set([...diffPaths, ...untrackedPaths])];

    return dedupeGroupFiles(
        allPaths
            .map((relativePath) => path.resolve(repositoryRoot, relativePath))
            .filter((filePath) => isWithinWorkspace(filePath, workspaceRoot))
            .map((filePath) => createFileGroupEntry(filePath))
    );
}

async function createPresetGroup(options: PresetGroupOptions): Promise<void> {
    const files = dedupeGroupFiles(options.files);
    if (files.length === 0) {
        void vscode.window.showInformationMessage(options.emptyMessage);
        return;
    }

    const name = await vscode.window.showInputBox({
        prompt: options.prompt,
        value: options.defaultName,
        ignoreFocusOut: true
    });

    if (!name || name.trim().length === 0) {
        return;
    }

    const groups = getAllStoredGroups();
    const newGroup: FileGroup = {
        id: generateId(),
        name: name.trim(),
        icon: options.icon,
        color: options.color,
        shortDescription: options.shortDescription,
        files,
        order: groups.length,
        parentId: undefined,
        createdBy: CURRENT_USERNAME,
        collapsed: false
    };

    await storageService.createGroup(newGroup);
    fileGroupsProvider.refresh();
    fileDecorationProvider.refresh(files.map((file) => vscode.Uri.file(file.path)));

    try {
        await treeView.reveal(new FileGroupTreeItem('group', newGroup), {
            focus: true,
            select: true,
            expand: true
        });
    } catch {
        // The tree can refresh asynchronously; failing to reveal should not block group creation.
    }

    void vscode.window.showInformationMessage(
        t('preset.created', {
            name: newGroup.name,
            count: files.length,
            fileLabel: files.length === 1 ? t('noun.file.one') : t('noun.file.other')
        })
    );
}

/**
 * Check for missing files and prompt user to clean up
 */
async function checkForMissingFiles(): Promise<void> {
    const groups = storageService.getGroups();
    const fs = require('fs');
    let missingCount = 0;

    for (const group of groups) {
        for (const file of group.files) {
            try {
                if (!fs.existsSync(file.path)) {
                    missingCount++;
                }
            } catch {
                missingCount++;
            }
        }
    }

    if (missingCount > 0) {
        const action = await vscode.window.showWarningMessage(
            t('missingFiles.startup.prompt', { count: missingCount }),
            t('action.cleanUp'),
            t('action.ignore')
        );

        if (action === t('action.cleanUp')) {
            await vscode.commands.executeCommand('fileGroups.cleanupMissingFiles');
        }
    }
}

export async function activate(context: vscode.ExtensionContext) {
    // Initialize services
    storageService = new StorageService(context);

    // Try to load from file first (both local and global)
    await storageService.loadFromFile();
    await storageService.loadFromGlobalFile();

    fileGroupsProvider = new FileGroupsProvider(storageService);
    fileDecorationProvider = new FileGroupDecorationProvider(storageService);

    // Register file decoration provider (for tab/explorer colors)
    context.subscriptions.push(
        vscode.window.registerFileDecorationProvider(fileDecorationProvider)
    );

    // Create tree view with drag and drop support
    const dragDropController = new FileGroupsDragDropController(storageService, fileGroupsProvider);

    // Set callback to refresh decorations when files are added via drag & drop
    dragDropController.setOnFilesAddedCallback((uris) => {
        fileDecorationProvider.refresh(uris);
    });

    treeView = vscode.window.createTreeView('fileGroupsView', {
        treeDataProvider: fileGroupsProvider,
        dragAndDropController: dragDropController,
        canSelectMany: true
    });

    context.subscriptions.push(treeView);

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (!event.affectsConfiguration(CODEGROUP_LANGUAGE_CONFIGURATION_KEY)) {
                return;
            }

            fileGroupsProvider.refresh();
            GroupEditorPanel.refreshAll();
        })
    );

    context.subscriptions.push(
        treeView.onDidCollapseElement((event) => {
            if (event.element.itemType === 'group') {
                if (event.element.group) {
                    void storageService.updateGroup(event.element.group.id, { collapsed: true });
                }
            }
        })
    );

    context.subscriptions.push(
        treeView.onDidExpandElement((event) => {
            if (event.element.itemType === 'group') {
                if (event.element.group) {
                    void storageService.updateGroup(event.element.group.id, { collapsed: false });
                }
            }
        })
    );

    // Set up file system watcher for file renames, deletes, and moves
    setupFileWatcher(context);

    // Register all commands
    registerCommands(context);

    // Check for missing files after a short delay
    setTimeout(() => {
        void checkForMissingFiles();
    }, 3000);
}

/**
 * Set up file system watcher to handle renamed, deleted, and moved files
 */
function setupFileWatcher(context: vscode.ExtensionContext) {
    // Watch for file deletions
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');

    // Handle file deletions - remove deleted files from groups
    fileWatcher.onDidDelete(async (uri) => {
        const deletedPath = uri.fsPath;
        const groups = storageService.getGroups();
        let changed = false;

        for (const group of groups) {
            const originalLength = group.files.length;
            group.files = group.files.filter(f => f.path !== deletedPath);
            if (group.files.length !== originalLength) {
                changed = true;
            }
        }

        if (changed) {
            await storageService.saveGroups(groups);
            fileGroupsProvider.refresh();
        }
    });

    context.subscriptions.push(fileWatcher);

    // Watch for file renames/moves using the onDidRenameFiles event
    context.subscriptions.push(
        vscode.workspace.onDidRenameFiles(async (event) => {
            const groups = storageService.getGroups();
            let changed = false;

            for (const { oldUri, newUri } of event.files) {
                const oldPath = oldUri.fsPath;
                const newPath = newUri.fsPath;
                const newName = newPath.split(/[/\\]/).pop() || 'unknown';

                for (const group of groups) {
                    const fileIndex = group.files.findIndex(f => f.path === oldPath);
                    if (fileIndex !== -1) {
                        // Update the file path and name
                        group.files[fileIndex] = {
                            path: newPath,
                            name: newName
                        };
                        changed = true;
                    }
                }
            }

            if (changed) {
                await storageService.saveGroups(groups);
                fileGroupsProvider.refresh();
                fileDecorationProvider.refresh();
            }
        })
    );
}

async function pickGroupForCommand(placeHolder: string, initialItem?: FileGroupTreeItem): Promise<FileGroup | undefined> {
    if (initialItem && initialItem.itemType === 'group') {
        return initialItem.group || undefined;
    }

    const groups = storageService.getGroups();
    if (groups.length === 0) {
        vscode.window.showInformationMessage(t('group.select.none'));
        return undefined;
    }

    const groupItems = groups.map(g => ({
        label: `$(${g.icon || 'folder'}) ${g.name}`,
        description: g.parentId ? t('group.select.nested') : '',
        groupId: g.id
    }));

    const selected = await vscode.window.showQuickPick(groupItems, {
        placeHolder
    });

    if (!selected) {
        return undefined;
    }

    return groups.find(g => g.id === selected.groupId);
}

function registerCommands(context: vscode.ExtensionContext) {
    type GroupedFileQuickPickItem = vscode.QuickPickItem & {
        groupId?: string;
        filePath?: string;
    };

    // Create a new root group
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.changeLanguage', async () => {
            const selectedLanguage = await vscode.window.showQuickPick(
                getLanguageOptions().map((option) => ({
                    label: option.label,
                    description: option.description,
                    languageId: option.id,
                    picked: normalizeCodeGroupLanguage(vscode.workspace.getConfiguration('codegroup').get<string>('language')) === option.id
                })),
                {
                    placeHolder: t('language.command.pick')
                }
            );

            if (!selectedLanguage) {
                return;
            }

            await vscode.workspace.getConfiguration('codegroup').update(
                'language',
                selectedLanguage.languageId,
                vscode.ConfigurationTarget.Global
            );

            void vscode.window.showInformationMessage(
                t('language.command.updated', {
                    language: getLanguageLabel(selectedLanguage.languageId)
                })
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.createGroup', async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter group name',
                placeHolder: 'My Group'
            });

            if (name) {
                const groups = getAllStoredGroups();
                const newGroup: FileGroup = {
                    id: generateId(),
                    name,
                    icon: 'folder',
                    color: '',
                    files: [],
                    order: groups.length,
                    parentId: undefined,
                    createdBy: CURRENT_USERNAME,
                    collapsed: false
                };
                await storageService.createGroup(newGroup);
                fileGroupsProvider.refresh();
            }
        })
    );

    // Create a group from open editors
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.createGroupFromOpenEditors', async () => {
            await createPresetGroup({
                defaultName: t('preset.openEditors.name'),
                prompt: t('preset.openEditors.prompt'),
                emptyMessage: t('preset.openEditors.empty'),
                files: collectOpenEditorFiles(),
                icon: 'files',
                color: 'terminal.ansiCyan',
                shortDescription: t('preset.openEditors.summary')
            });
        })
    );

    // Create a group from current Git changes
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.createGroupFromGitChanges', async () => {
            const files = await collectGitChangedFiles();
            if (files === undefined) {
                void vscode.window.showWarningMessage('No Git repository was detected for the current workspace folder.');
                return;
            }

            await createPresetGroup({
                defaultName: t('preset.gitChanges.name'),
                prompt: t('preset.gitChanges.prompt'),
                emptyMessage: t('preset.gitChanges.empty'),
                files,
                icon: 'source-control',
                color: 'charts.orange',
                shortDescription: t('preset.gitChanges.summary')
            });
        })
    );

    // Create smart groups from workspace files
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.createSmartGroups', async () => {
            const workspaceRoot = getWorkspaceRoot();
            if (!workspaceRoot) {
                void vscode.window.showWarningMessage(t('smart.noWorkspace'));
                return;
            }

            const strategy = await vscode.window.showQuickPick([
                {
                    label: t('smart.strategy.project.label'),
                    description: t('smart.strategy.project.description'),
                    strategyId: 'project-areas' as const
                },
                {
                    label: t('smart.strategy.languages.label'),
                    description: t('smart.strategy.languages.description'),
                    strategyId: 'languages' as const
                }
            ], {
                placeHolder: t('smart.strategy.pick')
            });

            if (!strategy) {
                return;
            }

            const workspaceFiles = await collectWorkspaceFilesForSmartGroups();
            const suggestions = suggestSmartGroups(strategy.strategyId, workspaceFiles, workspaceRoot)
                .map((suggestion) => {
                    const localizedText = getLocalizedSmartGroupText(suggestion.id);
                    return {
                        ...suggestion,
                        name: localizedText.name,
                        shortDescription: localizedText.summary
                    };
                });

            if (suggestions.length === 0) {
                void vscode.window.showInformationMessage(t('smart.noSuggestions'));
                return;
            }

            const selectedSuggestions = await vscode.window.showQuickPick(
                suggestions.map((suggestion) => ({
                    label: `$(${suggestion.icon}) ${suggestion.name}`,
                    description: countLabel(suggestion.files.length, 'noun.file.one', 'noun.file.other'),
                    detail: suggestion.shortDescription,
                    suggestion,
                    picked: true
                })),
                {
                    canPickMany: true,
                    placeHolder: t('smart.selection.pick')
                }
            );

            if (!selectedSuggestions || selectedSuggestions.length === 0) {
                return;
            }

            const createdGroups = await createSuggestedGroups(selectedSuggestions.map((item) => item.suggestion));
            if (createdGroups.length === 0) {
                return;
            }

            try {
                await treeView.reveal(new FileGroupTreeItem('group', createdGroups[0]), {
                    focus: true,
                    select: true,
                    expand: true
                });
            } catch {
                // Ignore reveal timing issues after refresh.
            }

            void vscode.window.showInformationMessage(
                t('smart.created', {
                    count: createdGroups.length,
                    smartGroupLabel: createdGroups.length === 1 ? t('noun.smartGroup.one') : t('noun.smartGroup.other')
                })
            );
        })
    );

    // Export a group as shareable JSON
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.exportGroupShare', async (item?: FileGroupTreeItem) => {
            const targetGroup = await pickGroupForCommand(t('share.export.pick'), item);
            if (!targetGroup) {
                return;
            }

            const payload = buildSharedGroupPayload(targetGroup.id, storageService.getGroups(), getWorkspaceRoot());
            const json = JSON.stringify(payload, null, 2);

            await vscode.env.clipboard.writeText(json);
            const action = await vscode.window.showInformationMessage(
                t('share.export.copied', { name: targetGroup.name }),
                t('action.openJson')
            );

            if (action === t('action.openJson')) {
                const document = await vscode.workspace.openTextDocument({
                    language: 'json',
                    content: json
                });
                await vscode.window.showTextDocument(document, { preview: false });
            }
        })
    );

    // Import a shared group from clipboard or file
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.importSharedGroup', async () => {
            const source = await vscode.window.showQuickPick([
                {
                    label: t('share.import.source.clipboard.label'),
                    description: t('share.import.source.clipboard.description'),
                    sourceId: 'clipboard' as const
                },
                {
                    label: t('share.import.source.file.label'),
                    description: t('share.import.source.file.description'),
                    sourceId: 'file' as const
                }
            ], {
                placeHolder: t('share.import.source.pick')
            });

            if (!source) {
                return;
            }

            let rawContent: string | undefined;
            if (source.sourceId === 'clipboard') {
                rawContent = await vscode.env.clipboard.readText();
            } else {
                const selectedFile = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectMany: false,
                    filters: {
                        JSON: ['json']
                    },
                    openLabel: t('share.import.openLabel')
                });

                if (!selectedFile || selectedFile.length === 0) {
                    return;
                }

                rawContent = Buffer.from(await vscode.workspace.fs.readFile(selectedFile[0])).toString('utf8');
            }

            if (!rawContent || rawContent.trim().length === 0) {
                void vscode.window.showWarningMessage(t('share.import.empty'));
                return;
            }

            let parsedPayload: unknown;
            try {
                parsedPayload = JSON.parse(rawContent);
            } catch {
                void vscode.window.showErrorMessage(t('share.import.invalidJson'));
                return;
            }

            if (!isSharedGroupPayload(parsedPayload)) {
                void vscode.window.showErrorMessage(t('share.import.invalidPayload'));
                return;
            }

            const scopeSelection = await vscode.window.showQuickPick([
                {
                    label: t('share.import.scope.local.label'),
                    description: t('share.import.scope.local.description'),
                    scopeId: 'local' as const
                },
                {
                    label: t('share.import.scope.global.label'),
                    description: t('share.import.scope.global.description'),
                    scopeId: 'global' as const
                }
            ], {
                placeHolder: t('share.import.scope.pick')
            });

            if (!scopeSelection) {
                return;
            }

            const importedGroups = importSharedGroupPayload(
                parsedPayload,
                getWorkspaceRoot(),
                scopeSelection.scopeId,
                generateId,
                getAllStoredGroups().length,
                CURRENT_USERNAME
            );

            if (importedGroups.length === 0) {
                void vscode.window.showWarningMessage(t('share.import.noGroups'));
                return;
            }

            await storageService.saveGroups([...getAllStoredGroups(), ...importedGroups]);
            fileGroupsProvider.refresh();
            fileDecorationProvider.refresh(importedGroups.flatMap((group) => group.files.map((file) => vscode.Uri.file(file.path))));

            try {
                await treeView.reveal(new FileGroupTreeItem('group', importedGroups[0]), {
                    focus: true,
                    select: true,
                    expand: true
                });
            } catch {
                // Ignore reveal timing issues after refresh.
            }

            void vscode.window.showInformationMessage(
                t('share.import.created', {
                    count: importedGroups.length,
                    groupLabel: importedGroups.length === 1 ? t('noun.group.one') : t('noun.group.other')
                })
            );
        })
    );

    // Quick open any grouped file from one searchable list
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.quickOpen', async () => {
            const groups = storageService.getGroups();
            if (groups.length === 0) {
                const action = await vscode.window.showInformationMessage(
                    t('quickOpen.noGroups.message'),
                    t('action.createGroup'),
                    t('action.fromOpenEditors'),
                    t('action.fromGitChanges')
                );

                if (action === t('action.createGroup')) {
                    await vscode.commands.executeCommand('fileGroups.createGroup');
                } else if (action === t('action.fromOpenEditors')) {
                    await vscode.commands.executeCommand('fileGroups.createGroupFromOpenEditors');
                } else if (action === t('action.fromGitChanges')) {
                    await vscode.commands.executeCommand('fileGroups.createGroupFromGitChanges');
                }
                return;
            }

            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const { recentItems, otherItems } = buildGroupedFileQuickOpenSections(
                groups,
                getRecentGroupFileKeys(context),
                workspaceRoot
            );

            if (recentItems.length === 0 && otherItems.length === 0) {
                const action = await vscode.window.showInformationMessage(
                    t('quickOpen.noFiles.message'),
                    t('action.fromOpenEditors'),
                    t('action.fromGitChanges')
                );

                if (action === t('action.fromOpenEditors')) {
                    await vscode.commands.executeCommand('fileGroups.createGroupFromOpenEditors');
                } else if (action === t('action.fromGitChanges')) {
                    await vscode.commands.executeCommand('fileGroups.createGroupFromGitChanges');
                }
                return;
            }

            const toQuickPickItem = (item: typeof recentItems[number]): GroupedFileQuickPickItem => ({
                label: item.fileName,
                description: item.groupIsGlobal ? `${item.groupTrail} • global` : item.groupTrail,
                detail: item.detail,
                groupId: item.groupId,
                filePath: item.filePath
            });

            const quickPickItems: GroupedFileQuickPickItem[] = [];

            if (recentItems.length > 0) {
                quickPickItems.push({
                    label: t('quickOpen.separator.recent'),
                    kind: vscode.QuickPickItemKind.Separator
                });
                quickPickItems.push(...recentItems.map(toQuickPickItem));
            }

            if (otherItems.length > 0) {
                quickPickItems.push({
                    label: recentItems.length > 0 ? t('quickOpen.separator.all') : t('quickOpen.separator.grouped'),
                    kind: vscode.QuickPickItemKind.Separator
                });
                quickPickItems.push(...otherItems.map(toQuickPickItem));
            }

            const selection = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: t('quickOpen.placeholder'),
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (!selection?.groupId || !selection.filePath) {
                return;
            }

            await openGroupedFile(context, selection.groupId, selection.filePath);
        })
    );

    // Open a grouped file and track it for quick access recents
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.openGroupedFile', async (args?: { groupId?: string; filePath?: string }) => {
            if (!args?.groupId || !args.filePath) {
                return;
            }

            await openGroupedFile(context, args.groupId, args.filePath);
        })
    );

    // Create a child group under an existing group
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.createSubgroup', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group' && item.group) {
                const name = await vscode.window.showInputBox({
                    prompt: `Enter child group name (under "${item.group.name}")`,
                    placeHolder: 'My Child Group'
                });

                if (name) {
                    const groups = getAllStoredGroups();
                    const newGroup: FileGroup = {
                        id: generateId(),
                        name,
                        icon: 'folder',
                        color: item.group.color, // Inherit parent color
                        files: [],
                        order: groups.length,
                        parentId: item.group.id,
                        createdBy: CURRENT_USERNAME,
                        collapsed: false
                    };
                    await storageService.createGroup(newGroup);
                    fileGroupsProvider.refresh();
                }
            }
        })
    );

    // Open group editor
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.openGroupEditor', async (item?: FileGroupTreeItem) => {
            const targetGroup = await pickGroupForCommand(t('groupActions.editor.label').replace(/^\$\([^)]+\)\s*/, ''), item);
            if (!targetGroup) {
                return;
            }

            GroupEditorPanel.show(context, storageService, fileGroupsProvider, fileDecorationProvider, targetGroup.id);
        })
    );

    // Consolidated group actions hub to keep the context menu focused
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.groupActions', async (item?: FileGroupTreeItem) => {
            const targetGroup = await pickGroupForCommand('Select group for more actions', item);
            if (!targetGroup) {
                return;
            }

            const targetItem = new FileGroupTreeItem('group', targetGroup);
            const selectedAction = await vscode.window.showQuickPick([
                {
                    label: t('groupActions.editor.label'),
                    description: t('groupActions.editor.description'),
                    actionId: 'editor'
                },
                {
                    label: t('groupActions.subgroup.label'),
                    description: t('groupActions.subgroup.description'),
                    actionId: 'subgroup'
                },
                {
                    label: t('groupActions.rename.label', { name: targetGroup.name }),
                    description: t('groupActions.rename.description'),
                    actionId: 'rename'
                },
                {
                    label: targetGroup.pinned ? t('groupActions.unpin.label') : t('groupActions.pin.label'),
                    description: targetGroup.pinned ? t('groupActions.unpin.description') : t('groupActions.pin.description'),
                    actionId: targetGroup.pinned ? 'unpin' : 'pin'
                },
                {
                    label: t('groupActions.sort.label'),
                    description: t('groupActions.sort.description'),
                    actionId: 'sort'
                },
                {
                    label: t('groupActions.duplicate.label'),
                    description: t('groupActions.duplicate.description'),
                    actionId: 'duplicate'
                },
                {
                    label: t('groupActions.export.label'),
                    description: t('groupActions.export.description'),
                    actionId: 'export'
                },
                ...(targetGroup.parentId ? [{
                    label: t('groupActions.moveRoot.label'),
                    description: t('groupActions.moveRoot.description'),
                    actionId: 'root'
                }] : []),
                ...(!targetGroup.isGlobal ? [{
                    label: t('groupActions.toGlobal.label'),
                    description: t('groupActions.toGlobal.description'),
                    actionId: 'to-global'
                }] : [{
                    label: t('groupActions.toLocal.label'),
                    description: t('groupActions.toLocal.description'),
                    actionId: 'to-local'
                }])
            ], {
                placeHolder: t('groupActions.pick', { name: targetGroup.name })
            });

            if (!selectedAction) {
                return;
            }

            switch (selectedAction.actionId) {
                case 'editor':
                    await vscode.commands.executeCommand('fileGroups.openGroupEditor', targetItem);
                    return;
                case 'subgroup':
                    await vscode.commands.executeCommand('fileGroups.createSubgroup', targetItem);
                    return;
                case 'rename':
                    await vscode.commands.executeCommand('fileGroups.renameGroup', targetItem);
                    return;
                case 'pin':
                    await vscode.commands.executeCommand('fileGroups.pinGroup', targetItem);
                    return;
                case 'unpin':
                    await vscode.commands.executeCommand('fileGroups.unpinGroup', targetItem);
                    return;
                case 'sort':
                    await vscode.commands.executeCommand('fileGroups.sortFiles', targetItem);
                    return;
                case 'duplicate':
                    await vscode.commands.executeCommand('fileGroups.duplicateGroup', targetItem);
                    return;
                case 'export':
                    await vscode.commands.executeCommand('fileGroups.exportGroupShare', targetItem);
                    return;
                case 'root':
                    await vscode.commands.executeCommand('fileGroups.moveToRoot', targetItem);
                    return;
                case 'to-global':
                    await vscode.commands.executeCommand('fileGroups.moveToGlobal', targetItem);
                    return;
                case 'to-local':
                    await vscode.commands.executeCommand('fileGroups.moveToLocal', targetItem);
                    return;
            }
        })
    );

    // Delete a group (with confirmation for children)
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.deleteGroup', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group' && item.group) {
                const childGroups = storageService.getSubgroups(item.group.id);
                const message = childGroups.length > 0
                    ? `Delete group "${item.group.name}" and ${childGroups.length} child group(s)?`
                    : `Delete group "${item.group.name}\"?`;

                const confirm = await vscode.window.showWarningMessage(
                    message,
                    { modal: true },
                    'Delete'
                );
                if (confirm === 'Delete') {
                    // Get all files that will lose their decoration
                    const allFiles = storageService.getAllFilesInGroup(item.group.id);
                    const uris = allFiles.map(f => vscode.Uri.file(f.path));

                    await storageService.deleteGroup(item.group.id);
                    fileGroupsProvider.refresh();
                    fileDecorationProvider.refresh(uris);
                }
            }
        })
    );

    // Delete group from title bar (prompt user to select which group)
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.deleteGroupFromTitle', async () => {
            const groups = storageService.getGroups();
            if (groups.length === 0) {
                vscode.window.showInformationMessage('No groups to delete');
                return;
            }

            const groupItems = groups.map(g => ({
                label: `$(${g.icon || 'folder'}) ${g.name}`,
                description: g.parentId ? '(nested)' : '',
                groupId: g.id,
                groupName: g.name
            }));

            const selected = await vscode.window.showQuickPick(groupItems, {
                placeHolder: 'Select group to delete'
            });

            if (selected) {
                const confirm = await vscode.window.showWarningMessage(
                    `Delete group "${selected.groupName}"?`,
                    { modal: true },
                    'Delete'
                );
                if (confirm === 'Delete') {
                    const allFiles = storageService.getAllFilesInGroup(selected.groupId);
                    const uris = allFiles.map(f => vscode.Uri.file(f.path));

                    await storageService.deleteGroup(selected.groupId);
                    fileGroupsProvider.refresh();
                    fileDecorationProvider.refresh(uris);
                }
            }
        })
    );

    // Move a nested group to root level
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.moveToRoot', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group' && item.group && item.group.parentId) {
                await storageService.updateGroup(item.group.id, { parentId: undefined });
                fileGroupsProvider.refresh();
            }
        })
    );

    // Expand all groups
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.expandAll', async () => {
            // Reveal all root groups expanded
            const rootGroups = storageService.getRootGroups();
            for (const group of rootGroups) {
                const item = new FileGroupTreeItem('group', group);
                try {
                    await treeView.reveal(item, { expand: true });
                } catch {
                    // Item might not be visible
                }
            }
        })
    );

    // Collapse all groups
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.collapseAll', async () => {
            // Use the built-in command to collapse all
            await vscode.commands.executeCommand('workbench.actions.treeView.fileGroupsView.collapseAll');
        })
    );

    // Rename a group
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.renameGroup', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group' && item.group) {
                const newName = await vscode.window.showInputBox({
                    prompt: 'Enter new group name',
                    value: item.group.name
                });
                if (newName && newName !== item.group.name) {
                    await storageService.updateGroup(item.group.id, { name: newName });
                    fileGroupsProvider.refresh();
                }
            }
        })
    );

    // Set group icon
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.setGroupIcon', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group' && item.group) {
                const iconItems = GROUP_ICONS.map(icon => ({
                    label: icon.label,
                    iconId: icon.id
                }));

                const selected = await vscode.window.showQuickPick(iconItems, {
                    placeHolder: 'Select an icon for the group'
                });

                if (selected) {
                    await storageService.updateGroup(item.group.id, { icon: selected.iconId });
                    fileGroupsProvider.refresh();
                }
            }
        })
    );

    // Set group color
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.setGroupColor', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group' && item.group) {
                const colorItems = GROUP_COLORS.map(color => ({
                    label: color.label,
                    colorId: color.id
                }));

                const selected = await vscode.window.showQuickPick(colorItems, {
                    placeHolder: 'Select a color for the group'
                });

                if (selected) {
                    let colorValue = selected.colorId;

                    // Handle custom hex color
                    if (selected.colorId === 'custom') {
                        const hexInput = await vscode.window.showInputBox({
                            prompt: 'Enter a hex color (e.g., #FF5733, #3498DB)',
                            placeHolder: '#FF5733',
                            value: isHexColor(item.group.color) ? item.group.color : '#',
                            validateInput: (value) => {
                                if (!value || value === '#') {
                                    return 'Please enter a hex color';
                                }
                                if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
                                    return 'Please enter a valid 6-digit hex color (e.g., #FF5733)';
                                }
                                return null;
                            }
                        });

                        if (!hexInput) {
                            return; // User cancelled
                        }
                        colorValue = hexInput.toUpperCase();
                    }

                    await storageService.updateGroup(item.group.id, { color: colorValue });
                    fileGroupsProvider.refresh();
                    // Refresh decorations for all files in this group and child groups
                    const allFiles = storageService.getAllFilesInGroup(item.group.id);
                    const uris = allFiles.map(f => vscode.Uri.file(f.path));
                    fileDecorationProvider.refresh(uris);
                }
            }
        })
    );

    // Edit short description/summary
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.editGroupSummary', async (item?: FileGroupTreeItem) => {
            const targetGroup = await pickGroupForCommand('Select group to edit summary', item);
            if (!targetGroup) {
                return;
            }

            const value = await vscode.window.showInputBox({
                prompt: 'Enter a short description (shown next to the name)',
                placeHolder: 'API endpoints, build scripts, etc.',
                value: targetGroup.shortDescription ?? '',
                ignoreFocusOut: true
            });

            if (value === undefined) {
                return;
            }

            const trimmed = value.trim();
            await storageService.updateGroup(targetGroup.id, {
                shortDescription: trimmed.length > 0 ? trimmed : undefined
            });
            fileGroupsProvider.refresh();
        })
    );

    // Edit long-form description/notes
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.editGroupDetails', async (item?: FileGroupTreeItem) => {
            const targetGroup = await pickGroupForCommand('Select group to edit description', item);
            if (!targetGroup) {
                return;
            }

            const value = await vscode.window.showInputBox({
                prompt: 'Enter a longer description (Markdown supported)',
                placeHolder: 'Explain why this group matters or how to use it',
                value: targetGroup.details ?? '',
                ignoreFocusOut: true
            });

            if (value === undefined) {
                return;
            }

            const trimmed = value.trim();
            await storageService.updateGroup(targetGroup.id, {
                details: trimmed.length > 0 ? trimmed : undefined
            });
            fileGroupsProvider.refresh();
        })
    );

    // Pin group to top
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.pinGroup', async (item?: FileGroupTreeItem) => {
            const targetGroup = await pickGroupForCommand('Select group to pin', item);
            if (!targetGroup) {
                return;
            }

            await storageService.updateGroup(targetGroup.id, { pinned: true });
            fileGroupsProvider.refresh();
        })
    );

    // Unpin group
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.unpinGroup', async (item?: FileGroupTreeItem) => {
            const targetGroup = await pickGroupForCommand('Select group to unpin', item);
            if (!targetGroup) {
                return;
            }

            await storageService.updateGroup(targetGroup.id, { pinned: false });
            fileGroupsProvider.refresh();
        })
    );

    // Set custom badge text
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.setBadgeText', async (item?: FileGroupTreeItem) => {
            const targetGroup = await pickGroupForCommand('Select group to set badge', item);
            if (!targetGroup) {
                return;
            }

            const value = await vscode.window.showInputBox({
                prompt: 'Enter 1-2 characters for the file badge (leave empty for default)',
                placeHolder: 'e.g., A, 🔥, UI',
                value: targetGroup.badgeText ?? '',
                ignoreFocusOut: true,
                validateInput: (input) => {
                    if (input.length > 2) {
                        return 'Badge must be 1-2 characters';
                    }
                    return null;
                }
            });

            if (value === undefined) {
                return;
            }

            const trimmed = value.trim();
            await storageService.updateGroup(targetGroup.id, {
                badgeText: trimmed.length > 0 ? trimmed : undefined
            });
            fileGroupsProvider.refresh();
            // Refresh decorations for files in this group
            const allFiles = storageService.getAllFilesInGroup(targetGroup.id);
            const uris = allFiles.map(f => vscode.Uri.file(f.path));
            fileDecorationProvider.refresh(uris);
        })
    );

    // Find duplicate files (files in multiple groups)
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.findDuplicates', async () => {
            const groups = storageService.getGroups();
            const fileToGroups = new Map<string, string[]>();

            for (const group of groups) {
                for (const file of group.files) {
                    const existing = fileToGroups.get(file.path) || [];
                    existing.push(group.name);
                    fileToGroups.set(file.path, existing);
                }
            }

            const duplicates: { path: string; groups: string[] }[] = [];
            for (const [path, groupNames] of fileToGroups) {
                if (groupNames.length > 1) {
                    duplicates.push({ path, groups: groupNames });
                }
            }

            if (duplicates.length === 0) {
                vscode.window.showInformationMessage('No duplicate files found across groups.');
                return;
            }

            const items = duplicates.map(d => ({
                label: d.path.split(/[/\\]/).pop() || d.path,
                description: `In ${d.groups.length} groups`,
                detail: `Groups: ${d.groups.join(', ')}`,
                path: d.path
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `Found ${duplicates.length} file(s) in multiple groups`,
                canPickMany: false
            });

            if (selected) {
                const uri = vscode.Uri.file(selected.path);
                await vscode.window.showTextDocument(uri);
            }
        })
    );

    // Add file to group (from explorer context menu)
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.addFile', async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
            const groups = storageService.getGroups();
            if (groups.length === 0) {
                const create = await vscode.window.showInformationMessage(
                    'No groups exist. Create one first?',
                    'Create Group'
                );
                if (create === 'Create Group') {
                    await vscode.commands.executeCommand('fileGroups.createGroup');
                }
                return;
            }

            // Use all selected URIs if available, otherwise just the single URI
            const filesToAdd = uris && uris.length > 0 ? uris : (uri ? [uri] : []);

            if (filesToAdd.length === 0) {
                return;
            }

            const groupItems = groups.map(g => ({
                label: `$(${g.icon || 'folder'}) ${g.name}`,
                description: `${g.files.length} ${g.files.length === 1 ? 'item' : 'items'}`,
                groupId: g.id
            }));

            const selected = await vscode.window.showQuickPick(groupItems, {
                placeHolder: `Select group to add ${filesToAdd.length} item(s)`
            });

            if (selected) {
                const files: GroupFile[] = [];

                for (const fileUri of filesToAdd) {
                    let isDirectory = false;
                    try {
                        const stat = await vscode.workspace.fs.stat(fileUri);
                        isDirectory = (stat.type & vscode.FileType.Directory) !== 0;
                    } catch {
                        // If stat fails, assume it's a file
                    }

                    files.push({
                        path: fileUri.fsPath,
                        name: getFileName(fileUri.fsPath),
                        isDirectory
                    });
                }

                const addedCount = await storageService.addFilesToGroup(selected.groupId, files);
                fileGroupsProvider.refresh();
                // Refresh decorations for added files
                fileDecorationProvider.refresh(filesToAdd);
            }
        })
    );

    // Add file from editor tab context menu
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.addFileFromTab', async (uri: vscode.Uri) => {
            // If no URI provided, try to get from active editor
            const fileUri = uri || vscode.window.activeTextEditor?.document.uri;

            if (!fileUri || fileUri.scheme !== 'file') {
                vscode.window.showWarningMessage('No file available to add');
                return;
            }

            await vscode.commands.executeCommand('fileGroups.addFile', fileUri, [fileUri]);
        })
    );

    // Go to group - shows which groups contain the file and reveals it in the tree
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.goToGroup', async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
            // Use single URI (not multi-select for this command)
            const fileUri = uri || vscode.window.activeTextEditor?.document.uri;

            if (!fileUri || fileUri.scheme !== 'file') {
                vscode.window.showWarningMessage('No file available');
                return;
            }

            const filePath = fileUri.fsPath;
            const groups = storageService.getGroups();

            // Find all groups that contain this file
            const groupsWithFile: FileGroup[] = [];
            for (const group of groups) {
                if (group.files.some(f => f.path === filePath)) {
                    groupsWithFile.push(group);
                }
            }

            if (groupsWithFile.length === 0) {
                vscode.window.showInformationMessage('This file is not in any CodeGroup');
                return;
            }

            // If only one group, reveal it directly
            if (groupsWithFile.length === 1) {
                const group = groupsWithFile[0];
                const item = new FileGroupTreeItem('group', group);
                await treeView.reveal(item, { focus: true, select: true, expand: true });
                return;
            }

            // If multiple groups, let user choose
            const groupItems = groupsWithFile.map(g => ({
                label: `$(${g.icon || 'folder'}) ${g.name}`,
                description: g.parentId ? '(nested)' : '',
                group: g
            }));

            const selected = await vscode.window.showQuickPick(groupItems, {
                placeHolder: `This file is in ${groupsWithFile.length} groups. Select one to reveal:`
            });

            if (selected) {
                const item = new FileGroupTreeItem('group', selected.group);
                await treeView.reveal(item, { focus: true, select: true, expand: true });
            }
        })
    );

    // Remove file from group (supports multi-select)
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.removeFile', async (item: FileGroupTreeItem, selectedItems?: FileGroupTreeItem[]) => {
            // Use selected items if available (multi-select), otherwise use single item
            const itemsToRemove = selectedItems && selectedItems.length > 0
                ? selectedItems.filter(i => i.itemType === 'file' && i.file)
                : (item?.itemType === 'file' && item.file ? [item] : []);

            if (itemsToRemove.length === 0) {
                return;
            }

            const urisToRefresh: vscode.Uri[] = [];

            for (const fileItem of itemsToRemove) {
                if (fileItem.file && fileItem.group) {
                    urisToRefresh.push(vscode.Uri.file(fileItem.file.path));
                    await storageService.removeFileFromGroup(fileItem.group.id, fileItem.file.path);
                }
            }

            fileGroupsProvider.refresh();
            // Refresh decorations for removed files
            if (urisToRefresh.length > 0) {
                fileDecorationProvider.refresh(urisToRefresh);
            }
        })
    );

    // Open all files in a group (including child groups)
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.openAll', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group' && item.group) {
                // Get all files including from child groups
                const allFiles = storageService.getAllFilesInGroup(item.group.id);

                if (allFiles.length > 0) {
                    // Batch open for speed: dedupe file paths and skip folder entries.
                    const uniqueFilePaths = [...new Set(
                        allFiles
                            .filter(file => !file.isDirectory)
                            .map(file => file.path)
                    )];

                    if (uniqueFilePaths.length > 0) {
                        await Promise.allSettled(
                            uniqueFilePaths.map(filePath =>
                                vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath), {
                                    preview: false,
                                    preserveFocus: true
                                })
                            )
                        );
                    }
                }
            }
        })
    );

    // Close all files in a group (including child groups, only group files, not other tabs)
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.closeAll', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group' && item.group) {
                // Get all files including from child groups
                const allFiles = storageService.getAllFilesInGroup(item.group.id);

                if (allFiles.length > 0) {
                    const groupFilePaths = new Set(allFiles.map(f => f.path));

                    // Get all tab groups and tabs
                    for (const tabGroup of vscode.window.tabGroups.all) {
                        for (const tab of tabGroup.tabs) {
                            // Check if this tab is a file that belongs to our group
                            const tabInput = tab.input;
                            if (tabInput && typeof tabInput === 'object' && 'uri' in tabInput) {
                                const tabUri = (tabInput as { uri: vscode.Uri }).uri;
                                if (tabUri.scheme === 'file' && groupFilePaths.has(tabUri.fsPath)) {
                                    try {
                                        await vscode.window.tabGroups.close(tab);
                                    } catch {
                                        // Tab might already be closed
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })
    );

    // Refresh the tree view
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.refresh', () => {
            fileGroupsProvider.refresh();
        })
    );

    // Clean up missing files (files that no longer exist)
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.cleanupMissingFiles', async () => {
            const groups = storageService.getGroups();
            let removedCount = 0;
            const fs = require('fs');

            for (const group of groups) {
                const originalLength = group.files.length;
                group.files = group.files.filter(file => {
                    try {
                        return fs.existsSync(file.path);
                    } catch {
                        return false;
                    }
                });
                removedCount += originalLength - group.files.length;
            }

            if (removedCount > 0) {
                await storageService.saveGroups(groups);
                fileGroupsProvider.refresh();
                fileDecorationProvider.refresh();
            }
        })
    );

    // Sort files in a group
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.sortFiles', async (item?: FileGroupTreeItem) => {
            const group = await pickGroupForCommand('Select group to sort files', item);
            if (!group) { return; }

            const sortOptions = [
                { label: '$(sort-precedence) Name (A → Z)', sortOrder: 'name-asc' },
                { label: '$(sort-precedence) Name (Z → A)', sortOrder: 'name-desc' },
                { label: '$(history) Date Modified (Oldest First)', sortOrder: 'date-asc' },
                { label: '$(history) Date Modified (Newest First)', sortOrder: 'date-desc' },
                { label: '$(file-code) File Type (Extension)', sortOrder: 'type' },
                { label: '$(gripper) Manual (Drag & Drop)', sortOrder: 'manual' }
            ];

            const currentSort = group.sortOrder || 'manual';
            const currentOption = sortOptions.find(opt => opt.sortOrder === currentSort);

            const selection = await vscode.window.showQuickPick(sortOptions, {
                placeHolder: `Current: ${currentOption?.label.replace(/\$\([^)]+\)\s*/, '') || 'Manual'}`,
                matchOnDescription: true
            });

            if (selection) {
                await storageService.updateGroup(group.id, { sortOrder: selection.sortOrder });
                fileGroupsProvider.refresh();
            }
        })
    );

    // Move group to global
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.moveToGlobal', async (item: FileGroupTreeItem) => {
            if (item && item.itemType === 'group' && item.group && !item.group.isGlobal) {
                const confirmMessage = item.group.parentId
                    ? `Move "${item.group.name}" and all its contents to Global Groups? It will be available in all projects.`
                    : `Move "${item.group.name}" and all its child groups to Global Groups? It will be available in all projects.`;

                const confirm = await vscode.window.showWarningMessage(
                    confirmMessage,
                    { modal: true },
                    'Move to Global'
                );

                if (confirm === 'Move to Global') {
                    await storageService.updateGroupRecursive(item.group.id, { isGlobal: true });
                    await storageService.updateGroup(item.group.id, { parentId: undefined });
                    fileGroupsProvider.refresh();
                    void vscode.window.showInformationMessage(`"${item.group.name}" moved to Global Groups`);
                }
            }
        })
    );

    // Move group to local
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.moveToLocal', async (item: FileGroupTreeItem) => {
            if (item && item.itemType === 'group' && item.group && item.group.isGlobal) {
                const confirmMessage = item.group.parentId
                    ? `Move "${item.group.name}" and all its contents to Local Groups? It will only be available in this project.`
                    : `Move "${item.group.name}" and all its child groups to Local Groups? It will only be available in this project.`;

                const confirm = await vscode.window.showWarningMessage(
                    confirmMessage,
                    { modal: true },
                    'Move to Local'
                );

                if (confirm === 'Move to Local') {
                    await storageService.updateGroupRecursive(item.group.id, { isGlobal: false });
                    await storageService.updateGroup(item.group.id, { parentId: undefined });
                    fileGroupsProvider.refresh();
                    void vscode.window.showInformationMessage(`"${item.group.name}" moved to Local Groups`);
                }
            }
        })
    );

    // Duplicate group
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.duplicateGroup', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group' && item.group) {
                const newName = await vscode.window.showInputBox({
                    prompt: 'Enter name for the copy',
                    value: `${item.group.name} (Copy)`,
                    placeHolder: 'Copy name'
                });

                if (newName) {
                    // Create a deep copy of the group
                    const copyGroup: FileGroup = {
                        id: generateId(),
                        name: newName,
                        icon: item.group.icon,
                        color: item.group.color,
                        shortDescription: item.group.shortDescription,
                        details: item.group.details,
                        createdBy: CURRENT_USERNAME,
                        collapsed: false,
                        pinned: false,
                        badgeText: item.group.badgeText,
                        files: [...item.group.files], // Copy files array
                        sortOrder: item.group.sortOrder,
                        order: getAllStoredGroups().length,
                        parentId: item.group.parentId,
                        isGlobal: false // Copies are always local by default
                    };

                    await storageService.createGroup(copyGroup);
                    fileGroupsProvider.refresh();
                    void vscode.window.showInformationMessage(`Created copy: "${newName}"`);
                }
            }
        })
    );

    // Open global config file
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.openGlobalConfig', async () => {
            const globalConfigUri = vscode.Uri.joinPath(context.globalStorageUri, 'file-groups-global.json');

            try {
                // Ensure the directory exists
                await vscode.workspace.fs.createDirectory(context.globalStorageUri);

                // Check if file exists, if not create it
                try {
                    await vscode.workspace.fs.stat(globalConfigUri);
                } catch {
                    // File doesn't exist, create it with empty structure
                    const emptyConfig = {
                        version: 2,
                        groups: []
                    };
                    const content = Buffer.from(JSON.stringify(emptyConfig, null, 2), 'utf-8');
                    await vscode.workspace.fs.writeFile(globalConfigUri, content);
                }

                // Open the file
                const document = await vscode.workspace.openTextDocument(globalConfigUri);
                await vscode.window.showTextDocument(document);
            } catch (error) {
                void vscode.window.showErrorMessage(`Failed to open global config: ${error}`);
            }
        })
    );
}

// This method is called when your extension is deactivated
export function deactivate() { }
