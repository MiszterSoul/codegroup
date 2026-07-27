import * as path from 'path';

function isOutsideRoot(relativePath: string): boolean {
  return relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath);
}

export function toWorkspaceRelativePath(filePath: string, workspaceRoot: string): string {
  const relativePath = path.relative(workspaceRoot, filePath);
  if (isOutsideRoot(relativePath)) {
    return filePath;
  }

  return (relativePath || '.').replace(/\\/g, '/');
}

export function isPortableAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath)
    || path.win32.isAbsolute(filePath)
    || path.posix.isAbsolute(filePath);
}

export function resolveWorkspacePath(storedPath: string, workspaceRoot: string): string {
  if (isPortableAbsolutePath(storedPath)) {
    return path.isAbsolute(storedPath) ? path.normalize(storedPath) : storedPath;
  }

  return path.resolve(workspaceRoot, storedPath);
}

export function isPathInsideWorkspace(filePath: string, workspaceRoot: string): boolean {
  return !isOutsideRoot(path.relative(workspaceRoot, filePath));
}
