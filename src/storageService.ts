import * as vscode from 'vscode';
import type { FileGroup, GroupFile, FileGroupsConfig } from './models';
import { canonicalFilePath } from './fileUtils';
import { getDescendantGroupIds } from './groupHierarchy';
import { resolveWorkspacePath, toWorkspaceRelativePath } from './pathUtils';
import { normalizeTags } from './tags';

const STORAGE_KEY = 'fileGroups';
const CONFIG_FILE_NAME = '.vscode/file-groups.json';
const GLOBAL_STORAGE_KEY = 'globalFileGroups';
const GLOBAL_CONFIG_FILE_NAME = 'file-groups-global.json';

function normalizeGroup(group: FileGroup, index: number, isGlobal: boolean): FileGroup {
    return {
        ...group,
        order: group.order ?? index,
        parentId: group.parentId ?? undefined,
        shortDescription: group.shortDescription ?? undefined,
        details: group.details ?? undefined,
        tags: normalizeTags(group.tags ?? []),
        files: (group.files ?? []).map((file) => ({
            ...file,
            tags: normalizeTags(file.tags ?? [])
        })),
        createdBy: group.createdBy ?? undefined,
        collapsed: group.collapsed ?? false,
        pinned: group.pinned ?? false,
        badgeText: group.badgeText ?? undefined,
        isGlobal
    };
}

/**
 * Service for persisting file groups to workspace state and file
 */
export class StorageService implements vscode.Disposable {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    private readonly disposables: vscode.Disposable[] = [];
    readonly onDidChange = this._onDidChange.event;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.setupFileWatcher();
        this.setupGlobalFileWatcher();
    }

    dispose(): void {
        while (this.disposables.length > 0) {
            this.disposables.pop()?.dispose();
        }
        this._onDidChange.dispose();
    }

    private getStoredLocalGroups(): FileGroup[] {
        const localGroups = this.context.workspaceState.get<FileGroup[]>(STORAGE_KEY, []);
        return localGroups.map((group, index) => normalizeGroup(group, index, false));
    }

    private setupFileWatcher(): void {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const pattern = new vscode.RelativePattern(workspaceFolders[0], CONFIG_FILE_NAME);
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);
            const reload = async (): Promise<void> => {
                if (await this.loadFromFile()) {
                    this._onDidChange.fire();
                }
            };

            watcher.onDidChange(() => void reload());
            watcher.onDidCreate(() => void reload());
            watcher.onDidDelete(() => this._onDidChange.fire());
            this.disposables.push(watcher);
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
            const reload = async (): Promise<void> => {
                if (await this.loadFromGlobalFile()) {
                    this._onDidChange.fire();
                }
            };

            watcher.onDidChange(() => void reload());
            watcher.onDidCreate(() => void reload());
            watcher.onDidDelete(() => this._onDidChange.fire());
            this.disposables.push(watcher);
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
        if (!this.getConfigFileUri()) {
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
        const normalizedLocal = this.getStoredLocalGroups();

        // Get global groups if not hidden
        if (!this.shouldHideGlobalGroups()) {
            const globalGroups = this.getGlobalGroups();
            // Combine: global groups first, then local groups
            return [...globalGroups, ...normalizedLocal];
        }

        return normalizedLocal;
    }

    /**
     * Get all groups regardless of current visibility settings
     */
    getAllGroups(): FileGroup[] {
        return [...this.getGlobalGroups(), ...this.getStoredLocalGroups()];
    }

    /**
     * Get global groups
     */
    getGlobalGroups(): FileGroup[] {
        const groups = this.context.globalState.get<FileGroup[]>(GLOBAL_STORAGE_KEY, []);
        return groups.map((group, index) => normalizeGroup(group, index, true));
    }

    private async normalizeWorkspaceGroups(groups: readonly FileGroup[]): Promise<FileGroup[]> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            return groups.map((group, index) => normalizeGroup(group, index, false));
        }

        return Promise.all(groups.map(async (group, index) => {
            const files = await Promise.all((group.files ?? []).map(async (file) => {
                const absolutePath = resolveWorkspacePath(file.path, workspaceRoot);
                const isDirectory = file.isDirectory ?? await this.detectDirectory(absolutePath);

                return {
                    ...file,
                    path: absolutePath,
                    isDirectory
                };
            }));

            return normalizeGroup({ ...group, files }, index, false);
        }));
    }

    private async detectDirectory(filePath: string): Promise<boolean> {
        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            return (stat.type & vscode.FileType.Directory) !== 0;
        } catch {
            return false;
        }
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
                const groups = await this.normalizeWorkspaceGroups(config.groups);

                await this.context.workspaceState.update(STORAGE_KEY, groups);

                // Also load hideGlobalGroups setting
                if (config.hideGlobalGroups !== undefined) {
                    const configWithSetting: FileGroupsConfig = {
                        version: config.version,
                        groups,
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
                const groups = config.groups.map((group, index) => normalizeGroup(group, index, true));

                await this.context.globalState.update(GLOBAL_STORAGE_KEY, groups);
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
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            return;
        }

        // Convert absolute paths to relative paths for portability.
        const portableGroups = groups.map(group => ({
            ...group,
            files: group.files.map(file => ({
                ...file,
                path: toWorkspaceRelativePath(file.path, workspaceRoot)
            }))
        }));

        // Merge with the existing config so visibility and future settings survive group saves.
        await this.saveConfigToFile({
            version: 2,
            groups: portableGroups
        });
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
     * Create a new group
     */
    async createGroup(group: FileGroup): Promise<void> {
        const groups = this.getAllGroups();
        groups.push(group);
        await this.saveGroups(groups);
    }

    /**
     * Update an existing group
     */
    async updateGroup(groupId: string, updates: Partial<FileGroup>): Promise<void> {
        const groups = this.getAllGroups();
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
        const groups = this.getAllGroups();
        const idsToDelete = getDescendantGroupIds(groupId, groups);
        const filtered = groups.filter(g => !idsToDelete.has(g.id));
        await this.saveGroups(filtered);
    }

    /**
     * Recursively update a group and all its children
     */
    async updateGroupRecursive(groupId: string, updates: Partial<FileGroup>): Promise<void> {
        const groups = this.getAllGroups();
        const idsToUpdate = getDescendantGroupIds(groupId, groups);

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
        const idsToInclude = getDescendantGroupIds(groupId, groups);
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
        const groups = this.getAllGroups();
        const group = groups.find(g => g.id === groupId);
        if (group) {
            const fileKey = canonicalFilePath(file.path);
            if (!group.files.some(existingFile => canonicalFilePath(existingFile.path) === fileKey)) {
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
        const groups = this.getAllGroups();
        const group = groups.find(g => g.id === groupId);
        let addedCount = 0;
        if (group) {
            const existingPaths = new Set(group.files.map(file => canonicalFilePath(file.path)));
            for (const file of files) {
                const fileKey = canonicalFilePath(file.path);
                if (!existingPaths.has(fileKey)) {
                    group.files.push(file);
                    existingPaths.add(fileKey);
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
        const groups = this.getAllGroups();
        const group = groups.find(g => g.id === groupId);
        if (group) {
            const fileKey = canonicalFilePath(filePath);
            const remainingFiles = group.files.filter(file => canonicalFilePath(file.path) !== fileKey);
            if (remainingFiles.length === group.files.length) {
                return;
            }

            group.files = remainingFiles;
            await this.saveGroups(groups);
        }
    }

    /**
     * Update metadata for one bookmarked file inside a group.
     */
    async updateFileInGroup(groupId: string, filePath: string, updates: Partial<GroupFile>): Promise<void> {
        const groups = this.getAllGroups();
        const group = groups.find(g => g.id === groupId);
        const fileKey = canonicalFilePath(filePath);
        const file = group?.files.find(item => canonicalFilePath(item.path) === fileKey);
        if (!file) {
            return;
        }

        Object.assign(file, updates);
        await this.saveGroups(groups);
    }

    /**
     * Reorder files within a group
     */
    async reorderFilesInGroup(groupId: string, draggedFilePath: string, targetFilePath: string | null): Promise<void> {
        const groups = this.getAllGroups();
        const group = groups.find(g => g.id === groupId);
        if (!group) { return; }

        const draggedKey = canonicalFilePath(draggedFilePath);
        const draggedIndex = group.files.findIndex(file => canonicalFilePath(file.path) === draggedKey);
        if (draggedIndex === -1) { return; }

        const [draggedFile] = group.files.splice(draggedIndex, 1);

        if (targetFilePath === null) {
            // Drop at the end
            group.files.push(draggedFile);
        } else {
            const targetKey = canonicalFilePath(targetFilePath);
            const targetIndex = group.files.findIndex(file => canonicalFilePath(file.path) === targetKey);
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

}
