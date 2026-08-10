import * as path from 'path';
import type { FileGroup } from './models';

/** Remove only entries whose full path matches the deleted resource. */
export function removeGroupedFilePath(groups: FileGroup[], deletedPath: string): number {
    let removedCount = 0;

    for (const group of groups) {
        const originalLength = group.files.length;
        group.files = group.files.filter((file) => file.path !== deletedPath);
        removedCount += originalLength - group.files.length;
    }

    return removedCount;
}

/** Rename only entries whose full path matches, preserving their metadata. */
export function renameGroupedFilePath(groups: FileGroup[], oldPath: string, newPath: string): number {
    let renamedCount = 0;

    for (const group of groups) {
        group.files = group.files.map((file) => {
            if (file.path !== oldPath) {
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
