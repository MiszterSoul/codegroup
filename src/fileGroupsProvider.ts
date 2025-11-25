import * as vscode from 'vscode';
import { FileGroup, FileGroupTreeItem, GroupFile } from './models';
import { StorageService } from './storageService';

/**
 * Tree data provider for file groups
 */
export class FileGroupsProvider implements vscode.TreeDataProvider<FileGroupTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<FileGroupTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private storageService: StorageService) {}

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
            // Root level - return all groups
            const groups = this.storageService.getGroups();
            return groups
                .sort((a, b) => a.order - b.order)
                .map(group => new FileGroupTreeItem('group', group));
        } else if (element.itemType === 'group') {
            // Group level - return files in the group
            return element.group.files.map(
                file => new FileGroupTreeItem('file', element.group, file)
            );
        }
        return [];
    }

    getParent(element: FileGroupTreeItem): FileGroupTreeItem | undefined {
        if (element.itemType === 'file') {
            return new FileGroupTreeItem('group', element.group);
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
    readonly dragMimeTypes = ['text/uri-list'];

    constructor(
        private storageService: StorageService,
        private provider: FileGroupsProvider
    ) {}

    /**
     * Handle drag start - export file URIs
     */
    handleDrag(
        source: readonly FileGroupTreeItem[],
        dataTransfer: vscode.DataTransfer,
        _token: vscode.CancellationToken
    ): void {
        // Export file URIs for files being dragged
        const files = source.filter(item => item.itemType === 'file' && item.file);
        if (files.length > 0) {
            const uris = files
                .map(item => vscode.Uri.file(item.file!.path).toString())
                .join('\r\n');
            dataTransfer.set('text/uri-list', new vscode.DataTransferItem(uris));
        }
        
        // Set internal drag data for reordering
        dataTransfer.set(
            'application/vnd.code.tree.filegroupsview',
            new vscode.DataTransferItem(source)
        );
    }

    /**
     * Handle drop - add files to groups or reorder
     */
    async handleDrop(
        target: FileGroupTreeItem | undefined,
        dataTransfer: vscode.DataTransfer,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Determine target group
        let targetGroup: FileGroup | undefined;
        
        if (target) {
            if (target.itemType === 'group') {
                targetGroup = target.group;
            } else if (target.itemType === 'file') {
                targetGroup = target.group;
            }
        }

        // Handle files dropped from explorer or tabs (text/uri-list)
        const uriListItem = dataTransfer.get('text/uri-list');
        if (uriListItem && targetGroup) {
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
                const files: GroupFile[] = uris.map(uri => ({
                    path: uri.fsPath,
                    name: uri.fsPath.split(/[/\\]/).pop() || 'unknown'
                }));

                const addedCount = await this.storageService.addFilesToGroup(targetGroup.id, files);
                if (addedCount > 0) {
                    this.provider.refresh();
                    vscode.window.showInformationMessage(
                        `Added ${addedCount} file(s) to "${targetGroup.name}"`
                    );
                } else {
                    vscode.window.showInformationMessage(
                        'All files are already in the group'
                    );
                }
            }
            return;
        }

        // Handle internal drag (reordering groups)
        const internalData = dataTransfer.get('application/vnd.code.tree.filegroupsview');
        if (internalData) {
            const items = internalData.value as FileGroupTreeItem[];
            
            // Check if we're reordering groups
            const draggedGroups = items.filter(item => item.itemType === 'group');
            if (draggedGroups.length > 0 && target?.itemType === 'group') {
                // Reorder groups
                const groups = this.storageService.getGroups().sort((a, b) => a.order - b.order);
                const draggedGroupIds = new Set(draggedGroups.map(g => g.group.id));
                const targetIndex = groups.findIndex(g => g.id === target.group.id);
                
                if (targetIndex !== -1) {
                    // Remove dragged groups
                    const remaining = groups.filter(g => !draggedGroupIds.has(g.id));
                    const dragged = groups.filter(g => draggedGroupIds.has(g.id));
                    
                    // Insert at new position
                    const newTargetIndex = remaining.findIndex(g => g.id === target.group.id);
                    remaining.splice(newTargetIndex, 0, ...dragged);
                    
                    // Update order
                    const newOrder = remaining.map(g => g.id);
                    await this.storageService.reorderGroups(newOrder);
                    this.provider.refresh();
                }
                return;
            }

            // Check if we're moving files between groups
            const draggedFiles = items.filter(item => item.itemType === 'file' && item.file);
            if (draggedFiles.length > 0 && targetGroup) {
                for (const item of draggedFiles) {
                    if (item.group.id !== targetGroup.id && item.file) {
                        // Remove from source group
                        await this.storageService.removeFileFromGroup(item.group.id, item.file.path);
                        // Add to target group
                        await this.storageService.addFileToGroup(targetGroup.id, item.file);
                    }
                }
                this.provider.refresh();
            }
        }
    }
}
