import * as vscode from 'vscode';
import { FileGroup, FileGroupTreeItem, GroupFile, GROUP_ICONS, GROUP_COLORS, generateId, isHexColor } from './models';
import { CURRENT_USERNAME } from './userInfo';
import { StorageService } from './storageService';
import { FileGroupsProvider, FileGroupsDragDropController } from './fileGroupsProvider';
import { FileGroupDecorationProvider } from './fileDecorationProvider';

let storageService: StorageService;
let fileGroupsProvider: FileGroupsProvider;
let fileDecorationProvider: FileGroupDecorationProvider;
let treeView: vscode.TreeView<FileGroupTreeItem>;

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
            `Found ${missingCount} missing file(s) in your groups. Would you like to clean them up?`,
            'Clean Up',
            'Ignore'
        );

        if (action === 'Clean Up') {
            await vscode.commands.executeCommand('fileGroups.cleanupMissingFiles');
        }
    }
}

export async function activate(context: vscode.ExtensionContext) {
    // Initialize services
    storageService = new StorageService(context);

    // Try to load from file first
    await storageService.loadFromFile();

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
        treeView.onDidCollapseElement((event) => {
            if (event.element.itemType === 'group' || event.element.itemType === 'subgroup') {
                void storageService.updateGroup(event.element.group.id, { collapsed: true });
            }
        })
    );

    context.subscriptions.push(
        treeView.onDidExpandElement((event) => {
            if (event.element.itemType === 'group' || event.element.itemType === 'subgroup') {
                void storageService.updateGroup(event.element.group.id, { collapsed: false });
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
    if (initialItem && (initialItem.itemType === 'group' || initialItem.itemType === 'subgroup')) {
        return initialItem.group;
    }

    const groups = storageService.getGroups();
    if (groups.length === 0) {
        vscode.window.showInformationMessage('No groups available');
        return undefined;
    }

    const groupItems = groups.map(g => ({
        label: `$(${g.icon || 'folder'}) ${g.name}`,
        description: g.parentId ? '(subgroup)' : '',
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
    // Create a new root group
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.createGroup', async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter group name',
                placeHolder: 'My Group'
            });

            if (name) {
                const groups = storageService.getGroups();
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

    // Create a subgroup under an existing group
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.createSubgroup', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group' || item?.itemType === 'subgroup') {
                const name = await vscode.window.showInputBox({
                    prompt: `Enter subgroup name (under "${item.group.name}")`,
                    placeHolder: 'My Subgroup'
                });

                if (name) {
                    const groups = storageService.getGroups();
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

    // Delete a group (with confirmation for subgroups)
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.deleteGroup', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group' || item?.itemType === 'subgroup') {
                const subgroups = storageService.getSubgroups(item.group.id);
                const message = subgroups.length > 0
                    ? `Delete group "${item.group.name}" and ${subgroups.length} subgroup(s)?`
                    : `Delete group "${item.group.name}"?`;

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
                description: g.parentId ? '(subgroup)' : '',
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

    // Move a subgroup to root level
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.moveToRoot', async (item: FileGroupTreeItem) => {
            if ((item?.itemType === 'group' || item?.itemType === 'subgroup') && item.group.parentId) {
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
            if (item?.itemType === 'group' || item?.itemType === 'subgroup') {
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
            if (item?.itemType === 'group' || item?.itemType === 'subgroup') {
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
            if (item?.itemType === 'group' || item?.itemType === 'subgroup') {
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
                    // Refresh decorations for all files in this group and subgroups
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
                        name: fileUri.fsPath.split(/[/\\]/).pop() || 'unknown',
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
                const item = new FileGroupTreeItem(group.parentId ? 'subgroup' : 'group', group);
                await treeView.reveal(item, { focus: true, select: true, expand: true });
                return;
            }

            // If multiple groups, let user choose
            const groupItems = groupsWithFile.map(g => ({
                label: `$(${g.icon || 'folder'}) ${g.name}`,
                description: g.parentId ? '(subgroup)' : '',
                group: g
            }));

            const selected = await vscode.window.showQuickPick(groupItems, {
                placeHolder: `This file is in ${groupsWithFile.length} groups. Select one to reveal:`
            });

            if (selected) {
                const item = new FileGroupTreeItem(selected.group.parentId ? 'subgroup' : 'group', selected.group);
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
                if (fileItem.file) {
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

    // Open all files in a group (including subgroups)
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.openAll', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group' || item?.itemType === 'subgroup') {
                // Get all files including from subgroups
                const allFiles = storageService.getAllFilesInGroup(item.group.id);

                if (allFiles.length > 0) {
                    for (const file of allFiles) {
                        try {
                            const uri = vscode.Uri.file(file.path);
                            await vscode.window.showTextDocument(uri, {
                                preview: false,
                                preserveFocus: true
                            });
                        } catch (error) {
                            // Could not open file, skip silently
                        }
                    }
                }
            }
        })
    );

    // Close all files in a group (including subgroups, only group files, not other tabs)
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.closeAll', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group' || item?.itemType === 'subgroup') {
                // Get all files including from subgroups
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
}

// This method is called when your extension is deactivated
export function deactivate() {}
