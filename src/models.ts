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
 * Represents a file group (can have subgroups)
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
    /** Parent group ID (null/undefined for root groups) */
    parentId?: string;
}

/**
 * File format for .vscode/file-groups.json
 */
export interface FileGroupsConfig {
    version: number;
    groups: FileGroup[];
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
    { id: 'custom', label: '🎨 Custom Hex Color...' },
];

/**
 * Check if a color value is a hex color (starts with #)
 */
export function isHexColor(color: string): boolean {
    return color.startsWith('#');
}

/**
 * Map hex colors to the closest theme color for ThemeIcon compatibility
 * Returns the original ThemeColor id if not a hex color
 */
export function getThemeColorForHex(hexColor: string): string {
    if (!isHexColor(hexColor)) {
        return hexColor;
    }

    // Map common hex ranges to theme colors
    const hex = hexColor.toLowerCase();
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // Simple hue-based mapping
    if (r > 200 && g < 100 && b < 100) return 'charts.red';
    if (r > 200 && g > 100 && g < 200 && b < 100) return 'charts.orange';
    if (r > 200 && g > 200 && b < 100) return 'charts.yellow';
    if (r < 100 && g > 150 && b < 100) return 'charts.green';
    if (r < 100 && g < 150 && b > 200) return 'charts.blue';
    if (r > 150 && g < 100 && b > 150) return 'charts.purple';
    if (r < 150 && g > 200 && b > 200) return 'terminal.ansiCyan';
    if (r > 200 && g < 150 && b > 200) return 'terminal.ansiMagenta';

    return 'charts.blue'; // Default fallback
}

/**
 * Tree item types for context value
 */
export type TreeItemType = 'group' | 'subgroup' | 'file';

/**
 * Tree item representing either a group, subgroup, or a file
 */
export class FileGroupTreeItem extends vscode.TreeItem {
    constructor(
        public readonly itemType: TreeItemType,
        public readonly group: FileGroup,
        public readonly file?: GroupFile,
        public readonly hasChildren: boolean = false
    ) {
        super(
            file ? file.name : group.name,
            file
                ? vscode.TreeItemCollapsibleState.None
                : vscode.TreeItemCollapsibleState.Expanded
        );

        // Set context value for menus
        // subgroups get 'subgroup' so we can show "Move to Root" option
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
                // For hex colors, map to closest theme color for icon display
                const themeColorId = isHexColor(group.color)
                    ? getThemeColorForHex(group.color)
                    : group.color;
                this.iconPath = new vscode.ThemeIcon(
                    group.icon || 'folder',
                    new vscode.ThemeColor(themeColorId)
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
