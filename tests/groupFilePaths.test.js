import assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, test } from 'node:test';
import { buildGroupFilePathsText, collectGroupFilePaths } from '../src/groupFilePaths.ts';

describe('copy group file paths', () => {
  test('includes subgroup files in deterministic depth-first order', () => {
    const root = path.resolve('repo');
    const paths = {
      root: path.join(root, 'src', 'root.ts'),
      first: path.join(root, 'src', 'first.ts'),
      second: path.join(root, 'src', 'second.ts')
    };
    const groups = [
      {
        id: 'root', name: 'Root', icon: 'folder', color: '', order: 0,
        files: [{ path: paths.root, name: 'root.ts' }]
      },
      {
        id: 'second', name: 'Second', icon: 'folder', color: '', order: 2, parentId: 'root',
        files: [{ path: paths.second, name: 'second.ts' }]
      },
      {
        id: 'first', name: 'First', icon: 'folder', color: '', order: 1, parentId: 'root',
        files: [{ path: paths.first, name: 'first.ts' }]
      }
    ];

    assert.deepEqual(
      collectGroupFilePaths('root', groups, () => true),
      [paths.root, paths.first, paths.second].map(path.normalize)
    );
  });

  test('skips missing files, directories, duplicates, and unrelated groups', () => {
    const root = path.resolve('repo');
    const existing = path.join(root, 'src', 'app.ts');
    const missing = path.join(root, 'src', 'missing.ts');
    const groups = [
      {
        id: 'root', name: 'Root', icon: 'folder', color: '', order: 0,
        files: [
          { path: existing, name: 'app.ts' },
          { path: missing, name: 'missing.ts' },
          { path: path.join(root, 'src'), name: 'src', isDirectory: true }
        ]
      },
      {
        id: 'child', name: 'Child', icon: 'folder', color: '', order: 1, parentId: 'root',
        files: [{ path: existing, name: 'app.ts' }]
      },
      {
        id: 'other', name: 'Other', icon: 'folder', color: '', order: 2,
        files: [{ path: path.join(root, 'other.ts'), name: 'other.ts' }]
      }
    ];

    assert.equal(
      buildGroupFilePathsText('root', groups, (filePath) => filePath === existing),
      path.normalize(existing)
    );
  });
});
