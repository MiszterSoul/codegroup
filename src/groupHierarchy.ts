export type GroupWithParent = {
    id: string;
    parentId?: string;
};

export type SortableGroup = GroupWithParent & {
    order: number;
    pinned?: boolean;
};

export function compareGroupOrder(left: SortableGroup, right: SortableGroup): number {
    return Number(Boolean(right.pinned)) - Number(Boolean(left.pinned))
        || left.order - right.order;
}

/** Return a group and every reachable descendant, even when input contains a cycle. */
export function getDescendantGroupIds(
    rootGroupId: string,
    groups: readonly GroupWithParent[]
): Set<string> {
    const childrenByParent = new Map<string, GroupWithParent[]>();

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
