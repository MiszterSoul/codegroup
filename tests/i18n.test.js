import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { normalizeCodeGroupLanguage, translateForLanguage } from '../src/i18n.ts';

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
});