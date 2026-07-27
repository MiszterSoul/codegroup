import * as path from 'path';
import { FileGroup, GroupFile } from './models';
import { resolveWorkspacePath, toWorkspaceRelativePath } from './pathUtils';

export type SharedFileGroup = {
  id: string;
  name: string;
  icon: string;
  color: string;
  shortDescription?: string;
  details?: string;
  badgeText?: string;
  sortOrder?: string;
  pinned?: boolean;
  parentId?: string;
  files: GroupFile[];
};

export type SharedGroupPayload = {
  version: 1;
  source: 'codegroup';
  exportedAt: string;
  rootGroupId: string;
  groups: SharedFileGroup[];
};

function normalizePortablePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function toPortablePath(filePath: string, workspaceRoot?: string): string {
  if (!workspaceRoot) {
    return normalizePortablePath(filePath);
  }

  return normalizePortablePath(toWorkspaceRelativePath(filePath, workspaceRoot));
}

function fromPortablePath(filePath: string, workspaceRoot?: string): string {
  if (!workspaceRoot) {
    return path.normalize(filePath);
  }

  return resolveWorkspacePath(filePath, workspaceRoot);
}

function getDescendantGroupIds(rootGroupId: string, groups: readonly FileGroup[]): Set<string> {
  const childrenByParent = new Map<string, FileGroup[]>();
  for (const group of groups) {
    if (!group.parentId) {
      continue;
    }

    const children = childrenByParent.get(group.parentId) ?? [];
    children.push(group);
    childrenByParent.set(group.parentId, children);
  }

  const descendantIds = new Set<string>([rootGroupId]);
  const pendingIds = [rootGroupId];
  while (pendingIds.length > 0) {
    const parentId = pendingIds.pop()!;
    for (const child of childrenByParent.get(parentId) ?? []) {
      if (descendantIds.has(child.id)) {
        continue;
      }

      descendantIds.add(child.id);
      pendingIds.push(child.id);
    }
  }

  return descendantIds;
}

export function isSharedGroupPayload(value: unknown): value is SharedGroupPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const payload = value as Partial<SharedGroupPayload>;
  if (payload.version !== 1
    || payload.source !== 'codegroup'
    || typeof payload.exportedAt !== 'string'
    || typeof payload.rootGroupId !== 'string'
    || payload.rootGroupId.length === 0
    || !Array.isArray(payload.groups)
    || payload.groups.length === 0) {
    return false;
  }

  const groupIds = new Set<string>();
  for (const candidate of payload.groups) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return false;
    }

    const group = candidate as Partial<SharedFileGroup>;
    if (typeof group.id !== 'string'
      || group.id.length === 0
      || groupIds.has(group.id)
      || typeof group.name !== 'string'
      || typeof group.icon !== 'string'
      || typeof group.color !== 'string'
      || !Array.isArray(group.files)) {
      return false;
    }

    const optionalStrings = [group.shortDescription, group.details, group.badgeText, group.sortOrder, group.parentId];
    if (optionalStrings.some(optionalValue => optionalValue !== undefined && typeof optionalValue !== 'string')
      || (group.pinned !== undefined && typeof group.pinned !== 'boolean')) {
      return false;
    }

    for (const candidateFile of group.files) {
      if (!candidateFile || typeof candidateFile !== 'object' || Array.isArray(candidateFile)) {
        return false;
      }

      const file = candidateFile as Partial<GroupFile>;
      if (typeof file.path !== 'string'
        || file.path.length === 0
        || typeof file.name !== 'string'
        || (file.isDirectory !== undefined && typeof file.isDirectory !== 'boolean')) {
        return false;
      }
    }

    groupIds.add(group.id);
  }

  const rootGroup = payload.groups.find(group => group.id === payload.rootGroupId);
  if (!rootGroup || rootGroup.parentId) {
    return false;
  }

  const childrenByParent = new Map<string, SharedFileGroup[]>();
  for (const group of payload.groups) {
    if (!group.parentId || !groupIds.has(group.parentId)) {
      continue;
    }

    const children = childrenByParent.get(group.parentId) ?? [];
    children.push(group);
    childrenByParent.set(group.parentId, children);
  }

  const reachableIds = new Set<string>([payload.rootGroupId]);
  const pendingIds = [payload.rootGroupId];
  while (pendingIds.length > 0) {
    for (const child of childrenByParent.get(pendingIds.pop()!) ?? []) {
      if (reachableIds.has(child.id)) {
        return false;
      }

      reachableIds.add(child.id);
      pendingIds.push(child.id);
    }
  }

  return reachableIds.size === payload.groups.length;
}

export function buildSharedGroupPayload(
  rootGroupId: string,
  groups: readonly FileGroup[],
  workspaceRoot?: string
): SharedGroupPayload {
  const descendantIds = getDescendantGroupIds(rootGroupId, groups);
  const sharedGroups = groups
    .filter((group) => descendantIds.has(group.id))
    .sort((left, right) => left.order - right.order)
    .map((group) => ({
      id: group.id,
      name: group.name,
      icon: group.icon,
      color: group.color,
      shortDescription: group.shortDescription,
      details: group.details,
      badgeText: group.badgeText,
      sortOrder: group.sortOrder,
      pinned: group.pinned,
      parentId: group.parentId && descendantIds.has(group.parentId) ? group.parentId : undefined,
      files: group.files.map((file) => ({
        ...file,
        path: toPortablePath(file.path, workspaceRoot)
      }))
    }));

  return {
    version: 1,
    source: 'codegroup',
    exportedAt: new Date().toISOString(),
    rootGroupId,
    groups: sharedGroups
  };
}

export function importSharedGroupPayload(
  payload: SharedGroupPayload,
  workspaceRoot: string | undefined,
  scope: 'local' | 'global',
  createId: () => string,
  startingOrder: number,
  createdBy?: string
): FileGroup[] {
  const idMap = new Map<string, string>();

  for (const sharedGroup of payload.groups) {
    idMap.set(sharedGroup.id, createId());
  }

  return payload.groups.map((sharedGroup, index) => ({
    id: idMap.get(sharedGroup.id) ?? createId(),
    name: sharedGroup.name,
    icon: sharedGroup.icon || 'folder',
    color: sharedGroup.color || '',
    shortDescription: sharedGroup.shortDescription,
    details: sharedGroup.details,
    badgeText: sharedGroup.badgeText,
    sortOrder: sharedGroup.sortOrder,
    pinned: sharedGroup.pinned ?? false,
    files: sharedGroup.files.map((file) => ({
      ...file,
      path: fromPortablePath(file.path, workspaceRoot)
    })),
    order: startingOrder + index,
    parentId: sharedGroup.parentId ? idMap.get(sharedGroup.parentId) : undefined,
    createdBy,
    collapsed: false,
    isGlobal: scope === 'global'
  }));
}