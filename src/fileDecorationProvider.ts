import * as path from 'path';
import * as vscode from 'vscode';
import { StorageService } from './storageService';
import { isHexColor, getThemeColorForHex, FileGroup } from './models';

function canonicalFilePath(filePath: string): string {
    const normalized = path.normalize(filePath);
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

/**
 * Provides file decorations (colors) for files that belong to groups.
 * This applies colors to files in Explorer AND tabs.
 */
export class FileGroupDecorationProvider implements vscode.FileDecorationProvider, vscode.Disposable {
    private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    private readonly storageSubscription: vscode.Disposable;
    private decorations = new Map<string, vscode.FileDecoration>();

    constructor(private storageService: StorageService) {
        this.rebuildCache();
        this.storageSubscription = storageService.onDidChange(() => this.refresh());
    }

    dispose(): void {
        this.storageSubscription.dispose();
        this._onDidChangeFileDecorations.dispose();
    }

    /**
     * Refresh decorations for all files or specific files.
     */
    refresh(uris?: vscode.Uri[]): void {
        this.rebuildCache();
        this._onDidChangeFileDecorations.fire(uris);
    }

    provideFileDecoration(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FileDecoration> {
        if (uri.scheme !== 'file' || token.isCancellationRequested) {
            return undefined;
        }

        return this.decorations.get(canonicalFilePath(uri.fsPath));
    }

    private rebuildCache(): void {
        const groups = this.storageService.getGroups();
        const groupsById = new Map(groups.map(group => [group.id, group]));
        const nextDecorations = new Map<string, vscode.FileDecoration>();

        for (const group of groups) {
            const badge = group.badgeText?.substring(0, 2) || group.name.charAt(0).toUpperCase();
            const themeColorId = group.color
                ? (isHexColor(group.color) ? getThemeColorForHex(group.color) : group.color)
                : undefined;
            const decoration = new vscode.FileDecoration(
                badge,
                `CodeGroup: ${this.buildGroupPath(group, groupsById)}`,
                themeColorId ? new vscode.ThemeColor(themeColorId) : undefined
            );

            for (const file of group.files) {
                const fileKey = canonicalFilePath(file.path);
                if (!nextDecorations.has(fileKey)) {
                    nextDecorations.set(fileKey, decoration);
                }
            }
        }

        this.decorations = nextDecorations;
    }

    /**
     * Build the full path from root to the given group (for example, "Backend\\API\\").
     */
    private buildGroupPath(group: FileGroup, groupsById: ReadonlyMap<string, FileGroup>): string {
        const names: string[] = [];
        const visitedIds = new Set<string>();
        let current: FileGroup | undefined = group;

        while (current && !visitedIds.has(current.id)) {
            visitedIds.add(current.id);
            names.unshift(current.name);
            current = current.parentId ? groupsById.get(current.parentId) : undefined;
        }

        return `${names.join('\\')}\\`;
    }
}
