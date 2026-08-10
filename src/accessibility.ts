export function stripCodicons(label: string): string {
    return label.replace(/^\$\([^)]+\)\s*/, '').trim();
}

export function joinAccessibilityLabel(parts: Array<string | undefined | false>): string {
    return parts
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        .map((part) => part.trim().replace(/[.\s]+$/, ''))
        .join('. ') + '.';
}

export function buildActionAccessibilityLabel(label: string, description?: string): string {
    return joinAccessibilityLabel([stripCodicons(label), description]);
}
