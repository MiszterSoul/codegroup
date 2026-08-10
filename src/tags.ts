export const MAX_TAGS_PER_ITEM = 24;
export const MAX_TAG_LENGTH = 32;

export function normalizeTags(values: readonly string[] = []): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value
      .trim()
      .replace(/^#+/, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, MAX_TAG_LENGTH);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    tags.push(normalized);

    if (tags.length >= MAX_TAGS_PER_ITEM) {
      break;
    }
  }

  return tags;
}

export function parseTags(value: string): string[] {
  return normalizeTags(value.split(/[,;\n]+/));
}

export function formatTags(tags?: readonly string[]): string {
  return normalizeTags(tags ?? []).map(tag => `#${tag}`).join(' ');
}
