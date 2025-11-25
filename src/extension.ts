import * as vscode from 'vscode';
import { FileGroup, FileGroupTreeItem, GroupFile, GROUP_ICONS, GROUP_COLORS, generateId } from './models';
import { StorageService } from './storageService';
import { FileGroupsProvider, FileGroupsDragDropController } from './fileGroupsProvider';

let storageService: StorageService;
let fileGroupsProvider: FileGroupsProvider;
let treeView: vscode.TreeView<FileGroupTreeItem>;

export function activate(context: vscode.ExtensionContext) {
    // Initialize services
    storageService = new StorageService(context);
    fileGroupsProvider = new FileGroupsProvider(storageService);

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
    // Create a new group
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
                    order: groups.length
                };
                await storageService.createGroup(newGroup);
                fileGroupsProvider.refresh();
                vscode.window.showInformationMessage(`Created group "${name}"`);
            }
        })
    );

    // Delete a group
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.deleteGroup', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group') {
                const confirm = await vscode.window.showWarningMessage(
                    `Delete group "${item.group.name}"?`,
                    { modal: true },
                    'Delete'
                );
                if (confirm === 'Delete') {
                    await storageService.deleteGroup(item.group.id);
                    fileGroupsProvider.refresh();
                }
            }
        })
    );

    // Rename a group
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.renameGroup', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group') {
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
            if (item?.itemType === 'group') {
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
            if (item?.itemType === 'group') {
                const colorItems = GROUP_COLORS.map(color => ({
                    label: color.label,
                    colorId: color.id
                }));

                const selected = await vscode.window.showQuickPick(colorItems, {
                    placeHolder: 'Select a color for the group'
                });

                if (selected) {
                    await storageService.updateGroup(item.group.id, { color: selected.colorId });
                    fileGroupsProvider.refresh();
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
                await storageService.removeFileFromGroup(item.group.id, item.file.path);
                fileGroupsProvider.refresh();
            }
        })
    );

    // Open all files in a group
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.openAll', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group') {
                const group = storageService.getGroup(item.group.id);
                if (group && group.files.length > 0) {
                    for (const file of group.files) {
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
                        `Opened ${group.files.length} file(s) from "${group.name}"`
                    );
                } else {
                    vscode.window.showInformationMessage('Group is empty');
                }
            }
        })
    );

    // Close all files in a group (only group files, not other tabs)
    context.subscriptions.push(
        vscode.commands.registerCommand('fileGroups.closeAll', async (item: FileGroupTreeItem) => {
            if (item?.itemType === 'group') {
                const group = storageService.getGroup(item.group.id);
                if (group && group.files.length > 0) {
                    const groupFilePaths = new Set(group.files.map(f => f.path));
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
                            `Closed ${closedCount} file(s) from "${group.name}"`
                        );
                    } else {
                        vscode.window.showInformationMessage(
                            `No open files from "${group.name}" to close`
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
