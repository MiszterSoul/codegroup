import * as vscode from 'vscode';
import { FileGroup, GroupFile, FileGroupsConfig } from './models';

const STORAGE_KEY = 'fileGroups';
const CONFIG_FILE_NAME = '.vscode/file-groups.json';
const GLOBAL_STORAGE_KEY = 'globalFileGroups';
const GLOBAL_CONFIG_FILE_NAME = 'file-groups-global.json';

/**
 * Service for persisting file groups to workspace state and file
 */
export class StorageService {
    private _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;

    constructor(private context: vscode.ExtensionContext) {
        // Watch for file changes if workspace is open
        this.setupFileWatcher();
        this.setupGlobalFileWatcher();
    }

    private setupFileWatcher(): void {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const pattern = new vscode.RelativePattern(workspaceFolders[0], CONFIG_FILE_NAME);
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);

            watcher.onDidChange(() => this._onDidChange.fire());
            watcher.onDidCreate(() => this._onDidChange.fire());
            watcher.onDidDelete(() => this._onDidChange.fire());
        }
    }

    /**
     * Setup watcher for global groups file in appdata
     */
    private setupGlobalFileWatcher(): void {
        const globalConfigUri = this.getGlobalConfigFileUri();
        if (globalConfigUri) {
            const pattern = new vscode.RelativePattern(
                vscode.Uri.joinPath(globalConfigUri, '..'),
                GLOBAL_CONFIG_FILE_NAME
            );
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);

            watcher.onDidChange(() => this._onDidChange.fire());
            watcher.onDidCreate(() => this._onDidChange.fire());
            watcher.onDidDelete(() => this._onDidChange.fire());
        }
    }

    /**
     * Get the global config file URI (in extension global storage)
     */
    private getGlobalConfigFileUri(): vscode.Uri | undefined {
        try {
            return vscode.Uri.joinPath(this.context.globalStorageUri, GLOBAL_CONFIG_FILE_NAME);
        } catch {
            return undefined;
        }
    }

    /**
     * Get the config file URI
     */
    private getConfigFileUri(): vscode.Uri | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return vscode.Uri.joinPath(workspaceFolders[0].uri, CONFIG_FILE_NAME);
        }
        return undefined;
    }

    /**
     * Check if global groups should be hidden in current workspace
     */
    private shouldHideGlobalGroups(): boolean {
        const configUri = this.getConfigFileUri();
        if (!configUri) {
            return false;
        }

        try {
            const config = this.context.workspaceState.get<FileGroupsConfig>('fileGroupsConfig');
            return config?.hideGlobalGroups ?? false;
        } catch {
            return false;
        }
    }

    /**
     * Set whether to hide global groups in current workspace
     */
    async setHideGlobalGroups(hide: boolean): Promise<void> {
        const configUri = this.getConfigFileUri();
        if (!configUri) {
            return;
        }

        // Update local config
        const config = this.context.workspaceState.get<FileGroupsConfig>('fileGroupsConfig') || {
            version: 2,
            groups: []
        };
        config.hideGlobalGroups = hide;
        await this.context.workspaceState.update('fileGroupsConfig', config);

        // Save to file
        await this.saveConfigToFile(config);
        this._onDidChange.fire();
    }

    /**
     * Save config to file
     */
    private async saveConfigToFile(config: Partial<FileGroupsConfig>): Promise<void> {
        const configUri = this.getConfigFileUri();
        if (!configUri) {
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            return;
        }

        try {
            // Load existing config if any
            let existingConfig: FileGroupsConfig = { version: 2, groups: [] };
            try {
                const content = await vscode.workspace.fs.readFile(configUri);
                existingConfig = JSON.parse(content.toString());
            } catch {
                // File doesn't exist yet
            }

            // Merge configs
            const mergedConfig = {
                ...existingConfig,
                ...config
            };

            // Ensure .vscode directory exists
            const vscodeDirUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, '.vscode');
            try {
                await vscode.workspace.fs.createDirectory(vscodeDirUri);
            } catch {
                // Directory might already exist
            }

            const contentStr = Buffer.from(JSON.stringify(mergedConfig, null, 2), 'utf-8');
            await vscode.workspace.fs.writeFile(configUri, contentStr);
        } catch (error) {
            console.error('Failed to save config:', error);
        }
    }

    /**
     * Load groups from file if available, otherwise from workspace state
     */
    getGroups(): FileGroup[] {
        // Get local groups
        const localGroups = this.context.workspaceState.get<FileGroup[]>(STORAGE_KEY, []);
        const normalizedLocal = localGroups.map((g, index) => ({
            ...g,
            order: g.order ?? index,
            parentId: g.parentId ?? undefined,
            shortDescription: g.shortDescription ?? undefined,
            details: g.details ?? undefined,
            createdBy: g.createdBy ?? undefined,
            collapsed: g.collapsed ?? false,
            pinned: g.pinned ?? false,
            badgeText: g.badgeText ?? undefined,
            isGlobal: false
        }));

        // Get global groups if not hidden
        if (!this.shouldHideGlobalGroups()) {
            const globalGroups = this.getGlobalGroups();
            // Combine: global groups first, then local groups
            return [...globalGroups, ...normalizedLocal];
        }

        return normalizedLocal;
    }

    /**
     * Get global groups
     */
    getGlobalGroups(): FileGroup[] {
        const groups = this.context.globalState.get<FileGroup[]>(GLOBAL_STORAGE_KEY, []);
        return groups.map((g, index) => ({
            ...g,
            order: g.order ?? index,
            parentId: g.parentId ?? undefined,
            shortDescription: g.shortDescription ?? undefined,
            details: g.details ?? undefined,
            createdBy: g.createdBy ?? undefined,
            collapsed: g.collapsed ?? false,
            pinned: g.pinned ?? false,
            badgeText: g.badgeText ?? undefined,
            isGlobal: true
        }));
    }

    /**
     * Load groups from config file
     */
    async loadFromFile(): Promise<boolean> {
        const configUri = this.getConfigFileUri();
        if (!configUri) {
            return false;
        }

        try {
            const content = await vscode.workspace.fs.readFile(configUri);
            const config: FileGroupsConfig = JSON.parse(content.toString());

            if (config.version && config.groups) {
                // Convert relative paths to absolute paths and detect directories
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (workspaceRoot) {
                    for (const group of config.groups) {
                        const updatedFiles = [];
                        for (const file of group.files) {
                            const absolutePath = this.toAbsolutePath(file.path, workspaceRoot);
                            let isDirectory = file.isDirectory;

                            // If isDirectory is not set, check the filesystem
                            if (isDirectory === undefined) {
                                try {
                                    const uri = vscode.Uri.file(absolutePath);
                                    const stat = await vscode.workspace.fs.stat(uri);
                                    isDirectory = (stat.type & vscode.FileType.Directory) !== 0;
                                } catch {
                                    isDirectory = false;
                                }
                            }

                            updatedFiles.push({
                                ...file,
                                path: absolutePath,
                                isDirectory
                            });
                        }
                        group.files = updatedFiles;
                        group.shortDescription = group.shortDescription ?? undefined;
                        group.details = group.details ?? undefined;
                        group.createdBy = group.createdBy ?? undefined;
                        group.collapsed = group.collapsed ?? false;
                        group.pinned = group.pinned ?? false;
                        group.badgeText = group.badgeText ?? undefined;
                    }
                }

                await this.context.workspaceState.update(STORAGE_KEY, config.groups);

                // Also load hideGlobalGroups setting
                if (config.hideGlobalGroups !== undefined) {
                    const configWithSetting: FileGroupsConfig = {
                        version: config.version,
                        groups: config.groups,
                        hideGlobalGroups: config.hideGlobalGroups
                    };
                    await this.context.workspaceState.update('fileGroupsConfig', configWithSetting);
                }

                return true;
            }
        } catch {
            // File doesn't exist or is invalid
        }
        return false;
    }

    /**
     * Load global groups from file
     */
    async loadFromGlobalFile(): Promise<boolean> {
        const configUri = this.getGlobalConfigFileUri();
        if (!configUri) {
            return false;
        }

        try {
            const content = await vscode.workspace.fs.readFile(configUri);
            const config: FileGroupsConfig = JSON.parse(content.toString());

            if (config.version && config.groups) {
                // Global groups store absolute paths, no conversion needed
                for (const group of config.groups) {
                    group.shortDescription = group.shortDescription ?? undefined;
                    group.details = group.details ?? undefined;
                    group.createdBy = group.createdBy ?? undefined;
                    group.collapsed = group.collapsed ?? false;
                    group.pinned = group.pinned ?? false;
                    group.badgeText = group.badgeText ?? undefined;
                    group.isGlobal = true;
                }

                await this.context.globalState.update(GLOBAL_STORAGE_KEY, config.groups);
                return true;
            }
        } catch {
            // File doesn't exist or is invalid
        }
        return false;
    }

    /**
     * Save all groups to workspace storage and file
     */
    async saveGroups(groups: FileGroup[]): Promise<void> {
        // Separate global and local groups
        const localGroups = groups.filter(g => !g.isGlobal);
        const globalGroups = groups.filter(g => g.isGlobal);

        // Save local groups
        await this.context.workspaceState.update(STORAGE_KEY, localGroups);
        await this.saveToFile(localGroups);

        // Save global groups if any changed
        if (globalGroups.length > 0 || this.getGlobalGroups().length > 0) {
            await this.saveGlobalGroups(globalGroups);
        }
    }

    /**
     * Save global groups
     */
    async saveGlobalGroups(groups: FileGroup[]): Promise<void> {
        // Mark all as global
        const globalGroups = groups.map(g => ({ ...g, isGlobal: true }));
        await this.context.globalState.update(GLOBAL_STORAGE_KEY, globalGroups);
        await this.saveToGlobalFile(globalGroups);
    }

    /**
     * Save groups to config file
     */
    private async saveToFile(groups: FileGroup[]): Promise<void> {
        const configUri = this.getConfigFileUri();
        if (!configUri) {
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            return;
        }

        // Convert absolute paths to relative paths for portability
        const portableGroups = groups.map(group => ({
            ...group,
            files: group.files.map(file => ({
                ...file,
                path: this.toRelativePath(file.path, workspaceRoot)
            }))
        }));

        const config: FileGroupsConfig = {
            version: 2,
            groups: portableGroups
        };

        try {
            // Ensure .vscode directory exists
            const vscodeDirUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, '.vscode');
            try {
                await vscode.workspace.fs.createDirectory(vscodeDirUri);
            } catch {
                // Directory might already exist
            }

            const content = Buffer.from(JSON.stringify(config, null, 2), 'utf-8');
            await vscode.workspace.fs.writeFile(configUri, content);
        } catch (error) {
            console.error('Failed to save file-groups.json:', error);
        }
    }

    /**
     * Save global groups to config file
     */
    private async saveToGlobalFile(groups: FileGroup[]): Promise<void> {
        const configUri = this.getGlobalConfigFileUri();
        if (!configUri) {
            return;
        }

        // Global groups keep absolute paths
        const config: FileGroupsConfig = {
            version: 2,
            groups: groups
        };

        try {
            // Ensure global storage directory exists
            const globalStorageDir = this.context.globalStorageUri;
            try {
                await vscode.workspace.fs.createDirectory(globalStorageDir);
            } catch {
                // Directory might already exist
            }

            const content = Buffer.from(JSON.stringify(config, null, 2), 'utf-8');
            await vscode.workspace.fs.writeFile(configUri, content);
        } catch (error) {
            console.error('Failed to save global file-groups.json:', error);
        }
    }

    /**
     * Convert absolute path to relative path
     */
    private toRelativePath(absolutePath: string, workspaceRoot: string): string {
        const normalizedAbsolute = absolutePath.replace(/\\/g, '/');
        const normalizedRoot = workspaceRoot.replace(/\\/g, '/');

        if (normalizedAbsolute.startsWith(normalizedRoot)) {
            return normalizedAbsolute.substring(normalizedRoot.length + 1);
        }
        return absolutePath; // Keep absolute if outside workspace
    }

    /**
     * Convert relative path to absolute path
     */
    private toAbsolutePath(relativePath: string, workspaceRoot: string): string {
        // If already absolute, return as is
        if (relativePath.includes(':') || relativePath.startsWith('/')) {
            return relativePath;
        }
        return `${workspaceRoot}/${relativePath}`.replace(/\//g, require('path').sep);
    }

    /**
     * Create a new group
     */
    async createGroup(group: FileGroup): Promise<void> {
        const groups = this.getGroups();
        groups.push(group);
        await this.saveGroups(groups);
    }

    /**
     * Update an existing group
     */
    async updateGroup(groupId: string, updates: Partial<FileGroup>): Promise<void> {
        const groups = this.getGroups();
        const index = groups.findIndex(g => g.id === groupId);
        if (index !== -1) {
            groups[index] = { ...groups[index], ...updates };
            await this.saveGroups(groups);
        }
    }

    /**
     * Delete a group and all its child groups
     */
    async deleteGroup(groupId: string): Promise<void> {
        const groups = this.getGroups();
        const idsToDelete = this.getGroupAndChildIds(groupId, groups);
        const filtered = groups.filter(g => !idsToDelete.has(g.id));
        await this.saveGroups(filtered);
    }

    /**
     * Get a group ID and all its descendant IDs
     */
    private getGroupAndChildIds(groupId: string, groups: FileGroup[]): Set<string> {
        const ids = new Set<string>([groupId]);
        const findChildren = (parentId: string) => {
            groups.filter(g => g.parentId === parentId).forEach(child => {
                ids.add(child.id);
                findChildren(child.id);
            });
        };
        findChildren(groupId);
        return ids;
    }

    /**
     * Recursively update a group and all its children
     */
    async updateGroupRecursive(groupId: string, updates: Partial<FileGroup>): Promise<void> {
        const groups = this.getGroups();
        const idsToUpdate = this.getGroupAndChildIds(groupId, groups);

        const updatedGroups = groups.map(g =>
            idsToUpdate.has(g.id) ? { ...g, ...updates } : g
        );

        await this.saveGroups(updatedGroups);
    }

    /**
     * Get all files in a group and its child groups recursively
     */
    getAllFilesInGroup(groupId: string): GroupFile[] {
        const groups = this.getGroups();
        const idsToInclude = this.getGroupAndChildIds(groupId, groups);
        const files: GroupFile[] = [];

        groups.filter(g => idsToInclude.has(g.id)).forEach(group => {
            files.push(...group.files);
        });

        return files;
    }

    /**
     * Get child groups of a group
     */
    getSubgroups(parentId: string): FileGroup[] {
        return this.getGroups().filter(g => g.parentId === parentId);
    }

    /**
     * Get root groups (groups without a parent)
     */
    getRootGroups(): FileGroup[] {
        return this.getGroups().filter(g => !g.parentId);
    }

    /**
     * Add a file to a group
     */
    async addFileToGroup(groupId: string, file: GroupFile): Promise<boolean> {
        const groups = this.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (group) {
            // Check if file already exists in group
            if (!group.files.some(f => f.path === file.path)) {
                group.files.push(file);
                await this.saveGroups(groups);
                return true;
            }
        }
        return false;
    }

    /**
     * Add multiple files to a group
     */
    async addFilesToGroup(groupId: string, files: GroupFile[]): Promise<number> {
        const groups = this.getGroups();
        const group = groups.find(g => g.id === groupId);
        let addedCount = 0;
        if (group) {
            for (const file of files) {
                if (!group.files.some(f => f.path === file.path)) {
                    group.files.push(file);
                    addedCount++;
                }
            }
            if (addedCount > 0) {
                await this.saveGroups(groups);
            }
        }
        return addedCount;
    }

    /**
     * Remove a file from a group
     */
    async removeFileFromGroup(groupId: string, filePath: string): Promise<void> {
        const groups = this.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (group) {
            group.files = group.files.filter(f => f.path !== filePath);
            await this.saveGroups(groups);
        }
    }

    /**
     * Reorder files within a group
     */
    async reorderFilesInGroup(groupId: string, draggedFilePath: string, targetFilePath: string | null): Promise<void> {
        const groups = this.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (!group) { return; }

        const draggedIndex = group.files.findIndex(f => f.path === draggedFilePath);
        if (draggedIndex === -1) { return; }

        const [draggedFile] = group.files.splice(draggedIndex, 1);

        if (targetFilePath === null) {
            // Drop at the end
            group.files.push(draggedFile);
        } else {
            const targetIndex = group.files.findIndex(f => f.path === targetFilePath);
            if (targetIndex !== -1) {
                // Insert before target
                group.files.splice(targetIndex, 0, draggedFile);
            } else {
                // Target not found, add at end
                group.files.push(draggedFile);
            }
        }

        await this.saveGroups(groups);
    }

    /**
     * Get a specific group by ID
     */
    getGroup(groupId: string): FileGroup | undefined {
        return this.getGroups().find(g => g.id === groupId);
    }

    /**
     * Reorder groups
     */
    async reorderGroups(groupIds: string[]): Promise<void> {
        const groups = this.getGroups();
        const reordered = groupIds.map((id, index) => {
            const group = groups.find(g => g.id === id);
            if (group) {
                return { ...group, order: index };
            }
            return null;
        }).filter((g): g is FileGroup => g !== null);

        // Add any groups not in the new order at the end
        const remainingGroups = groups.filter(g => !groupIds.includes(g.id));
        remainingGroups.forEach((g, i) => {
            g.order = reordered.length + i;
            reordered.push(g);
        });

        await this.saveGroups(reordered);
    }
}
