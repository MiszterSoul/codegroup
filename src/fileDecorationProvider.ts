import * as vscode from 'vscode';
import { StorageService } from './storageService';
import { isHexColor, getThemeColorForHex, FileGroup } from './models';

/**
 * Provides file decorations (colors) for files that belong to groups.
 * This applies colors to files in Explorer AND tabs!
 */
export class FileGroupDecorationProvider implements vscode.FileDecorationProvider {
    private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    constructor(private storageService: StorageService) {}

    /**
     * Refresh decorations for all files or specific files
     */
    refresh(uris?: vscode.Uri[]): void {
        this._onDidChangeFileDecorations.fire(uris);
    }

    /**
     * Provide decoration for a file
     */
    provideFileDecoration(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.FileDecoration> {
        if (uri.scheme !== 'file') {
            return undefined;
        }

        const filePath = uri.fsPath;
        const groups = this.storageService.getGroups();

        // Find the first group that contains this file
        for (const group of groups) {
            const fileInGroup = group.files.find(f => f.path === filePath);
            if (fileInGroup && group.color) {
                // Use custom badge text or first letter of group name
                const badge = group.badgeText?.substring(0, 2) || group.name.charAt(0).toUpperCase();

                // For hex colors, map to closest theme color
                const themeColorId = isHexColor(group.color)
                    ? getThemeColorForHex(group.color)
                    : group.color;

                // Build full path from root to this group
                const fullPath = this.buildGroupPath(group, groups);

                return new vscode.FileDecoration(
                    badge,
                    `CodeGroup: ${fullPath}`,
                    new vscode.ThemeColor(themeColorId)
                );
            }
        }

        return undefined;
    }

    /**
     * Build the full path from root to the given group (e.g., "Bearer\Backend\")
     */
    private buildGroupPath(group: FileGroup, allGroups: FileGroup[]): string {
        const path: string[] = [];
        let current: FileGroup | undefined = group;

        // Walk up the parent chain
        while (current) {
            path.unshift(current.name);
            current = current.parentId ? allGroups.find(g => g.id === current!.parentId) : undefined;
        }

        // Join with backslash and add trailing backslash
        return path.join('\\') + '\\';
    }
}
