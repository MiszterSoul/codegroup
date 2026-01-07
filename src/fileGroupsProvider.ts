import * as vscode from 'vscode';
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

    getTreeItem(element: FileGroupTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FileGroupTreeItem): FileGroupTreeItem[] {
        if (!element) {
            // Root level - return root groups (groups without parentId)
            const groups = this.storageService.getRootGroups();
            return groups
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
                });
        } else if (element.itemType === 'group' || element.itemType === 'subgroup') {
            // Group level - return subgroups first, then files
            const items: FileGroupTreeItem[] = [];

            // Add subgroups
            const subgroups = this.storageService.getSubgroups(element.group.id);
            subgroups.sort((a, b) => {
                // Pinned subgroups first
                if (a.pinned && !b.pinned) { return -1; }
                if (!a.pinned && b.pinned) { return 1; }
                return a.order - b.order;
            }).forEach(subgroup => {
                const childSubgroups = this.storageService.getSubgroups(subgroup.id);
                const hasChildren = childSubgroups.length > 0;
                const allFiles = this.storageService.getAllFilesInGroup(subgroup.id);
                items.push(new FileGroupTreeItem('subgroup', subgroup, undefined, hasChildren, childSubgroups.length, allFiles.length, allFiles));
            });

            // Add files
            element.group.files.forEach(file => {
                items.push(new FileGroupTreeItem('file', element.group, file));
            });

            return items;
        }
        return [];
    }

    getParent(element: FileGroupTreeItem): FileGroupTreeItem | undefined {
        if (element.itemType === 'file') {
            return new FileGroupTreeItem('group', element.group);
        }
        if ((element.itemType === 'group' || element.itemType === 'subgroup') && element.group.parentId) {
            const parent = this.storageService.getGroup(element.group.parentId);
            if (parent) {
                return new FileGroupTreeItem(parent.parentId ? 'subgroup' : 'group', parent);
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

        if (target) {
            if (target.itemType === 'group' || target.itemType === 'subgroup') {
                targetGroup = target.group;
            } else if (target.itemType === 'file') {
                targetGroup = target.group;
                targetFile = target.file;
            }
        }

        // Handle internal drag first (groups, subgroups, files within the tree)
        const internalData = dataTransfer.get('application/vnd.code.tree.filegroupsview');
        if (internalData) {
            const items = internalData.value as FileGroupTreeItem[];

            // Check if we're dragging groups/subgroups
            const draggedGroups = items.filter(item => item.itemType === 'group' || item.itemType === 'subgroup');
            if (draggedGroups.length > 0) {
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

        // Handle files dropped from explorer or tabs (text/uri-list) - only if no internal data handled it
        const uriListItem = dataTransfer.get('text/uri-list');
        if (uriListItem && targetGroup) {
            await this.handleExternalFileDrop(uriListItem, targetGroup);
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

                // Only move if it's currently a subgroup
                if (draggedGroup.parentId) {
                    await this.storageService.updateGroup(draggedGroup.id, {
                        parentId: undefined
                    });
                }
            }
            this.provider.refresh();
            return;
        }

        const targetGroup = target.itemType === 'group' || target.itemType === 'subgroup' ? target.group : null;

        if (!targetGroup) {
            return;
        }

        for (const draggedItem of draggedGroups) {
            const draggedGroup = draggedItem.group;

            // Don't drop on self
            if (draggedGroup.id === targetGroup.id) {
                continue;
            }

            // Don't drop a parent onto its own child (would create a cycle)
            if (this.isDescendant(targetGroup.id, draggedGroup.id)) {
                vscode.window.showWarningMessage('Cannot move a group into its own subgroup');
                continue;
            }

            // Make the dragged group a subgroup of the target
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
        if (draggedFiles.length === 1 && draggedFiles[0].group.id === targetGroup.id && draggedFiles[0].file) {
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
            if (item.file && item.group.id !== targetGroup.id) {
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
}
