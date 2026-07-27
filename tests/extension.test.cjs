const assert = require('node:assert/strict');
const vscode = require('vscode');

suite('CodeGroup extension', () => {
  test('activates and registers core commands', async () => {
    const extension = vscode.extensions.getExtension('PeterDev.codegroup-file-organizer');
    assert.ok(extension, 'CodeGroup extension was not found in the test host');

    await extension.activate();
    assert.equal(extension.isActive, true);

    const commands = await vscode.commands.getCommands(true);
    for (const command of [
      'fileGroups.createGroup',
      'fileGroups.quickOpen',
      'fileGroups.openGroupEditor',
      'fileGroups.importSharedGroup'
    ]) {
      assert.ok(commands.includes(command), `${command} was not registered`);
    }
  });
});
