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
    'fileGroups.openGettingStarted',
    'fileGroups.createGroup',
    'fileGroups.quickOpen',
    'fileGroups.openGroupEditor',
    'fileGroups.openDirect',
    'fileGroups.openAll',
    'fileGroups.groupActions',
    'fileGroups.copyFilePaths',
    'fileGroups.editGroupTags',
    'fileGroups.editFileTags'
  ]) {
    assert.equal(commands.has(command), true, `${command} should be available in the Command Palette`);
  }
});

test('declares a browser-safe entry point for VS Code Web and Codespaces', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const browserSource = await readFile(new URL('../src/browserExtension.ts', import.meta.url), 'utf8');

  assert.equal(packageJson.main, './out/extension.js');
  assert.equal(packageJson.browser, './out/browserExtension.js');
  assert.deepEqual(packageJson.extensionKind, ['workspace', 'ui']);
  assert.equal(packageJson.capabilities.virtualWorkspaces.supported, true);
  assert.equal(packageJson.capabilities.untrustedWorkspaces.supported, true);
  assert.match(browserSource, /workspace\.fs/);
  assert.doesNotMatch(browserSource, /from ['"](?:fs|path|child_process|crypto)['"]/);
});

test('includes a first-install walkthrough with current screenshots', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const extensionSource = await readFile(new URL('../src/extension.ts', import.meta.url), 'utf8');
  const providerSource = await readFile(new URL('../src/fileGroupsProvider.ts', import.meta.url), 'utf8');
  const walkthrough = packageJson.contributes.walkthroughs.find(item => item.id === 'codegroup.gettingStarted');

  assert.ok(walkthrough);
  assert.equal(walkthrough.steps.length, 6);
  assert.deepEqual(
    walkthrough.steps.map(step => step.media.image).sort(),
    [
      'images/walkthrough-add-files.png',
      'images/walkthrough-bookmarks.png',
      'images/walkthrough-create-group.png',
      'images/walkthrough-language.png',
      'images/walkthrough-share.png',
      'images/walkthrough-tools.png'
    ]
  );
  assert.equal(walkthrough.steps[0].id, 'choose-language');
  assert.equal(walkthrough.steps.at(-1).id, 'share-codegroup');
  for (const step of walkthrough.steps) {
    const image = await readFile(new URL(`../${step.media.image}`, import.meta.url));
    assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
  assert.ok(walkthrough.steps.every(step => step.completionEvents.length > 0));
  assert.match(extensionSource, /workbench\.action\.openWalkthrough/);
  assert.match(extensionSource, /#codegroup\.gettingStarted/);
  assert.match(providerSource, /command: 'fileGroups\.openGettingStarted'/);
});
