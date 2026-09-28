import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { FileGroup } from './models';
import { collectGroupFilePaths } from './groupFilePaths';
import { canonicalFilePath } from './fileUtils';
import { isPathInsideWorkspace } from './pathUtils';

function git(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile('git', args, { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

function pathsFromGit(output: string, repositoryRoot: string): string[] {
    return output.split('\0').filter(Boolean).map((relativePath) => path.resolve(repositoryRoot, relativePath));
}

export type GroupStageResult = { stagedCount: number; repositoryCount: number };

/** Stage only unstaged or untracked bookmarked files in open workspace repositories. */
export async function stageGroupChanges(
    groupId: string,
    groups: readonly FileGroup[],
    workspaceRoots: readonly string[]
): Promise<GroupStageResult> {
    // Keep missing bookmarks: Git can still stage a tracked file's deletion.
    const groupPaths = collectGroupFilePaths(groupId, groups, () => true);
    const repositories = new Map<string, Set<string>>();
    const rootsByDirectory = new Map<string, string | undefined>();

    for (const filePath of groupPaths) {
        const workspaceRoot = workspaceRoots.find((root) => isPathInsideWorkspace(filePath, root));
        if (!workspaceRoot) {
            continue;
        }

        let directory = path.dirname(filePath);
        while (!fs.existsSync(directory) && isPathInsideWorkspace(directory, workspaceRoot)) {
            const parent = path.dirname(directory);
            if (parent === directory) {
                break;
            }
            directory = parent;
        }

        let repositoryRoot: string;
        if (!rootsByDirectory.has(directory)) {
            try {
                rootsByDirectory.set(directory, (await git(['rev-parse', '--show-toplevel'], directory)).trim());
            } catch {
                rootsByDirectory.set(directory, undefined);
            }
        }
        repositoryRoot = rootsByDirectory.get(directory) ?? '';
        if (!repositoryRoot || !isPathInsideWorkspace(filePath, repositoryRoot)) {
            continue;
        }

        const paths = repositories.get(repositoryRoot) ?? new Set<string>();
        paths.add(canonicalFilePath(filePath));
        repositories.set(repositoryRoot, paths);
    }

    let stagedCount = 0;
    for (const [repositoryRoot, bookmarkedPaths] of repositories) {
        if (bookmarkedPaths.size === 0) {
            continue;
        }

        const [unstaged, untracked] = await Promise.all([
            git(['diff', '--no-renames', '--name-only', '-z', '--'], repositoryRoot),
            git(['ls-files', '--others', '--exclude-standard', '-z', '--'], repositoryRoot)
        ]);
        const changedPaths = new Set([...pathsFromGit(unstaged, repositoryRoot), ...pathsFromGit(untracked, repositoryRoot)]
            .filter((filePath) => bookmarkedPaths.has(canonicalFilePath(filePath))));

        for (const filePath of changedPaths) {
            const relativePath = path.relative(repositoryRoot, filePath).replace(/\\/g, '/');
            await git(['add', '-A', '--', `:(literal)${relativePath}`], repositoryRoot);
            stagedCount++;
        }
    }

    return { stagedCount, repositoryCount: repositories.size };
}
