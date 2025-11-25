import * as vscode from 'vscode';
import { FileGroup, GroupFile, FileGroupsConfig } from './models';

const STORAGE_KEY = 'fileGroups';
const CONFIG_FILE_NAME = '.vscode/file-groups.json';

/**
 * Service for persisting file groups to workspace state and file
 */
export class StorageService {
    private _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;

    constructor(private context: vscode.ExtensionContext) {
        // Watch for file changes if workspace is open
        this.setupFileWatcher();
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
     * Load groups from file if available, otherwise from workspace state
     */
    getGroups(): FileGroup[] {
        // Try to load from workspace state (includes file-loaded data)
        const groups = this.context.workspaceState.get<FileGroup[]>(STORAGE_KEY, []);
        // Ensure order and parentId properties exist for migration
        return groups.map((g, index) => ({
            ...g,
            order: g.order ?? index,
            parentId: g.parentId ?? undefined
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
                // Convert relative paths to absolute paths
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (workspaceRoot) {
                    config.groups.forEach(group => {
                        group.files = group.files.map(file => ({
                            ...file,
                            path: this.toAbsolutePath(file.path, workspaceRoot)
                        }));
                    });
                }

                await this.context.workspaceState.update(STORAGE_KEY, config.groups);
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
        await this.context.workspaceState.update(STORAGE_KEY, groups);
        await this.saveToFile(groups);
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
            version: 1,
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
     * Delete a group and all its subgroups
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
     * Get all files in a group and its subgroups recursively
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
     * Get subgroups of a group
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
