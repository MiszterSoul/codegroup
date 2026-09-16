import assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, test } from 'node:test';
import { canonicalFilePath, createGroupFile, getFileName } from '../src/fileUtils.ts';

describe('file helpers', () => {
  test('builds consistent bookmark entries from paths', () => {
    const filePath = path.join('workspace', 'src', 'index.ts');

    assert.equal(getFileName(filePath), 'index.ts');
    assert.deepEqual(createGroupFile(filePath), {
      path: filePath,
      name: 'index.ts',
      isDirectory: false
    });
    assert.deepEqual(createGroupFile(filePath, true), {
      path: filePath,
      name: 'index.ts',
      isDirectory: true
    });
  });

  test('canonicalizes equivalent paths for comparisons', () => {
    const normalizedPath = path.join('workspace', 'src', 'index.ts');
    const equivalentPath = path.join('workspace', 'src', '..', 'src', 'index.ts');

    assert.equal(canonicalFilePath(normalizedPath), canonicalFilePath(equivalentPath));
  });
});
