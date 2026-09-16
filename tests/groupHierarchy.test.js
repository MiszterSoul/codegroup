import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { compareGroupOrder, getDescendantGroupIds } from '../src/groupHierarchy.ts';

describe('group hierarchy helpers', () => {
  test('collects descendants without looping on malformed cycles', () => {
    const groups = [
      { id: 'root' },
      { id: 'child', parentId: 'root' },
      { id: 'grandchild', parentId: 'child' },
      { id: 'cycle-a', parentId: 'cycle-b' },
      { id: 'cycle-b', parentId: 'cycle-a' },
      { id: 'unrelated' }
    ];

    assert.deepEqual(
      [...getDescendantGroupIds('root', groups)],
      ['root', 'child', 'grandchild']
    );
    assert.deepEqual(
      [...getDescendantGroupIds('cycle-a', groups)],
      ['cycle-a', 'cycle-b']
    );
  });

  test('sorts pinned groups before their configured order', () => {
    const groups = [
      { id: 'second', order: 2 },
      { id: 'pinned', order: 99, pinned: true },
      { id: 'first', order: 1 }
    ];

    assert.deepEqual(
      groups.sort(compareGroupOrder).map(group => group.id),
      ['pinned', 'first', 'second']
    );
  });
});
