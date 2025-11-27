import * as os from 'os';

function resolveUsername(): string {
    const override = process.env.CODEGROUP_USERNAME;
    if (override && override.trim().length > 0) {
        return override.trim();
    }

    try {
        const systemUser = os.userInfo().username;
        if (systemUser && systemUser.trim().length > 0) {
            return systemUser.trim();
        }
    } catch {
        // os.userInfo can throw in restricted environments; ignore and fall back to env vars
    }

    const envUser = process.env.USER || process.env.USERNAME || process.env.LOGNAME;
    return envUser ? envUser.trim() : 'unknown';
}

export function normalizeUsername(value?: string): string {
    return (value ?? '').trim().toLowerCase();
}

export const CURRENT_USERNAME = resolveUsername();
export const NORMALIZED_CURRENT_USERNAME = normalizeUsername(CURRENT_USERNAME);
