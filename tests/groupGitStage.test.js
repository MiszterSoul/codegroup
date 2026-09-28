import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { stageGroupChanges } from '../src/groupGitStage.ts';

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function createRepository(root) {
  fs.mkdirSync(root, { recursive: true });
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.invalid');
  git(root, 'config', 'user.name', 'CodeGroup Test');
  for (const name of ['selected.txt', 'child.txt', 'unrelated.txt', '[special].txt']) {
    fs.writeFileSync(path.join(root, name), 'original\n');
  }
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'initial');
}

test('stages only changed bookmarked files across subgroups and repositories', async () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codegroup-stage-'));
  try {
    const first = path.join(temporaryRoot, 'first');
    const second = path.join(temporaryRoot, 'second');
    createRepository(first);
    createRepository(second);
    fs.writeFileSync(path.join(first, 'selected.txt'), 'changed\n');
    fs.writeFileSync(path.join(first, 'child.txt'), 'changed\n');
    fs.writeFileSync(path.join(first, 'unrelated.txt'), 'changed\n');
    fs.writeFileSync(path.join(first, '[special].txt'), 'changed\n');
    fs.writeFileSync(path.join(second, 'selected.txt'), 'changed\n');
    const groups = [
      { id: 'root', name: 'Root', icon: 'folder', color: '', order: 0, files: [
        { path: path.join(first, 'selected.txt'), name: 'selected.txt' },
        { path: path.join(first, '[special].txt'), name: '[special].txt' },
        { path: path.join(second, 'selected.txt'), name: 'selected.txt' }
      ] },
      { id: 'child', parentId: 'root', name: 'Child', icon: 'folder', color: '', order: 1, files: [
        { path: path.join(first, 'child.txt'), name: 'child.txt' }
      ] },
      { id: 'other', name: 'Other', icon: 'folder', color: '', order: 2, files: [
        { path: path.join(first, 'unrelated.txt'), name: 'unrelated.txt' }
      ] }
    ];

    assert.deepEqual(await stageGroupChanges('root', groups, [first, second]), {
      stagedCount: 4, repositoryCount: 2
    });
    assert.deepEqual(git(first, 'diff', '--cached', '--name-only').trim().split(/\r?\n/),
      ['[special].txt', 'child.txt', 'selected.txt']);
    assert.equal(git(first, 'diff', '--name-only').trim(), 'unrelated.txt');
    assert.equal(git(second, 'diff', '--cached', '--name-only').trim(), 'selected.txt');
    assert.equal((await stageGroupChanges('root', groups, [first, second])).stagedCount, 0);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('stages bookmarked additions and deletions while leaving other changes alone', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codegroup-stage-'));
  try {
    createRepository(root);
    fs.unlinkSync(path.join(root, 'selected.txt'));
    fs.writeFileSync(path.join(root, 'new file.txt'), 'new\n');
    fs.writeFileSync(path.join(root, 'unrelated.txt'), 'changed\n');
    const groups = [{ id: 'root', name: 'Root', icon: 'folder', color: '', order: 0, files: [
      { path: path.join(root, 'selected.txt'), name: 'selected.txt' },
      { path: path.join(root, 'new file.txt'), name: 'new file.txt' }
    ] }];

    assert.equal((await stageGroupChanges('root', groups, [root])).stagedCount, 2);
    assert.deepEqual(git(root, 'diff', '--cached', '--name-only').trim().split(/\r?\n/),
      ['new file.txt', 'selected.txt']);
    assert.equal(git(root, 'diff', '--name-only').trim(), 'unrelated.txt');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
