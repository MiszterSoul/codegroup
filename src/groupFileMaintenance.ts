import * as path from 'path';
import type { FileGroup } from './models';
import { canonicalFilePath } from './fileUtils';

/** Remove only entries whose full path matches the deleted resource. */
export function removeGroupedFilePath(groups: FileGroup[], deletedPath: string): number {
    let removedCount = 0;
    const deletedKey = canonicalFilePath(deletedPath);

    for (const group of groups) {
        const originalLength = group.files.length;
        group.files = group.files.filter((file) => canonicalFilePath(file.path) !== deletedKey);
        removedCount += originalLength - group.files.length;
    }

    return removedCount;
}

/** Rename only entries whose full path matches, preserving their metadata. */
export function renameGroupedFilePath(groups: FileGroup[], oldPath: string, newPath: string): number {
    let renamedCount = 0;
    const oldKey = canonicalFilePath(oldPath);

    for (const group of groups) {
        group.files = group.files.map((file) => {
            if (canonicalFilePath(file.path) !== oldKey) {
                return file;
            }

            renamedCount += 1;
            return {
                ...file,
                path: newPath,
                name: path.basename(newPath)
            };
        });
    }

    return renamedCount;
}
