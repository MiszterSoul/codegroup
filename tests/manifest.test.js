import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('uses the Quick Actions tree instead of welcome buttons', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(packageJson.contributes.viewsWelcome, undefined);
  assert.ok(packageJson.contributes.views.explorer.some(view => view.id === 'fileGroupsView'));
});

test('exposes core group actions to keyboard users', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const commands = new Set(packageJson.contributes.commands.map(command => command.command));

  for (const command of [
    'fileGroups.createGroup',
    'fileGroups.quickOpen',
    'fileGroups.openGroupEditor',
    'fileGroups.openDirect',
    'fileGroups.openAll',
    'fileGroups.groupActions',
    'fileGroups.copyFilePaths'
  ]) {
    assert.equal(commands.has(command), true, `${command} should be available in the Command Palette`);
  }
});

test('includes a first-install walkthrough with current screenshots', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const walkthrough = packageJson.contributes.walkthroughs.find(item => item.id === 'codegroup.gettingStarted');

  assert.ok(walkthrough);
  assert.equal(walkthrough.steps.length, 4);
  assert.deepEqual(
    [...new Set(walkthrough.steps.map(step => step.media.image))].sort(),
    [
      'images/screenshot-group-editor.png',
      'images/screenshot-quick-actions.png'
    ]
  );
  assert.ok(walkthrough.steps.every(step => step.completionEvents.length > 0));
});
