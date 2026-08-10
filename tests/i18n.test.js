import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { hasExplicitTranslationForLanguage, normalizeCodeGroupLanguage, translateForLanguage } from '../src/i18n.ts';

describe('runtime translations', () => {
  test('accepts supported language codes and falls back for unsupported ones', () => {
    assert.equal(normalizeCodeGroupLanguage('es'), 'es');
    assert.equal(normalizeCodeGroupLanguage('it'), 'it');
    assert.equal(normalizeCodeGroupLanguage('pt-BR'), 'pt-BR');
    assert.equal(normalizeCodeGroupLanguage('ja'), 'ja');
    assert.equal(normalizeCodeGroupLanguage('zh-CN'), 'zh-CN');
    assert.equal(normalizeCodeGroupLanguage(undefined), 'en');
    assert.equal(normalizeCodeGroupLanguage('ko'), 'en');
  });

  test('returns translated runtime strings with english fallback for sparse dictionaries', () => {
    assert.equal(translateForLanguage('fr', 'tree.section.quickActions'), 'Actions rapides');
    assert.equal(translateForLanguage('de', 'action.changeLanguage'), 'Sprache ändern');
    assert.equal(translateForLanguage('hu', 'quickOpen.detail.globalGroup'), 'Globális csoport');
    assert.equal(translateForLanguage('es', 'tree.section.quickActions'), 'Acciones rápidas');
    assert.equal(translateForLanguage('pt-BR', 'editor.title'), 'Editar grupo');
    assert.equal(translateForLanguage('ja', 'action.changeLanguage'), '言語を変更');
    assert.equal(translateForLanguage('zh-CN', 'editor.membership.title'), '内容');
    assert.equal(translateForLanguage('it', 'quickOpen.separator.recent'), 'Recently Opened');
  });

  test('translates every recently added bookmark, path, and accessibility string', () => {
    const languages = ['en', 'fr', 'de', 'hu', 'es', 'it', 'pt-BR', 'ja', 'zh-CN'];
    const keys = [
      'group.accessibility.global',
      'group.accessibility.local',
      'group.accessibility.pinned',
      'group.accessibility.hasDetails',
      'groupPaths.pick',
      'groupPaths.empty',
      'groupPaths.copied',
      'groupActions.copyPaths.label',
      'groupActions.copyPaths.description',
      'editor.template.groupLabel',
      'editor.actions.openFileAccessible',
      'editor.actions.removeFileAccessible'
    ];

    for (const language of languages) {
      for (const key of keys) {
        assert.equal(
          hasExplicitTranslationForLanguage(language, key),
          true,
          `${language} should explicitly translate ${key}`
        );
      }
    }
  });
});
