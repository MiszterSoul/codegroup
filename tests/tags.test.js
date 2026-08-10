import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { formatTags, normalizeTags, parseTags } from '../src/tags.ts';

describe('searchable tags', () => {
  test('normalizes labels for stable search and storage', () => {
    assert.deepEqual(
      normalizeTags([' #Front End ', 'URGENT', 'front-end', '', 'Needs Review']),
      ['front-end', 'urgent', 'needs-review']
    );
  });

  test('parses common tag separators', () => {
    assert.deepEqual(parseTags('frontend, urgent; review\nDocs'), ['frontend', 'urgent', 'review', 'docs']);
  });

  test('formats tags for tree and quick-open search details', () => {
    assert.equal(formatTags(['frontend', 'urgent']), '#frontend #urgent');
    assert.equal(formatTags(undefined), '');
  });

  test('bounds tag count and length', () => {
    const tags = normalizeTags(Array.from({ length: 30 }, (_, index) => `${index}-${'x'.repeat(40)}`));
    assert.equal(tags.length, 24);
    assert.ok(tags.every(tag => tag.length <= 32));
  });
});
