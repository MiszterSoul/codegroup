import * as vscode from 'vscode';
import { StorageService } from './storageService';
import { isHexColor, getThemeColorForHex } from './models';

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
                // Get the first letter of the group name as badge
                const badge = group.name.charAt(0).toUpperCase();
                
                // For hex colors, map to closest theme color
                const themeColorId = isHexColor(group.color) 
                    ? getThemeColorForHex(group.color) 
                    : group.color;

                return new vscode.FileDecoration(
                    badge,
                    `File Group: ${group.name}`,
                    new vscode.ThemeColor(themeColorId)
                );
            }
        }

        return undefined;
    }
}
