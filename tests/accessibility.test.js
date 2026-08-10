import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, test } from 'node:test';
import { buildActionAccessibilityLabel, joinAccessibilityLabel, stripCodicons } from '../src/accessibility.ts';

describe('accessibility labels', () => {
  test('removes codicon markup and keeps meaningful action text', () => {
    assert.equal(stripCodicons('$(copy) Copy File Paths'), 'Copy File Paths');
    assert.equal(
      buildActionAccessibilityLabel('$(copy) Copy File Paths', 'Copy files from this group'),
      'Copy File Paths. Copy files from this group.'
    );
    assert.equal(joinAccessibilityLabel(['Backend', 'Workspace group', 'Pinned']), 'Backend. Workspace group. Pinned.');
  });

  test('group editor labels its checkbox and repeated file actions', async () => {
    const source = await readFile(new URL('../src/groupEditorPanel.ts', import.meta.url), 'utf8');

    assert.match(source, /aria-labelledby="pin-title" aria-describedby="pin-hint"/);
    assert.match(source, /editor\.actions\.openFileAccessible/);
    assert.match(source, /editor\.actions\.removeFileAccessible/);
    assert.match(source, /role="status" aria-live="polite"/);
  });
});
