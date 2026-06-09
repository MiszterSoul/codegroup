import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildSharedGroupPayload, importSharedGroupPayload, isSharedGroupPayload } from '../src/sharedGroups.ts';

describe('shared groups', () => {
  test('exports a subgroup tree with relative workspace paths', () => {
    const groups = [
      {
        id: 'root',
        name: 'Frontend',
        icon: 'paintcan',
        color: 'charts.blue',
        files: [{ path: 'c:/repo/src/app.tsx', name: 'app.tsx' }],
        order: 0
      },
      {
        id: 'child',
        name: 'Styles',
        icon: 'paintcan',
        color: 'charts.green',
        files: [{ path: 'c:/repo/src/styles/app.css', name: 'app.css' }],
        order: 1,
        parentId: 'root'
      },
      {
        id: 'other',
        name: 'Docs',
        icon: 'book',
        color: 'charts.green',
        files: [{ path: 'c:/repo/README.md', name: 'README.md' }],
        order: 2
      }
    ];

    const payload = buildSharedGroupPayload('root', groups, 'c:/repo');

    assert.equal(payload.groups.length, 2);
    assert.equal(payload.groups[0]?.files[0]?.path, 'src/app.tsx');
    assert.equal(payload.groups[1]?.parentId, 'root');
    assert.equal(isSharedGroupPayload(payload), true);
  });

  test('imports shared groups with remapped ids and resolved paths', () => {
    const payload = {
      version: 1,
      source: 'codegroup',
      exportedAt: '2026-06-09T00:00:00.000Z',
      rootGroupId: 'root',
      groups: [
        {
          id: 'root',
          name: 'Frontend',
          icon: 'paintcan',
          color: 'charts.blue',
          files: [{ path: 'src/app.tsx', name: 'app.tsx' }]
        },
        {
          id: 'child',
          name: 'Styles',
          icon: 'paintcan',
          color: 'charts.green',
          parentId: 'root',
          files: [{ path: 'src/styles/app.css', name: 'app.css' }]
        }
      ]
    };

    let sequence = 0;
    const imported = importSharedGroupPayload(payload, 'c:/repo', 'local', () => `id-${sequence += 1}`, 3, 'tester');

    assert.equal(imported.length, 2);
    assert.equal(imported[0]?.id, 'id-1');
    assert.equal(imported[1]?.parentId, 'id-1');
    assert.equal(imported[0]?.files[0]?.path.replace(/\\/g, '/'), 'c:/repo/src/app.tsx');
    assert.equal(imported[0]?.order, 3);
    assert.equal(imported[1]?.order, 4);
  });
});