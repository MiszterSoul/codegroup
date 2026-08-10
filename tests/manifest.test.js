import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('uses the Quick Actions tree instead of welcome buttons', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(packageJson.contributes.viewsWelcome, undefined);
  assert.ok(packageJson.contributes.views.explorer.some(view => view.id === 'fileGroupsView'));
});
