import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileGroup, FileGroupTreeItem, GroupFile } from './models';
import { StorageService } from './storageService';

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
    private sortFiles(files: GroupFile[], sortOrder?: string): GroupFile[] {
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
                sorted.sort((a, b) => {
                    try {
                        const aStat = fs.statSync(a.path);
                        const bStat = fs.statSync(b.path);
                        return aStat.mtime.getTime() - bStat.mtime.getTime();
                    } catch {
                        return 0;
                    }
                });
                break;
            case 'date-desc':
                sorted.sort((a, b) => {
                    try {
                        const aStat = fs.statSync(a.path);
                        const bStat = fs.statSync(b.path);
                        return bStat.mtime.getTime() - aStat.mtime.getTime();
                    } catch {
                        return 0;
                    }
                });
                break;
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

    getChildren(element?: FileGroupTreeItem): FileGroupTreeItem[] {
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

            // Add Global Groups section if there are any global groups
            const globalGroups = this.storageService.getGlobalGroups().filter(g => !g.parentId);
            if (globalGroups.length > 0) {
                items.push(new FileGroupTreeItem('section', null, undefined, true, 0, globalGroups.length, []));
            }

            return items;
        } else if (element.itemType === 'section') {
            // Global Groups section - return global root groups
            const globalGroups = this.storageService.getGlobalGroups().filter(g => !g.parentId);
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
            const sortedFiles = this.sortFiles(element.group.files, element.group.sortOrder);
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
        if (element.itemType === 'file' && element.group) {
            return new FileGroupTreeItem('group', element.group);
        }
        if (element.itemType === 'group' && element.group) {
            // If this is a global group at root level, parent is the section
            if (element.group.isGlobal && !element.group.parentId) {
                return new FileGroupTreeItem('section', null, undefined, true, 0, 0, []);
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
    ) {}

    /**
     * Set callback to be called when files are added (for decoration refresh)
     */
    setOnFilesAddedCallback(callback: (uris: vscode.Uri[]) => void): void {
        this.onFilesAddedCallback = callback;
    }

    /**
     * Handle drag start - export data for dragging
     */
    handleDrag(
        source: readonly FileGroupTreeItem[],
        dataTransfer: vscode.DataTransfer,
        _token: vscode.CancellationToken
    ): void {
        // Export file URIs for files being dragged (for external drops)
        const files = source.filter(item => item.itemType === 'file' && item.file);
        if (files.length > 0) {
            const uris = files
                .map(item => vscode.Uri.file(item.file!.path).toString())
                .join('\r\n');
            dataTransfer.set('text/uri-list', new vscode.DataTransferItem(uris));
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
            if (target.itemType === 'section') {
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
                vscode.window.showWarningMessage('Cannot move a group into its own subgroup');
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
        const groups = this.storageService.getGroups();
        let current = groups.find(g => g.id === potentialDescendantId);

        while (current && current.parentId) {
            if (current.parentId === ancestorId) {
                return true;
            }
            current = groups.find(g => g.id === current!.parentId);
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

        // Moving files between different groups
        let movedCount = 0;

        for (const item of draggedFiles) {
            if (item.file && item.group && item.group.id !== targetGroup.id) {
                // Remove from source group
                await this.storageService.removeFileFromGroup(item.group.id, item.file.path);
                // Add to target group
                const added = await this.storageService.addFileToGroup(targetGroup.id, item.file);
                if (added) {
                    movedCount++;
                }
            }
        }

        if (movedCount > 0) {
            this.provider.refresh();
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
            const quickPickItems: vscode.QuickPickItem[] = [
                { label: '$(add) Create New Global Group', description: 'Create a new group for these files' },
                { label: '', kind: vscode.QuickPickItemKind.Separator }
            ];

            // Add existing global groups
            globalGroups.filter(g => !g.parentId).forEach(g => {
                quickPickItems.push({
                    label: `$(${g.icon || 'folder'}) ${g.name}`,
                    description: `${g.files.length} ${g.files.length === 1 ? 'file' : 'files'}`
                });
            });

            const selection = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: 'Add to existing global group or create new?'
            });

            if (!selection) {
                return;
            }

            let targetGroup: FileGroup | undefined;

            if (selection.label.includes('Create New')) {
                // Create new global group
                const name = await vscode.window.showInputBox({
                    prompt: 'Enter global group name',
                    placeHolder: 'My Global Group'
                });

                if (!name) {
                    return;
                }

                const { generateId } = await import('./models.js');
                const { CURRENT_USERNAME } = await import('./userInfo.js');
                const groups = this.storageService.getGroups();
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
            } else {
                // Find the selected group
                const groupName = selection.label.replace(/^\$\([^)]+\)\s*/, '');
                targetGroup = globalGroups.find(g => g.name === groupName);
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
