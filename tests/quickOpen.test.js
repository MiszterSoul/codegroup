import assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, test } from 'node:test';
import { buildGroupTrail, buildGroupedFileQuickOpenSections, makeRecentGroupFileKey, normalizeRecentGroupFileKeys } from '../src/quickOpen.ts';

describe('quick open helpers', () => {
  test('builds nested group trails from parent relationships', () => {
    const groups = [
      {
        id: 'root',
        name: 'Backend',
        icon: 'server',
        color: '',
        files: [],
        order: 0
      },
      {
        id: 'child',
        name: 'API',
        icon: 'rocket',
        color: '',
        files: [],
        order: 1,
        parentId: 'root'
      }
    ];

    assert.equal(buildGroupTrail(groups[1], new Map(groups.map(group => [group.id, group]))), 'Backend / API');
  });

  test('dedupes and caps recent group file keys', () => {
    const keys = normalizeRecentGroupFileKeys(['a', 'b', 'a', 'c'], 2);
    assert.deepEqual(keys, ['a', 'b']);
    assert.deepEqual(normalizeRecentGroupFileKeys(['a'], 0), []);
    assert.deepEqual(normalizeRecentGroupFileKeys(['a'], -1), []);
  });

  test('keeps two-dot-prefixed workspace folders relative', () => {
    const workspaceRoot = path.resolve('repo');
    const groups = [{
      id: 'root',
      name: 'Config',
      icon: 'gear',
      color: '',
      files: [{ path: path.join(workspaceRoot, '..config', 'app.json'), name: 'app.json' }],
      order: 0
    }];

    const { otherItems } = buildGroupedFileQuickOpenSections(groups, [], workspaceRoot);
    assert.match(otherItems[0]?.detail ?? '', /^\.\.config[\\/]app\.json$/);
  });

  test('prioritizes recent grouped files and hides directories from quick open', () => {
    const groups = [
      {
        id: 'root',
        name: 'Backend',
        icon: 'server',
        color: '',
        shortDescription: 'Service endpoints',
        files: [
          { path: 'c:/repo/src/api.ts', name: 'api.ts' },
          { path: 'c:/repo/src/feature', name: 'feature', isDirectory: true }
        ],
        order: 0,
        pinned: true
      },
      {
        id: 'child',
        name: 'Docs',
        icon: 'book',
        color: '',
        files: [
          { path: 'c:/repo/README.md', name: 'README.md' }
        ],
        order: 1,
        isGlobal: true
      }
    ];

    const recentKey = makeRecentGroupFileKey('child', 'c:/repo/README.md');
    const { recentItems, otherItems } = buildGroupedFileQuickOpenSections(groups, [recentKey], 'c:/repo');

    assert.deepEqual(recentItems.map(item => item.fileName), ['README.md']);
    assert.match(recentItems[0]?.detail ?? '', /README\.md/);
    assert.match(recentItems[0]?.detail ?? '', /Global group/);
    assert.deepEqual(otherItems.map(item => item.fileName), ['api.ts']);
    assert.match(otherItems[0]?.detail ?? '', /src[\\/]api\.ts/);
    assert.match(otherItems[0]?.detail ?? '', /Service endpoints/);
  });
});