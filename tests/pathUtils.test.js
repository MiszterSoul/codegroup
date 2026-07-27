import assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, test } from 'node:test';
import { isPathInsideWorkspace, resolveWorkspacePath, toWorkspaceRelativePath } from '../src/pathUtils.ts';

describe('workspace path helpers', () => {
  test('round-trips paths inside a workspace', () => {
    const workspaceRoot = path.resolve('repo');
    const filePath = path.join(workspaceRoot, 'src', 'app.ts');

    assert.equal(toWorkspaceRelativePath(filePath, workspaceRoot), 'src/app.ts');
    assert.equal(resolveWorkspacePath('src/app.ts', workspaceRoot), filePath);
    assert.equal(isPathInsideWorkspace(filePath, workspaceRoot), true);
  });

  test('does not treat sibling folders as workspace children', () => {
    const workspaceRoot = path.resolve('repo');
    const siblingFile = path.resolve('repo-old', 'app.ts');

    assert.equal(toWorkspaceRelativePath(siblingFile, workspaceRoot), siblingFile);
    assert.equal(isPathInsideWorkspace(siblingFile, workspaceRoot), false);
  });

  test('accepts in-workspace names that start with two dots', () => {
    const workspaceRoot = path.resolve('repo');
    const filePath = path.join(workspaceRoot, '..config', 'settings.json');

    assert.equal(toWorkspaceRelativePath(filePath, workspaceRoot), '..config/settings.json');
    assert.equal(isPathInsideWorkspace(filePath, workspaceRoot), true);
  });

  test('resolves relative names containing a colon under the workspace', () => {
    const workspaceRoot = path.resolve('repo');
    assert.equal(
      resolveWorkspacePath('notes:2026/index.md', workspaceRoot),
      path.resolve(workspaceRoot, 'notes:2026/index.md')
    );
  });
});
