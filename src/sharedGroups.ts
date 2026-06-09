import * as path from 'path';
import { FileGroup, GroupFile } from './models';

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

function isPortableAbsolutePath(filePath: string): boolean {
  return /^([A-Za-z]:\/|\\\\|\/)/.test(filePath);
}

function toPortablePath(filePath: string, workspaceRoot?: string): string {
  if (!workspaceRoot) {
    return normalizePortablePath(filePath);
  }

  const relativePath = path.relative(workspaceRoot, filePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return normalizePortablePath(filePath);
  }

  return normalizePortablePath(relativePath);
}

function fromPortablePath(filePath: string, workspaceRoot?: string): string {
  if (isPortableAbsolutePath(filePath) || !workspaceRoot) {
    return path.normalize(filePath);
  }

  return path.normalize(path.resolve(workspaceRoot, filePath));
}

function getDescendantGroupIds(rootGroupId: string, groups: readonly FileGroup[]): Set<string> {
  const descendantIds = new Set<string>([rootGroupId]);
  let changed = true;

  while (changed) {
    changed = false;

    for (const group of groups) {
      if (group.parentId && descendantIds.has(group.parentId) && !descendantIds.has(group.id)) {
        descendantIds.add(group.id);
        changed = true;
      }
    }
  }

  return descendantIds;
}

export function isSharedGroupPayload(value: unknown): value is SharedGroupPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<SharedGroupPayload>;
  return payload.version === 1
    && payload.source === 'codegroup'
    && typeof payload.rootGroupId === 'string'
    && Array.isArray(payload.groups);
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