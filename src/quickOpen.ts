import * as path from 'path';
import { t } from './i18n';
import { FileGroup } from './models';

export const MAX_RECENT_GROUP_FILES = 20;

export interface GroupedFileQuickOpenItem {
  key: string;
  groupId: string;
  groupName: string;
  groupTrail: string;
  groupIcon: string;
  groupIsGlobal: boolean;
  groupPinned: boolean;
  fileName: string;
  filePath: string;
  detail: string;
  recentIndex?: number;
}

export interface GroupedFileQuickOpenSections {
  recentItems: GroupedFileQuickOpenItem[];
  otherItems: GroupedFileQuickOpenItem[];
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

function getDisplayPath(filePath: string, workspaceRoot?: string): string {
  if (!workspaceRoot) {
    return filePath;
  }

  const relativePath = path.relative(workspaceRoot, filePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return filePath;
  }

  return relativePath;
}

export function makeRecentGroupFileKey(groupId: string, filePath: string): string {
  return JSON.stringify([groupId, path.normalize(filePath)]);
}

export function normalizeRecentGroupFileKeys(keys: readonly string[], limit: number = MAX_RECENT_GROUP_FILES): string[] {
  const dedupedKeys: string[] = [];
  const seenKeys = new Set<string>();

  for (const key of keys) {
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    dedupedKeys.push(key);

    if (dedupedKeys.length >= limit) {
      break;
    }
  }

  return dedupedKeys;
}

export function buildGroupTrail(group: FileGroup, groupsById: ReadonlyMap<string, FileGroup>): string {
  const visitedGroupIds = new Set<string>([group.id]);
  const names = [group.name];

  let currentGroup = group;
  while (currentGroup.parentId) {
    const parentGroup = groupsById.get(currentGroup.parentId);
    if (!parentGroup || visitedGroupIds.has(parentGroup.id)) {
      break;
    }

    names.unshift(parentGroup.name);
    visitedGroupIds.add(parentGroup.id);
    currentGroup = parentGroup;
  }

  return names.join(' / ');
}

export function buildGroupedFileQuickOpenSections(
  groups: readonly FileGroup[],
  recentKeys: readonly string[],
  workspaceRoot?: string
): GroupedFileQuickOpenSections {
  const groupsById = new Map(groups.map(group => [group.id, group]));
  const normalizedRecentKeys = normalizeRecentGroupFileKeys(recentKeys);
  const recentIndexByKey = new Map(normalizedRecentKeys.map((key, index) => [key, index]));
  const allItems: GroupedFileQuickOpenItem[] = [];

  for (const group of groups) {
    const groupTrail = buildGroupTrail(group, groupsById);

    for (const file of group.files) {
      if (file.isDirectory) {
        continue;
      }

      const key = makeRecentGroupFileKey(group.id, file.path);
      const detailParts = [getDisplayPath(file.path, workspaceRoot)];

      if (group.shortDescription) {
        detailParts.push(group.shortDescription);
      }

      if (group.isGlobal) {
        detailParts.push(t('quickOpen.detail.globalGroup'));
      }

      allItems.push({
        key,
        groupId: group.id,
        groupName: group.name,
        groupTrail,
        groupIcon: group.icon || 'folder',
        groupIsGlobal: Boolean(group.isGlobal),
        groupPinned: Boolean(group.pinned),
        fileName: file.name || path.basename(file.path),
        filePath: file.path,
        detail: detailParts.join(' • '),
        recentIndex: recentIndexByKey.get(key)
      });
    }
  }

  const recentItems = allItems
    .filter(item => item.recentIndex !== undefined)
    .sort((left, right) => (left.recentIndex ?? 0) - (right.recentIndex ?? 0));

  const otherItems = allItems
    .filter(item => item.recentIndex === undefined)
    .sort((left, right) => {
      if (left.groupPinned !== right.groupPinned) {
        return left.groupPinned ? -1 : 1;
      }

      return compareText(left.groupTrail, right.groupTrail)
        || compareText(left.fileName, right.fileName)
        || compareText(left.filePath, right.filePath);
    });

  return {
    recentItems,
    otherItems
  };
}