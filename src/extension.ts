import * as vscode from 'vscode';
import { FileGroup, FileGroupTreeItem, GroupFile, GROUP_ICONS, GROUP_COLORS, generateId, isHexColor } from './models';
import { StorageService } from './storageService';
import { FileGroupsProvider, FileGroupsDragDropController } from './fileGroupsProvider';
import { FileGroupDecorationProvider } from './fileDecorationProvider';

let storageService: StorageService;
let fileGroupsProvider: FileGroupsProvider;
let fileDecorationProvider: FileGroupDecorationProvider;
let treeView: vscode.TreeView<FileGroupTreeItem>;

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

    treeView = vscode.window.createTreeView('fileGroupsView', {
        treeDataProvider: fileGroupsProvider,
        dragAndDropController: dragDropController,
        canSelectMany: true
    });

    context.subscriptions.push(treeView);

    // Register all commands
    registerCommands(context);
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
                    parentId: undefined
                };
                await storageService.createGroup(newGroup);
                fileGroupsProvider.refresh();
                vscode.window.showInformationMessage(`Created group "${name}"`);
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
                        parentId: item.group.id
                    };
                    await storageService.createGroup(newGroup);
                    fileGroupsProvider.refresh();
                    vscode.window.showInformationMessage(`Created subgroup "${name}"`);
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
                vscode.window.showInformationMessage(`Moved "${item.group.name}" to root level`);
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
                description: `${g.files.length} files`,
                groupId: g.id
            }));

            const selected = await vscode.window.showQuickPick(groupItems, {
                placeHolder: `Select group to add ${filesToAdd.length} file(s)`
            });

            if (selected) {
                const files: GroupFile[] = filesToAdd.map(fileUri => ({
                    path: fileUri.fsPath,
                    name: fileUri.fsPath.split(/[/\\]/).pop() || 'unknown'
                }));

                const addedCount = await storageService.addFilesToGroup(selected.groupId, files);
                fileGroupsProvider.refresh();
                // Refresh decorations for added files
                fileDecorationProvider.refresh(filesToAdd);

                if (addedCount > 0) {
                    vscode.window.showInformationMessage(
                        `Added ${addedCount} file(s) to group`
                    );
                } else {
                    vscode.window.showInformationMessage(
                        'All files are already in the group'
                    );
                }
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

    // Remove file from group
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.removeFile', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'file' && item.file) {
                const fileUri = vscode.Uri.file(item.file.path);
                await storageService.removeFileFromGroup(item.group.id, item.file.path);
                fileGroupsProvider.refresh();
                // Refresh decoration for removed file
                fileDecorationProvider.refresh([fileUri]);
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
                            vscode.window.showWarningMessage(`Could not open: ${file.name}`);
                        }
                    }
                    vscode.window.showInformationMessage(
                        `Opened ${allFiles.length} file(s) from "${item.group.name}"`
                    );
                } else {
                    vscode.window.showInformationMessage('Group is empty');
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
                    let closedCount = 0;

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
                                        closedCount++;
                                    } catch {
                                        // Tab might already be closed
                                    }
                                }
                            }
                        }
                    }

                    if (closedCount > 0) {
                        vscode.window.showInformationMessage(
                            `Closed ${closedCount} file(s) from "${item.group.name}"`
                        );
                    } else {
                        vscode.window.showInformationMessage(
                            `No open files from "${item.group.name}" to close`
                        );
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
}

// This method is called when your extension is deactivated
export function deactivate() {}
