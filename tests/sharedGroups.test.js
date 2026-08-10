import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
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
        tags: ['frontend'],
        files: [{ path: 'c:/repo/src/app.tsx', name: 'app.tsx', tags: ['entrypoint'] }],
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
    assert.deepEqual(payload.groups[0]?.tags, ['frontend']);
    assert.deepEqual(payload.groups[0]?.files[0]?.tags, ['entrypoint']);
    assert.equal(payload.groups[1]?.parentId, 'root');
    assert.equal(isSharedGroupPayload(payload), true);
  });

  test('rejects malformed and ambiguous shared payloads', () => {
    const basePayload = {
      version: 1,
      source: 'codegroup',
      exportedAt: '2026-06-09T00:00:00.000Z',
      rootGroupId: 'root'
    };

    assert.equal(isSharedGroupPayload({ ...basePayload, groups: [null] }), false);
    assert.equal(isSharedGroupPayload({
      ...basePayload,
      groups: [{ id: 'root', name: 'Root', icon: 'folder', color: '', files: 'invalid' }]
    }), false);
    assert.equal(isSharedGroupPayload({
      ...basePayload,
      groups: [
        { id: 'root', name: 'Root', icon: 'folder', color: '', files: [] },
        { id: 'root', name: 'Copy', icon: 'copy', color: '', files: [] }
      ]
    }), false);
    assert.equal(isSharedGroupPayload({
      ...basePayload,
      rootGroupId: 'missing',
      groups: [{ id: 'root', name: 'Root', icon: 'folder', color: '', files: [] }]
    }), false);
    assert.equal(isSharedGroupPayload({
      ...basePayload,
      groups: [
        { id: 'root', name: 'Root', icon: 'folder', color: '', files: [] },
        { id: 'a', name: 'A', icon: 'folder', color: '', parentId: 'b', files: [] },
        { id: 'b', name: 'B', icon: 'folder', color: '', parentId: 'a', files: [] }
      ]
    }), false);
  });

  test('exports two-dot-prefixed workspace folders as relative paths', () => {
    const workspaceRoot = path.resolve('repo');
    const payload = buildSharedGroupPayload('root', [{
      id: 'root',
      name: 'Config',
      icon: 'gear',
      color: '',
      files: [{ path: path.join(workspaceRoot, '..config', 'app.json'), name: 'app.json' }],
      order: 0
    }], workspaceRoot);

    assert.equal(payload.groups[0]?.files[0]?.path, '..config/app.json');
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
          tags: ['Front End'],
          files: [{ path: 'src/app.tsx', name: 'app.tsx', tags: ['Entry Point'] }]
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
    assert.deepEqual(imported[0]?.tags, ['front-end']);
    assert.deepEqual(imported[0]?.files[0]?.tags, ['entry-point']);
    assert.equal(imported[0]?.order, 3);
    assert.equal(imported[1]?.order, 4);
  });

  test('keeps every documented shared-group recipe valid', async () => {
    const recipes = await readFile(new URL('../docs/shared-group-recipes.md', import.meta.url), 'utf8');
    const jsonBlocks = [...recipes.matchAll(/```json\s+([\s\S]*?)```/g)].map((match) => match[1]);

    assert.equal(jsonBlocks.length, 4);
    for (const json of jsonBlocks) {
      assert.equal(isSharedGroupPayload(JSON.parse(json)), true);
    }
  });
});
