import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { suggestSmartGroups } from '../src/smartGroups.ts';

function file(path, name = path.split(/[\\/]/).pop()) {
  return {
    path,
    name,
    isDirectory: false
  };
}

describe('smart group suggestions', () => {
  test('groups files by project areas', () => {
    const files = [
      file('c:/repo/src/components/Button.tsx'),
      file('c:/repo/src/server/api.ts'),
      file('c:/repo/tests/extension.test.ts'),
      file('c:/repo/scripts/release.ps1'),
      file('c:/repo/docs/guide.md'),
      file('c:/repo/images/logo.svg'),
      file('c:/repo/src/extension.ts')
    ];

    const suggestions = suggestSmartGroups('project-areas', files, 'c:/repo');
    const names = suggestions.map((suggestion) => suggestion.name);

    assert.deepEqual(names, [
      'Frontend',
      'Backend',
      'Tests & QA',
      'Scripts & Tooling',
      'Docs & Notes',
      'Assets & Media',
      'Source Core'
    ]);
    assert.equal(suggestions[0]?.files[0]?.name, 'Button.tsx');
    assert.equal(suggestions[1]?.files[0]?.name, 'api.ts');
    assert.equal(suggestions[6]?.files[0]?.name, 'extension.ts');
  });

  test('groups files by language family', () => {
    const files = [
      file('c:/repo/src/extension.ts'),
      file('c:/repo/web/main.js'),
      file('c:/repo/styles/site.css'),
      file('c:/repo/pages/index.html'),
      file('c:/repo/package.json'),
      file('c:/repo/README.md'),
      file('c:/repo/images/icon.png'),
      file('c:/repo/scripts/setup.ps1'),
      file('c:/repo/server/app.py')
    ];

    const suggestions = suggestSmartGroups('languages', files, 'c:/repo');
    const names = suggestions.map((suggestion) => suggestion.name);

    assert.deepEqual(names, [
      'TypeScript',
      'JavaScript',
      'Styles',
      'Markup & Components',
      'Data & Config',
      'Markdown & Docs',
      'Shell & Automation',
      'Images & Media',
      'Other Code'
    ]);
    assert.equal(suggestions.find(suggestion => suggestion.name === 'Markdown & Docs')?.id, 'markdown');
  });
});