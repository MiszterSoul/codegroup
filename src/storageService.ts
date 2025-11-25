import * as vscode from 'vscode';
import { FileGroup, GroupFile } from './models';

const STORAGE_KEY = 'fileGroups';

/**
 * Service for persisting file groups to workspace state
 */
export class StorageService {
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Load all groups from workspace storage
     */
    getGroups(): FileGroup[] {
        const groups = this.context.workspaceState.get<FileGroup[]>(STORAGE_KEY, []);
        // Ensure order property exists for migration
        return groups.map((g, index) => ({
            ...g,
            order: g.order ?? index
        }));
    }

    /**
     * Save all groups to workspace storage
     */
    async saveGroups(groups: FileGroup[]): Promise<void> {
        await this.context.workspaceState.update(STORAGE_KEY, groups);
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
     * Delete a group
     */
    async deleteGroup(groupId: string): Promise<void> {
        const groups = this.getGroups();
        const filtered = groups.filter(g => g.id !== groupId);
        await this.saveGroups(filtered);
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
