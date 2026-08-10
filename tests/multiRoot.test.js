import assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, test } from 'node:test';
import { removeGroupedFilePath, renameGroupedFilePath } from '../src/groupFileMaintenance.ts';
import { resolveWorkspacePath } from '../src/pathUtils.ts';
import { buildSharedGroupPayload, importSharedGroupPayload } from '../src/sharedGroups.ts';

describe('multi-root grouped file paths', () => {
  test('keeps files from two workspace folders in one shared group', () => {
    const firstRoot = path.resolve('workspace-a');
    const secondRoot = path.resolve('workspace-b');
    const firstFile = path.join(firstRoot, 'src', 'index.ts');
    const secondFile = path.join(secondRoot, 'src', 'index.ts');
    const groups = [{
      id: 'root', name: 'Cross-root work', icon: 'folder', color: '', order: 0,
      files: [
        { path: firstFile, name: 'index.ts' },
        { path: secondFile, name: 'index.ts' }
      ]
    }];

    const payload = buildSharedGroupPayload('root', groups, firstRoot);

    assert.equal(payload.groups[0].files[0].path, 'src/index.ts');
    assert.equal(payload.groups[0].files[1].path, secondFile.replace(/\\/g, '/'));

    let sequence = 0;
    const imported = importSharedGroupPayload(payload, firstRoot, 'local', () => `id-${++sequence}`, 0);
    assert.deepEqual(imported[0].files.map((file) => file.path), [firstFile, secondFile]);
  });

  test('resolves the same relative path against the selected workspace folder', () => {
    const firstRoot = path.resolve('workspace-a');
    const secondRoot = path.resolve('workspace-b');

    assert.equal(resolveWorkspacePath('src/index.ts', firstRoot), path.join(firstRoot, 'src', 'index.ts'));
    assert.equal(resolveWorkspacePath('src/index.ts', secondRoot), path.join(secondRoot, 'src', 'index.ts'));
  });

  test('rename and delete leave same-named files in another root untouched', () => {
    const firstFile = path.resolve('workspace-a', 'src', 'index.ts');
    const secondFile = path.resolve('workspace-b', 'src', 'index.ts');
    const renamedFile = path.resolve('workspace-a', 'src', 'main.ts');
    const groups = [{
      id: 'root', name: 'Cross-root work', icon: 'folder', color: '', order: 0,
      files: [
        { path: firstFile, name: 'index.ts' },
        { path: secondFile, name: 'index.ts' }
      ]
    }];

    assert.equal(renameGroupedFilePath(groups, firstFile, renamedFile), 1);
    assert.deepEqual(groups[0].files, [
      { path: renamedFile, name: 'main.ts' },
      { path: secondFile, name: 'index.ts' }
    ]);

    assert.equal(removeGroupedFilePath(groups, renamedFile), 1);
    assert.deepEqual(groups[0].files, [{ path: secondFile, name: 'index.ts' }]);
  });
});
