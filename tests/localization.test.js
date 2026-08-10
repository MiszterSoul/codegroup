const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const localeFiles = [
  'package.nls.json',
  'package.nls.fr.json',
  'package.nls.de.json',
  'package.nls.hu.json',
  'package.nls.es.json',
  'package.nls.it.json',
  'package.nls.pt-BR.json',
  'package.nls.ja.json',
  'package.nls.zh-CN.json'
];

const releaseKeys = [
  'command.openDirect.title',
  'command.openAll.title',
  'walkthrough.gettingStarted.title',
  'walkthrough.gettingStarted.description',
  'walkthrough.step.bookmarks.title',
  'walkthrough.step.bookmarks.description',
  'walkthrough.step.bookmarks.alt',
  'walkthrough.step.create.title',
  'walkthrough.step.create.description',
  'walkthrough.step.create.alt',
  'walkthrough.step.add.title',
  'walkthrough.step.add.description',
  'walkthrough.step.add.alt',
  'walkthrough.step.tools.title',
  'walkthrough.step.tools.description',
  'walkthrough.step.tools.alt'
];

test('all supported package locales include the 1.4.1 onboarding and open-action strings', () => {
  for (const localeFile of localeFiles) {
    const translations = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', localeFile), 'utf8')
    );

    for (const key of releaseKeys) {
      assert.equal(
        typeof translations[key],
        'string',
        `${localeFile} is missing ${key}`
      );
      assert.ok(translations[key].trim(), `${localeFile} has an empty ${key}`);
    }
  }
});
