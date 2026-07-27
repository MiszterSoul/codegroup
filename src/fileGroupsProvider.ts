import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { countLabel, t } from './i18n';
import { FileGroup, FileGroupTreeItem, GroupFile, generateId } from './models';
import { StorageService } from './storageService';
import { CURRENT_USERNAME } from './userInfo';

/**
 * Recursively enumerate all files under a directory and call `addUri` for each.
 * Skips paths that can't be read.
 */
async function collectFilesFromDir(
    dirPath: string,
    addUri: (filePath: string) => void,
    token: vscode.CancellationToken
): Promise<void> {
    if (token.isCancellationRequested) {
        return;
    }

    try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (token.isCancellationRequested) {
                return;
            }

            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                await collectFilesFromDir(fullPath, addUri, token);
            } else {
                addUri(fullPath);
            }
        }
    } catch {
        // Unreadable directory — skip silently
    }
}

/**
 * Tree data provider for file groups with hierarchical support
 */
export class FileGroupsProvider implements vscode.TreeDataProvider<FileGroupTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<FileGroupTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private storageService: StorageService) {
        // Listen for storage changes (e.g., file changes)
        storageService.onDidChange(() => this.refresh());
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Sort files based on the sort order
     */
    private async sortFiles(files: GroupFile[], sortOrder?: string): Promise<GroupFile[]> {
        if (!sortOrder || sortOrder === 'manual') {
            return files;
        }

        const sorted = [...files];

        switch (sortOrder) {
            case 'name-asc':
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name-desc':
                sorted.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'date-asc':
            case 'date-desc': {
                const modifiedTimes = new Map<string, number>();
                await Promise.all(sorted.map(async (file) => {
                    try {
                        modifiedTimes.set(file.path, (await fs.promises.stat(file.path)).mtimeMs);
                    } catch {
                        modifiedTimes.set(file.path, 0);
                    }
                }));
                const direction = sortOrder === 'date-asc' ? 1 : -1;
                sorted.sort((a, b) => direction * (
                    (modifiedTimes.get(a.path) ?? 0) - (modifiedTimes.get(b.path) ?? 0)
                ));
                break;
            }
            case 'type':
                sorted.sort((a, b) => {
                    const aExt = path.extname(a.name).toLowerCase();
                    const bExt = path.extname(b.name).toLowerCase();
                    if (aExt === bExt) {
                        return a.name.localeCompare(b.name);
                    }
                    return aExt.localeCompare(bExt);
                });
                break;
        }

        return sorted;
    }

    getTreeItem(element: FileGroupTreeItem): vscode.TreeItem {
        return element;
    }

    private getQuickActionItems(): FileGroupTreeItem[] {
        return [
            new FileGroupTreeItem('action', null, undefined, false, 0, 0, [], undefined, {
                id: 'create-group',
                label: t('tree.action.createGroup.label'),
                description: t('tree.action.createGroup.description'),
                detail: t('tree.action.createGroup.detail'),
                iconId: 'add',
                command: {
                    command: 'fileGroups.createGroup',
                    title: t('tree.action.createGroup.label')
                }
            }),
            new FileGroupTreeItem('action', null, undefined, false, 0, 0, [], undefined, {
                id: 'quick-open',
                label: t('tree.action.quickOpen.label'),
                description: t('tree.action.quickOpen.description'),
                detail: t('tree.action.quickOpen.detail'),
                iconId: 'search',
                command: {
                    command: 'fileGroups.quickOpen',
                    title: t('tree.action.quickOpen.label')
                }
            }),
            new FileGroupTreeItem('action', null, undefined, false, 0, 0, [], undefined, {
                id: 'smart-groups',
                label: t('tree.action.smartGroups.label'),
                description: t('tree.action.smartGroups.description'),
                detail: t('tree.action.smartGroups.detail'),
                iconId: 'sparkle',
                command: {
                    command: 'fileGroups.createSmartGroups',
                    title: t('tree.action.smartGroups.label')
                }
            }),
            new FileGroupTreeItem('action', null, undefined, false, 0, 0, [], undefined, {
                id: 'open-editors',
                label: t('tree.action.openEditors.label'),
                description: t('tree.action.openEditors.description'),
                detail: t('tree.action.openEditors.detail'),
                iconId: 'files',
                command: {
                    command: 'fileGroups.createGroupFromOpenEditors',
                    title: t('tree.action.openEditors.label')
                }
            }),
            new FileGroupTreeItem('action', null, undefined, false, 0, 0, [], undefined, {
                id: 'git-changes',
                label: t('tree.action.gitChanges.label'),
                description: t('tree.action.gitChanges.description'),
                detail: t('tree.action.gitChanges.detail'),
                iconId: 'source-control',
                command: {
                    command: 'fileGroups.createGroupFromGitChanges',
                    title: t('tree.action.gitChanges.label')
                }
            }),
            new FileGroupTreeItem('action', null, undefined, false, 0, 0, [], undefined, {
                id: 'import-shared',
                label: t('tree.action.importShared.label'),
                description: t('tree.action.importShared.description'),
                detail: t('tree.action.importShared.detail'),
                iconId: 'cloud-download',
                command: {
                    command: 'fileGroups.importSharedGroup',
                    title: t('tree.action.importShared.label')
                }
            }),
            new FileGroupTreeItem('action', null, undefined, false, 0, 0, [], undefined, {
                id: 'change-language',
                label: t('tree.action.changeLanguage.label'),
                description: t('tree.action.changeLanguage.description'),
                detail: t('tree.action.changeLanguage.detail'),
                iconId: 'globe',
                command: {
                    command: 'fileGroups.changeLanguage',
                    title: t('tree.action.changeLanguage.label')
                }
            })
        ];
    }

    async getChildren(element?: FileGroupTreeItem): Promise<FileGroupTreeItem[]> {
        if (!element) {
            // Root level - show local groups and global groups section
            const items: FileGroupTreeItem[] = [];

            // Get local root groups (not global, no parent)
            const localGroups = this.storageService.getRootGroups().filter(g => !g.isGlobal);

            // Add local groups
            items.push(...localGroups
                .sort((a, b) => {
                    // Pinned groups first
                    if (a.pinned && !b.pinned) { return -1; }
                    if (!a.pinned && b.pinned) { return 1; }
                    // Then by order
                    return a.order - b.order;
                })
                .map(group => {
                    const subgroups = this.storageService.getSubgroups(group.id);
                    const hasSubgroups = subgroups.length > 0;
                    const allFiles = this.storageService.getAllFilesInGroup(group.id);
                    return new FileGroupTreeItem('group', group, undefined, hasSubgroups, subgroups.length, allFiles.length, allFiles);
                })
            );

            // Add Global Groups section only when global groups are visible in this workspace.
            const globalGroups = this.storageService.getGroups().filter(g => g.isGlobal && !g.parentId);
            if (globalGroups.length > 0) {
                items.push(new FileGroupTreeItem('section', null, undefined, true, 0, globalGroups.length, [], 'global'));
            }

            items.push(new FileGroupTreeItem('section', null, undefined, true, 0, 0, [], 'actions'));

            return items;
        } else if (element.itemType === 'section') {
            if (element.sectionKind === 'actions') {
                return this.getQuickActionItems();
            }

            // Global Groups section - return visible global root groups.
            const globalGroups = this.storageService.getGroups().filter(g => g.isGlobal && !g.parentId);
            return globalGroups
                .sort((a, b) => {
                    if (a.pinned && !b.pinned) { return -1; }
                    if (!a.pinned && b.pinned) { return 1; }
                    return a.order - b.order;
                })
                .map(group => {
                    const subgroups = this.storageService.getSubgroups(group.id);
                    const hasSubgroups = subgroups.length > 0;
                    const allFiles = this.storageService.getAllFilesInGroup(group.id);
                    return new FileGroupTreeItem('group', group, undefined, hasSubgroups, subgroups.length, allFiles.length, allFiles);
                });
        } else if (element.itemType === 'group' && element.group) {
            // Group level - return child groups first, then files
            const items: FileGroupTreeItem[] = [];

            // Add child groups
            const childGroups = this.storageService.getSubgroups(element.group.id);
            childGroups.sort((a, b) => {
                // Pinned groups first
                if (a.pinned && !b.pinned) { return -1; }
                if (!a.pinned && b.pinned) { return 1; }
                return a.order - b.order;
            }).forEach(childGroup => {
                const childSubgroups = this.storageService.getSubgroups(childGroup.id);
                const hasChildren = childSubgroups.length > 0;
                const allFiles = this.storageService.getAllFilesInGroup(childGroup.id);
                items.push(new FileGroupTreeItem('group', childGroup, undefined, hasChildren, childSubgroups.length, allFiles.length, allFiles));
            });

            // Add files
            const sortedFiles = await this.sortFiles(element.group.files, element.group.sortOrder);
            sortedFiles.forEach(file => {
                items.push(new FileGroupTreeItem('file', element.group!, file));
            });

            return items;
        }
        return [];
    }

    getParent(element: FileGroupTreeItem): FileGroupTreeItem | undefined {
        if (element.itemType === 'section') {
            return undefined;
        }
        if (element.itemType === 'action') {
            return new FileGroupTreeItem('section', null, undefined, true, 0, 0, [], 'actions');
        }
        if (element.itemType === 'file' && element.group) {
            return new FileGroupTreeItem('group', element.group);
        }
        if (element.itemType === 'group' && element.group) {
            // If this is a global group at root level, parent is the section
            if (element.group.isGlobal && !element.group.parentId) {
                return new FileGroupTreeItem('section', null, undefined, true, 0, 0, [], 'global');
            }
            // Otherwise check for parent group
            if (element.group.parentId) {
                const parent = this.storageService.getGroup(element.group.parentId);
                if (parent) {
                    return new FileGroupTreeItem('group', parent);
                }
            }
        }
        return undefined;
    }
}

/**
 * Drag and drop controller for file groups
 */
export class FileGroupsDragDropController implements vscode.TreeDragAndDropController<FileGroupTreeItem> {
    // Accept drops from VS Code explorer (text/uri-list) and internal tree
    readonly dropMimeTypes = [
        'application/vnd.code.tree.filegroupsview',
        'text/uri-list'
    ];

    // We can drag items from this tree
    readonly dragMimeTypes = [
        'application/vnd.code.tree.filegroupsview',
        'text/uri-list'
    ];

    private onFilesAddedCallback?: (uris: vscode.Uri[]) => void;

    constructor(
        private storageService: StorageService,
        private provider: FileGroupsProvider
    ) { }

    /**
     * Set callback to be called when files are added (for decoration refresh)
     */
    setOnFilesAddedCallback(callback: (uris: vscode.Uri[]) => void): void {
        this.onFilesAddedCallback = callback;
    }

    /**
     * Handle drag start - export data for dragging
     */
    async handleDrag(
        source: readonly FileGroupTreeItem[],
        dataTransfer: vscode.DataTransfer,
        token: vscode.CancellationToken
    ): Promise<void> {
        // Collect file URIs to export.
        // Keep URI formatting canonical (`toString`) to match built-in explorer/editor drags.
        const uriSet = new Set<string>();

        const addFile = (filePath: string) => {
            uriSet.add(vscode.Uri.file(filePath).toString());
        };

        for (const item of source) {
            if (item.itemType === 'file' && item.file) {
                if (item.file.isDirectory) {
                    // Saved-folder entry: enumerate immediate children and add each file
                    await collectFilesFromDir(item.file.path, addFile, token);
                } else {
                    addFile(item.file.path);
                }
            } else if (item.itemType === 'group' && item.group) {
                const allFiles = this.storageService.getAllFilesInGroup(item.group.id);
                for (const file of allFiles) {
                    if (file.isDirectory) {
                        await collectFilesFromDir(file.path, addFile, token);
                    } else {
                        addFile(file.path);
                    }
                }
            }
        }

        if (uriSet.size > 0) {
            const uris = [...uriSet];
            const uriListText = uris.join('\r\n');

            // Standard external drop channel used by explorer/editor drags.
            dataTransfer.set('text/uri-list', new vscode.DataTransferItem(uriListText));

            // VS Code internal drag channels consumed by workbench/editor/chat drop handlers.
            // Keep payload shape minimal and URI-based to mirror built-in file dragging semantics.
            dataTransfer.set('ResourceURLs', new vscode.DataTransferItem(uriListText));
            dataTransfer.set(
                'CodeEditors',
                new vscode.DataTransferItem(
                    JSON.stringify(uris.map(uri => ({ resource: uri })))
                )
            );
            dataTransfer.set(
                'CodeFiles',
                new vscode.DataTransferItem(
                    JSON.stringify(uris.map(uri => vscode.Uri.parse(uri).fsPath))
                )
            );
        }

        // Set internal drag data for all operations (groups, subgroups, files)
        dataTransfer.set(
            'application/vnd.code.tree.filegroupsview',
            new vscode.DataTransferItem(source)
        );
    }

    /**
     * Handle drop - add files to groups, move groups, or reorder
     */
    async handleDrop(
        target: FileGroupTreeItem | undefined,
        dataTransfer: vscode.DataTransfer,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Determine target group and file (works for both group and subgroup)
        let targetGroup: FileGroup | undefined;
        let targetFile: GroupFile | undefined;
        let isGlobalSection = false;

        if (target) {
            if (target.itemType === 'section' && target.sectionKind === 'global') {
                // Dropping on Global Groups section - files/groups should become global
                isGlobalSection = true;
            } else if (target.itemType === 'group') {
                targetGroup = target.group!;
            } else if (target.itemType === 'file') {
                targetGroup = target.group!;
                targetFile = target.file;
            }
        }

        // Handle internal drag first (groups, subgroups, files within the tree)
        const internalData = dataTransfer.get('application/vnd.code.tree.filegroupsview');
        if (internalData) {
            const items = internalData.value as FileGroupTreeItem[];

            // Check if we're dragging groups
            const draggedGroups = items.filter(item => item.itemType === 'group');
            if (draggedGroups.length > 0) {
                // If dropped on global section, move to global
                if (isGlobalSection) {
                    for (const draggedItem of draggedGroups) {
                        // Recursively update the group and all its children
                        await this.storageService.updateGroupRecursive(draggedItem.group!.id, {
                            isGlobal: true
                        });
                        // Set the root group to have no parent
                        await this.storageService.updateGroup(draggedItem.group!.id, {
                            parentId: undefined
                        });
                    }
                    this.provider.refresh();
                    return;
                }
                // If dropped on empty space (no target), move to root level
                // If dropped on a group/subgroup, make it a child
                await this.handleGroupDrop(draggedGroups, target);
                return;
            }

            // Check if we're moving or reordering files
            const draggedFiles = items.filter(item => item.itemType === 'file' && item.file);
            if (draggedFiles.length > 0 && targetGroup) {
                await this.handleFileDrop(draggedFiles, targetGroup, targetFile);
                return;
            }
        }

        // Handle files dropped from explorer or tabs (text/uri-list)
        const uriListItem = dataTransfer.get('text/uri-list');
        if (uriListItem) {
            // If dropped on global section, create a new global group
            if (isGlobalSection) {
                await this.handleExternalFileDropToGlobal(uriListItem);
                return;
            }
            // Otherwise add to target group if any
            if (targetGroup) {
                await this.handleExternalFileDrop(uriListItem, targetGroup);
            }
        }
    }

    /**
     * Handle dropping groups onto other groups (make subgroup) or onto empty space (move to root)
     */
    private async handleGroupDrop(draggedGroups: FileGroupTreeItem[], target: FileGroupTreeItem | undefined): Promise<void> {
        // If target is undefined, move dragged groups to root level
        if (!target) {
            for (const draggedItem of draggedGroups) {
                const draggedGroup = draggedItem.group;

                if (!draggedGroup) {
                    continue;
                }

                // Dropping on empty space means local root
                if (draggedGroup.isGlobal) {
                    await this.storageService.updateGroupRecursive(draggedGroup.id, { isGlobal: false });
                }

                if (draggedGroup.parentId) {
                    await this.storageService.updateGroup(draggedGroup.id, { parentId: undefined });
                }
            }
            this.provider.refresh();
            return;
        }

        const targetGroup = target.itemType === 'group' ? target.group : null;

        if (!targetGroup) {
            return;
        }

        for (const draggedItem of draggedGroups) {
            const draggedGroup = draggedItem.group;

            if (!draggedGroup) {
                continue;
            }

            // Don't drop on self
            if (draggedGroup.id === targetGroup.id) {
                continue;
            }

            // Don't drop a parent onto its own child (would create a cycle)
            if (this.isDescendant(targetGroup.id, draggedGroup.id)) {
                vscode.window.showWarningMessage(t('dragDrop.moveIntoSelf'));
                continue;
            }

            // Move between local/global storage if needed
            if (targetGroup.isGlobal !== draggedGroup.isGlobal) {
                await this.storageService.updateGroupRecursive(draggedGroup.id, {
                    isGlobal: targetGroup.isGlobal
                });
            }

            // Make the dragged group a child of the target
            await this.storageService.updateGroup(draggedGroup.id, {
                parentId: targetGroup.id
            });
        }

        this.provider.refresh();
    }

    /**
     * Check if potentialDescendant is a descendant of ancestorId
     */
    private isDescendant(potentialDescendantId: string, ancestorId: string): boolean {
        const groupsById = new Map(this.storageService.getAllGroups().map(group => [group.id, group]));
        const visitedIds = new Set<string>();
        let current = groupsById.get(potentialDescendantId);

        while (current?.parentId && !visitedIds.has(current.id)) {
            if (current.parentId === ancestorId) {
                return true;
            }

            visitedIds.add(current.id);
            current = groupsById.get(current.parentId);
        }

        return false;
    }

    /**
     * Handle dropping files between groups or reordering within a group
     */
    private async handleFileDrop(draggedFiles: FileGroupTreeItem[], targetGroup: FileGroup, targetFile?: GroupFile): Promise<void> {
        // Check if we're reordering within the same group
        if (draggedFiles.length === 1 && draggedFiles[0].group && draggedFiles[0].group.id === targetGroup.id && draggedFiles[0].file) {
            // Reorder within the same group
            const draggedFile = draggedFiles[0].file;
            await this.storageService.reorderFilesInGroup(
                targetGroup.id,
                draggedFile.path,
                targetFile?.path || null
            );
            this.provider.refresh();
            return;
        }

        // Moving files between different groups. Add first so a duplicate or stale target
        // never causes the source entry to be removed.
        const movedUris: vscode.Uri[] = [];

        for (const item of draggedFiles) {
            if (item.file && item.group && item.group.id !== targetGroup.id) {
                const added = await this.storageService.addFileToGroup(targetGroup.id, item.file);
                if (added) {
                    await this.storageService.removeFileFromGroup(item.group.id, item.file.path);
                    movedUris.push(vscode.Uri.file(item.file.path));
                }
            }
        }

        if (movedUris.length > 0) {
            this.provider.refresh();
            this.onFilesAddedCallback?.(movedUris);
        }
    }

    /**
     * Handle files dropped from external sources (explorer, tabs)
     */
    private async handleExternalFileDrop(uriListItem: vscode.DataTransferItem, targetGroup: FileGroup): Promise<void> {
        const uriListValue = await uriListItem.asString();
        const uris = uriListValue
            .split(/[\r\n]+/)
            .filter(line => line.trim().length > 0)
            .map(line => {
                try {
                    return vscode.Uri.parse(line.trim());
                } catch {
                    return null;
                }
            })
            .filter((uri): uri is vscode.Uri => uri !== null && uri.scheme === 'file');

        if (uris.length > 0) {
            const files: GroupFile[] = [];

            for (const uri of uris) {
                let isDirectory = false;
                try {
                    const stat = await vscode.workspace.fs.stat(uri);
                    isDirectory = (stat.type & vscode.FileType.Directory) !== 0;
                } catch {
                    // If stat fails, assume it's a file
                }

                files.push({
                    path: uri.fsPath,
                    name: uri.fsPath.split(/[/\\]/).pop() || 'unknown',
                    isDirectory
                });
            }

            const addedCount = await this.storageService.addFilesToGroup(targetGroup.id, files);
            if (addedCount > 0) {
                this.provider.refresh();
                // Trigger decoration refresh for added files
                if (this.onFilesAddedCallback) {
                    this.onFilesAddedCallback(uris);
                }
            }
        }
    }

    /**
     * Handle files dropped from external sources onto the Global Groups section
     */
    private async handleExternalFileDropToGlobal(uriListItem: vscode.DataTransferItem): Promise<void> {
        const uriListValue = await uriListItem.asString();
        const uris = uriListValue
            .split(/[\r\n]+/)
            .filter(line => line.trim().length > 0)
            .map(line => {
                try {
                    return vscode.Uri.parse(line.trim());
                } catch {
                    return null;
                }
            })
            .filter((uri): uri is vscode.Uri => uri !== null && uri.scheme === 'file');

        if (uris.length > 0) {
            // Ask user to name the new global group or select existing
            const globalGroups = this.storageService.getGlobalGroups();
            type GlobalGroupPickItem = vscode.QuickPickItem & {
                action?: 'create';
                groupId?: string;
            };
            const quickPickItems: GlobalGroupPickItem[] = [
                {
                    label: t('dragDrop.global.createNew'),
                    description: t('dragDrop.global.createNew.description'),
                    action: 'create'
                },
                { label: '', kind: vscode.QuickPickItemKind.Separator }
            ];

            // Stable IDs keep localized labels and duplicate group names safe.
            globalGroups.filter(g => !g.parentId).forEach(g => {
                quickPickItems.push({
                    label: `$(${g.icon || 'folder'}) ${g.name}`,
                    description: countLabel(g.files.length, 'noun.file.one', 'noun.file.other'),
                    groupId: g.id
                });
            });

            const selection = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: t('dragDrop.global.pick')
            });

            if (!selection) {
                return;
            }

            let targetGroup: FileGroup | undefined;

            if (selection.action === 'create') {
                // Create new global group
                const name = await vscode.window.showInputBox({
                    prompt: t('dragDrop.global.name.prompt'),
                    placeHolder: t('dragDrop.global.name.placeholder')
                });

                if (!name) {
                    return;
                }

                const groups = this.storageService.getAllGroups();
                targetGroup = {
                    id: generateId(),
                    name,
                    icon: 'globe',
                    color: 'charts.blue',
                    files: [],
                    order: groups.length,
                    parentId: undefined,
                    createdBy: CURRENT_USERNAME,
                    collapsed: false,
                    isGlobal: true
                };
                await this.storageService.createGroup(targetGroup);
            } else if (selection.groupId) {
                targetGroup = globalGroups.find(g => g.id === selection.groupId);
            }

            if (targetGroup) {
                const files: GroupFile[] = [];

                for (const uri of uris) {
                    let isDirectory = false;
                    try {
                        const stat = await vscode.workspace.fs.stat(uri);
                        isDirectory = (stat.type & vscode.FileType.Directory) !== 0;
                    } catch {
                        // If stat fails, assume it's a file
                    }

                    files.push({
                        path: uri.fsPath,
                        name: uri.fsPath.split(/[/\\]/).pop() || 'unknown',
                        isDirectory
                    });
                }

                const addedCount = await this.storageService.addFilesToGroup(targetGroup.id, files);
                if (addedCount > 0) {
                    this.provider.refresh();
                    // Trigger decoration refresh for added files
                    if (this.onFilesAddedCallback) {
                        this.onFilesAddedCallback(uris);
                    }
                }
            }
        }
    }
}
