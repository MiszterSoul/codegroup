import * as path from 'path';
import type { GroupFile } from './models';

export function getFileName(filePath: string): string {
    return path.basename(filePath);
}

export function canonicalFilePath(filePath: string): string {
    const normalized = path.normalize(filePath);
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export function createGroupFile(filePath: string, isDirectory = false): GroupFile {
    return {
        path: filePath,
        name: getFileName(filePath),
        isDirectory
    };
}
