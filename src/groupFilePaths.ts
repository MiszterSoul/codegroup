import * as path from 'path';
import type { FileGroup } from './models';

export type PathExists = (filePath: string) => boolean;

function compareGroups(left: FileGroup, right: FileGroup): number {
    return left.order - right.order
        || left.name.localeCompare(right.name)
        || left.id.localeCompare(right.id);
}

/**
 * Collect file paths from a group and all of its descendants in stable,
 * depth-first group order. Directory entries, missing files, and duplicates
 * are omitted so the result can be pasted directly into external tools.
 */
export function collectGroupFilePaths(
    rootGroupId: string,
    groups: readonly FileGroup[],
    pathExists: PathExists
): string[] {
    const groupsById = new Map(groups.map((group) => [group.id, group]));
    if (!groupsById.has(rootGroupId)) {
        return [];
    }

    const childrenByParent = new Map<string, FileGroup[]>();
    for (const group of groups) {
        if (!group.parentId) {
            continue;
        }

        const children = childrenByParent.get(group.parentId) ?? [];
        children.push(group);
        childrenByParent.set(group.parentId, children);
    }
    for (const children of childrenByParent.values()) {
        children.sort(compareGroups);
    }

    const paths: string[] = [];
    const seenGroups = new Set<string>();
    const seenPaths = new Set<string>();

    const visit = (groupId: string): void => {
        if (seenGroups.has(groupId)) {
            return;
        }
        seenGroups.add(groupId);

        const group = groupsById.get(groupId);
        if (!group) {
            return;
        }

        for (const file of group.files) {
            if (file.isDirectory || !pathExists(file.path)) {
                continue;
            }

            const normalizedPath = path.normalize(file.path);
            if (seenPaths.has(normalizedPath)) {
                continue;
            }

            seenPaths.add(normalizedPath);
            paths.push(normalizedPath);
        }

        for (const child of childrenByParent.get(groupId) ?? []) {
            visit(child.id);
        }
    };

    visit(rootGroupId);
    return paths;
}

export function buildGroupFilePathsText(
    rootGroupId: string,
    groups: readonly FileGroup[],
    pathExists: PathExists
): string {
    return collectGroupFilePaths(rootGroupId, groups, pathExists).join('\n');
}
