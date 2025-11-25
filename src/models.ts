import * as vscode from 'vscode';

/**
 * Represents a file within a group
 */
export interface GroupFile {
    /** Full absolute path to the file */
    path: string;
    /** Display name (filename) */
    name: string;
}

/**
 * Represents a file group
 */
export interface FileGroup {
    /** Unique identifier for the group */
    id: string;
    /** Display name of the group */
    name: string;
    /** ThemeIcon id (e.g., 'folder', 'book', 'flame') */
    icon: string;
    /** Color id for the group (e.g., 'charts.red', 'charts.blue') */
    color: string;
    /** Files in this group */
    files: GroupFile[];
    /** Order index for sorting */
    order: number;
}

/**
 * Available icons for groups
 */
export const GROUP_ICONS: { id: string; label: string }[] = [
    { id: 'folder', label: '$(folder) Folder' },
    { id: 'file-code', label: '$(file-code) Code' },
    { id: 'book', label: '$(book) Book' },
    { id: 'flame', label: '$(flame) Flame' },
    { id: 'rocket', label: '$(rocket) Rocket' },
    { id: 'star', label: '$(star) Star' },
    { id: 'heart', label: '$(heart) Heart' },
    { id: 'zap', label: '$(zap) Zap' },
    { id: 'bug', label: '$(bug) Bug' },
    { id: 'beaker', label: '$(beaker) Beaker' },
    { id: 'briefcase', label: '$(briefcase) Briefcase' },
    { id: 'cloud', label: '$(cloud) Cloud' },
    { id: 'database', label: '$(database) Database' },
    { id: 'gear', label: '$(gear) Gear' },
    { id: 'home', label: '$(home) Home' },
    { id: 'key', label: '$(key) Key' },
    { id: 'layers', label: '$(layers) Layers' },
    { id: 'lightbulb', label: '$(lightbulb) Lightbulb' },
    { id: 'lock', label: '$(lock) Lock' },
    { id: 'package', label: '$(package) Package' },
    { id: 'paintcan', label: '$(paintcan) Paint' },
    { id: 'play', label: '$(play) Play' },
    { id: 'pulse', label: '$(pulse) Pulse' },
    { id: 'search', label: '$(search) Search' },
    { id: 'shield', label: '$(shield) Shield' },
    { id: 'tag', label: '$(tag) Tag' },
    { id: 'target', label: '$(target) Target' },
    { id: 'terminal', label: '$(terminal) Terminal' },
    { id: 'tools', label: '$(tools) Tools' },
    { id: 'vm', label: '$(vm) VM' },
];

/**
 * Available colors for groups (using VS Code theme colors)
 */
export const GROUP_COLORS: { id: string; label: string }[] = [
    { id: '', label: 'Default (No Color)' },
    { id: 'charts.red', label: '🔴 Red' },
    { id: 'charts.orange', label: '🟠 Orange' },
    { id: 'charts.yellow', label: '🟡 Yellow' },
    { id: 'charts.green', label: '🟢 Green' },
    { id: 'charts.blue', label: '🔵 Blue' },
    { id: 'charts.purple', label: '🟣 Purple' },
    { id: 'terminal.ansiCyan', label: '🩵 Cyan' },
    { id: 'terminal.ansiMagenta', label: '🩷 Magenta' },
    { id: 'terminal.ansiWhite', label: '⚪ White' },
];

/**
 * Tree item types for context value
 */
export type TreeItemType = 'group' | 'file';

/**
 * Tree item representing either a group or a file
 */
export class FileGroupTreeItem extends vscode.TreeItem {
    constructor(
        public readonly itemType: TreeItemType,
        public readonly group: FileGroup,
        public readonly file?: GroupFile
    ) {
        super(
            file ? file.name : group.name,
            file
                ? vscode.TreeItemCollapsibleState.None
                : vscode.TreeItemCollapsibleState.Expanded
        );

        this.contextValue = itemType;

        if (file) {
            // File item
            this.resourceUri = vscode.Uri.file(file.path);
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [this.resourceUri]
            };
            this.tooltip = file.path;
            // Let VS Code handle file icons automatically via resourceUri
        } else {
            // Group item
            this.tooltip = `${group.name} (${group.files.length} files)`;
            this.description = `${group.files.length} files`;

            // Set icon with optional color
            if (group.color) {
                this.iconPath = new vscode.ThemeIcon(
                    group.icon || 'folder',
                    new vscode.ThemeColor(group.color)
                );
            } else {
                this.iconPath = new vscode.ThemeIcon(group.icon || 'folder');
            }
        }
    }
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
