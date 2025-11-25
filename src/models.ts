import * as vscode from 'vscode';

/**
 * Represents a file or folder within a group
 */
export interface GroupFile {
    /** Full absolute path to the file or folder */
    path: string;
    /** Display name (filename or folder name) */
    name: string;
    /** Whether this is a directory */
    isDirectory?: boolean;
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
    // Folders & Files
    { id: 'folder', label: '$(folder) Folder' },
    { id: 'folder-opened', label: '$(folder-opened) Folder Opened' },
    { id: 'file', label: '$(file) File' },
    { id: 'file-code', label: '$(file-code) Code' },
    { id: 'file-text', label: '$(file-text) Text' },
    { id: 'file-pdf', label: '$(file-pdf) PDF' },
    { id: 'file-media', label: '$(file-media) Media' },
    { id: 'file-zip', label: '$(file-zip) Archive' },
    { id: 'files', label: '$(files) Files' },
    // Common
    { id: 'book', label: '$(book) Book' },
    { id: 'bookmark', label: '$(bookmark) Bookmark' },
    { id: 'flame', label: '$(flame) Flame' },
    { id: 'rocket', label: '$(rocket) Rocket' },
    { id: 'star', label: '$(star) Star' },
    { id: 'star-full', label: '$(star-full) Star Full' },
    { id: 'heart', label: '$(heart) Heart' },
    { id: 'zap', label: '$(zap) Zap' },
    { id: 'eye', label: '$(eye) Eye' },
    { id: 'bell', label: '$(bell) Bell' },
    { id: 'pin', label: '$(pin) Pin' },
    { id: 'pinned', label: '$(pinned) Pinned' },
    // Development
    { id: 'bug', label: '$(bug) Bug' },
    { id: 'beaker', label: '$(beaker) Beaker' },
    { id: 'code', label: '$(code) Code' },
    { id: 'symbol-class', label: '$(symbol-class) Class' },
    { id: 'symbol-method', label: '$(symbol-method) Method' },
    { id: 'symbol-interface', label: '$(symbol-interface) Interface' },
    { id: 'symbol-variable', label: '$(symbol-variable) Variable' },
    { id: 'symbol-namespace', label: '$(symbol-namespace) Namespace' },
    { id: 'symbol-enum', label: '$(symbol-enum) Enum' },
    { id: 'extensions', label: '$(extensions) Extensions' },
    { id: 'git-branch', label: '$(git-branch) Git Branch' },
    { id: 'git-commit', label: '$(git-commit) Git Commit' },
    { id: 'git-merge', label: '$(git-merge) Git Merge' },
    { id: 'source-control', label: '$(source-control) Source Control' },
    { id: 'debug', label: '$(debug) Debug' },
    { id: 'debug-console', label: '$(debug-console) Debug Console' },
    { id: 'output', label: '$(output) Output' },
    { id: 'terminal', label: '$(terminal) Terminal' },
    { id: 'console', label: '$(console) Console' },
    // Objects
    { id: 'briefcase', label: '$(briefcase) Briefcase' },
    { id: 'cloud', label: '$(cloud) Cloud' },
    { id: 'cloud-upload', label: '$(cloud-upload) Cloud Upload' },
    { id: 'cloud-download', label: '$(cloud-download) Cloud Download' },
    { id: 'database', label: '$(database) Database' },
    { id: 'server', label: '$(server) Server' },
    { id: 'gear', label: '$(gear) Gear' },
    { id: 'settings-gear', label: '$(settings-gear) Settings' },
    { id: 'home', label: '$(home) Home' },
    { id: 'key', label: '$(key) Key' },
    { id: 'layers', label: '$(layers) Layers' },
    { id: 'lightbulb', label: '$(lightbulb) Lightbulb' },
    { id: 'lock', label: '$(lock) Lock' },
    { id: 'unlock', label: '$(unlock) Unlock' },
    { id: 'package', label: '$(package) Package' },
    { id: 'archive', label: '$(archive) Archive' },
    { id: 'inbox', label: '$(inbox) Inbox' },
    { id: 'paintcan', label: '$(paintcan) Paint' },
    { id: 'play', label: '$(play) Play' },
    { id: 'play-circle', label: '$(play-circle) Play Circle' },
    { id: 'pulse', label: '$(pulse) Pulse' },
    { id: 'search', label: '$(search) Search' },
    { id: 'shield', label: '$(shield) Shield' },
    { id: 'tag', label: '$(tag) Tag' },
    { id: 'target', label: '$(target) Target' },
    { id: 'tasklist', label: '$(tasklist) Tasklist' },
    { id: 'checklist', label: '$(checklist) Checklist' },
    { id: 'tools', label: '$(tools) Tools' },
    { id: 'wrench', label: '$(wrench) Wrench' },
    { id: 'vm', label: '$(vm) VM' },
    { id: 'window', label: '$(window) Window' },
    // Communication
    { id: 'comment', label: '$(comment) Comment' },
    { id: 'comment-discussion', label: '$(comment-discussion) Discussion' },
    { id: 'mail', label: '$(mail) Mail' },
    { id: 'megaphone', label: '$(megaphone) Megaphone' },
    { id: 'mention', label: '$(mention) Mention' },
    // Arrows & Navigation
    { id: 'arrow-up', label: '$(arrow-up) Arrow Up' },
    { id: 'arrow-down', label: '$(arrow-down) Arrow Down' },
    { id: 'arrow-left', label: '$(arrow-left) Arrow Left' },
    { id: 'arrow-right', label: '$(arrow-right) Arrow Right' },
    { id: 'arrow-both', label: '$(arrow-both) Arrow Both' },
    { id: 'arrow-swap', label: '$(arrow-swap) Arrow Swap' },
    // Status
    { id: 'check', label: '$(check) Check' },
    { id: 'checklist', label: '$(checklist) Checklist' },
    { id: 'error', label: '$(error) Error' },
    { id: 'warning', label: '$(warning) Warning' },
    { id: 'info', label: '$(info) Info' },
    { id: 'question', label: '$(question) Question' },
    { id: 'circle-filled', label: '$(circle-filled) Circle' },
    { id: 'circle-outline', label: '$(circle-outline) Circle Outline' },
    { id: 'pass-filled', label: '$(pass-filled) Pass' },
    { id: 'record', label: '$(record) Record' },
    // Media
    { id: 'music', label: '$(music) Music' },
    { id: 'device-camera-video', label: '$(device-camera-video) Video' },
    { id: 'mic', label: '$(mic) Microphone' },
    { id: 'unmute', label: '$(unmute) Sound' },
    // People & Places
    { id: 'account', label: '$(account) Account' },
    { id: 'person', label: '$(person) Person' },
    { id: 'organization', label: '$(organization) Organization' },
    { id: 'smiley', label: '$(smiley) Smiley' },
    { id: 'globe', label: '$(globe) Globe' },
    { id: 'location', label: '$(location) Location' },
    { id: 'map', label: '$(map) Map' },
    // Time
    { id: 'history', label: '$(history) History' },
    { id: 'watch', label: '$(watch) Watch' },
    { id: 'calendar', label: '$(calendar) Calendar' },
    // Misc
    { id: 'graph', label: '$(graph) Graph' },
    { id: 'pie-chart', label: '$(pie-chart) Pie Chart' },
    { id: 'gift', label: '$(gift) Gift' },
    { id: 'sparkle', label: '$(sparkle) Sparkle' },
    { id: 'wand', label: '$(wand) Wand' },
    { id: 'coffee', label: '$(coffee) Coffee' },
    { id: 'workspace-trusted', label: '$(workspace-trusted) Trusted' },
    { id: 'workspace-untrusted', label: '$(workspace-untrusted) Untrusted' },
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
        public readonly hasChildren: boolean = false,
        public readonly subgroupCount: number = 0,
        public readonly totalItemCount: number = 0
    ) {
        super(
            file ? file.name : group.name,
            file
                ? vscode.TreeItemCollapsibleState.None
                : vscode.TreeItemCollapsibleState.Expanded
        );

        // Set unique ID for state preservation during refresh
        if (file) {
            this.id = `${group.id}:file:${file.path}`;
        } else {
            this.id = `${group.id}`;
        }

        // Set context value for menus
        // subgroups get 'subgroup' so we can show "Move to Root" option
        this.contextValue = itemType;

        if (file) {
            // File or folder item
            this.resourceUri = vscode.Uri.file(file.path);
            this.tooltip = file.path;

            if (file.isDirectory) {
                // Folder item - show folder icon and reveal in explorer on click
                this.iconPath = vscode.ThemeIcon.Folder;
                // Add folder indicator to the description for better visibility
                this.description = '📁';
                this.command = {
                    command: 'revealInExplorer',
                    title: 'Reveal in Explorer',
                    arguments: [this.resourceUri]
                };
            } else {
                // File item - let VS Code handle icon via resourceUri
                // Don't set iconPath to let resourceUri determine the icon
                this.command = {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [this.resourceUri]
                };
            }
        } else {
            // Group item - build description with file count, folder count, and subgroups
            const fileCount = group.files.filter(f => !f.isDirectory).length;
            const folderCount = group.files.filter(f => f.isDirectory).length;

            // Build description parts
            const parts: string[] = [];

            if (subgroupCount > 0) {
                parts.push(`${subgroupCount} ${subgroupCount === 1 ? 'subgroup' : 'subgroups'}`);
            }
            if (fileCount > 0) {
                parts.push(`${fileCount} ${fileCount === 1 ? 'file' : 'files'}`);
            }
            if (folderCount > 0) {
                parts.push(`${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`);
            }

            // If showing total from subgroups too
            if (subgroupCount > 0 && totalItemCount > group.files.length) {
                const totalFiles = totalItemCount;
                parts.push(`(${totalFiles} total)`);
            }

            this.description = parts.length > 0 ? parts.join(', ') : 'empty';
            this.tooltip = `${group.name} - ${this.description}`;

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
