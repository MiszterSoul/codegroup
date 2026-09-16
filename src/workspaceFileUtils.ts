import * as vscode from 'vscode';
import type { GroupFile } from './models';
import { canonicalFilePath, createGroupFile } from './fileUtils';

export function collectOpenEditorUris(): vscode.Uri[] {
    const seenPaths = new Set<string>();
    const uris: vscode.Uri[] = [];

    for (const tabGroup of vscode.window.tabGroups.all) {
        for (const tab of tabGroup.tabs) {
            const tabInput = tab.input;
            if (!tabInput || typeof tabInput !== 'object' || !('uri' in tabInput)) {
                continue;
            }

            const uri = (tabInput as { uri: vscode.Uri }).uri;
            if (uri.scheme !== 'file') {
                continue;
            }

            const fileKey = canonicalFilePath(uri.fsPath);
            if (seenPaths.has(fileKey)) {
                continue;
            }

            seenPaths.add(fileKey);
            uris.push(uri);
        }
    }

    return uris;
}

export async function toGroupFile(uri: vscode.Uri): Promise<GroupFile> {
    let isDirectory = false;

    try {
        const stat = await vscode.workspace.fs.stat(uri);
        isDirectory = (stat.type & vscode.FileType.Directory) !== 0;
    } catch {
        // Treat resources that cannot be inspected as files.
    }

    return createGroupFile(uri.fsPath, isDirectory);
}

export async function parseFileUris(item: vscode.DataTransferItem): Promise<vscode.Uri[]> {
    const value = await item.asString();
    const seenPaths = new Set<string>();
    const uris: vscode.Uri[] = [];

    for (const line of value.split(/[\r\n]+/)) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }

        let uri: vscode.Uri;
        try {
            uri = vscode.Uri.parse(trimmed);
        } catch {
            continue;
        }

        if (uri.scheme !== 'file') {
            continue;
        }

        const fileKey = canonicalFilePath(uri.fsPath);
        if (seenPaths.has(fileKey)) {
            continue;
        }

        seenPaths.add(fileKey);
        uris.push(uri);
    }

    return uris;
}
