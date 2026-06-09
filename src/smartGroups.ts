import * as path from 'path';
import { GroupFile } from './models';

export type SmartGroupStrategy = 'project-areas' | 'languages';

export type GroupTemplate = {
  id: string;
  label: string;
  icon: string;
  color: string;
  badgeText: string;
  shortDescription: string;
};

export type SmartGroupSuggestion = {
  id: string;
  name: string;
  icon: string;
  color: string;
  shortDescription: string;
  files: GroupFile[];
};

type SuggestionRule = Omit<SmartGroupSuggestion, 'files'> & {
  matches: (normalizedPath: string, extension: string, baseName: string) => boolean;
};

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts',
  '.py', '.php', '.go', '.rs', '.rb', '.java', '.cs', '.kt', '.swift', '.cpp', '.c', '.h'
]);

const FRONTEND_EXTENSIONS = new Set(['.tsx', '.jsx', '.vue', '.svelte', '.html', '.css', '.scss', '.sass', '.less']);
const BACKEND_HINT_EXTENSIONS = new Set(['.py', '.php', '.go', '.rb', '.rs', '.java', '.cs']);
const MEDIA_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.mp4', '.mp3']);
const STYLE_EXTENSIONS = new Set(['.css', '.scss', '.sass', '.less']);
const MARKUP_EXTENSIONS = new Set(['.html', '.vue', '.svelte']);
const SHELL_EXTENSIONS = new Set(['.sh', '.ps1', '.bat', '.cmd']);
const JSON_EXTENSIONS = new Set(['.json', '.jsonc', '.yaml', '.yml', '.toml']);
const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.txt']);

const SCRIPT_FILE_PATTERNS = [
  /^package(-lock)?\.json$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
  /^bun\.lockb?$/,
  /^tsconfig(\..+)?\.json$/,
  /^eslint(\.config)?\..+$/,
  /^prettier(\.config)?\..+$/,
  /^vite\.config\..+$/,
  /^webpack\.config\..+$/,
  /^rollup\.config\..+$/,
  /^postcss\.config\..+$/,
  /^tailwind\.config\..+$/,
  /^build\..+$/,
  /^docker-compose\..+$/,
  /^dockerfile$/,
  /^makefile$/
];

export const GROUP_EDITOR_TEMPLATES: GroupTemplate[] = [
  {
    id: 'frontend',
    label: 'Frontend',
    icon: 'paintcan',
    color: 'charts.blue',
    badgeText: 'UI',
    shortDescription: 'UI routes, components, styles, and browser-facing work'
  },
  {
    id: 'backend',
    label: 'Backend',
    icon: 'server',
    color: 'charts.orange',
    badgeText: 'BE',
    shortDescription: 'Services, APIs, jobs, data access, and server flows'
  },
  {
    id: 'scripts',
    label: 'Scripts',
    icon: 'tools',
    color: 'terminal.ansiCyan',
    badgeText: 'OP',
    shortDescription: 'Tooling, automation, build steps, and release helpers'
  },
  {
    id: 'docs',
    label: 'Docs',
    icon: 'book',
    color: 'charts.green',
    badgeText: 'D',
    shortDescription: 'Guides, notes, changelogs, specs, and decision logs'
  },
  {
    id: 'research',
    label: 'Research',
    icon: 'beaker',
    color: 'charts.purple',
    badgeText: 'R',
    shortDescription: 'Experiments, review sets, and temporary investigation work'
  }
];

function normalizePathForMatch(filePath: string, workspaceRoot?: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (!workspaceRoot) {
    return normalizedPath.toLowerCase();
  }

  const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return normalizedPath.toLowerCase();
  }

  return relativePath.toLowerCase();
}

function includesPathPart(normalizedPath: string, parts: string[]): boolean {
  return parts.some((part) => normalizedPath.includes(`/${part}/`) || normalizedPath.startsWith(`${part}/`) || normalizedPath.endsWith(`/${part}`));
}

function isScriptFile(normalizedPath: string, extension: string, baseName: string): boolean {
  return SCRIPT_FILE_PATTERNS.some((pattern) => pattern.test(baseName))
    || includesPathPart(normalizedPath, ['scripts', '.github/workflows', 'tools', 'bin'])
    || SHELL_EXTENSIONS.has(extension);
}

function isDocsFile(normalizedPath: string, extension: string, baseName: string): boolean {
  return DOC_EXTENSIONS.has(extension)
    || includesPathPart(normalizedPath, ['docs', 'notes', 'adr'])
    || ['readme.md', 'changelog.md', 'contributing.md', 'license'].includes(baseName);
}

function isTestFile(normalizedPath: string, extension: string, baseName: string): boolean {
  return normalizedPath.includes('__tests__')
    || includesPathPart(normalizedPath, ['test', 'tests', 'e2e', 'cypress', 'playwright'])
    || baseName.includes('.test.')
    || baseName.includes('.spec.')
    || (extension === '.snap');
}

function isAssetFile(normalizedPath: string, extension: string): boolean {
  return MEDIA_EXTENSIONS.has(extension)
    || includesPathPart(normalizedPath, ['assets', 'images', 'media', 'public', 'static']);
}

function isFrontendFile(normalizedPath: string, extension: string): boolean {
  return FRONTEND_EXTENSIONS.has(extension)
    || includesPathPart(normalizedPath, ['components', 'pages', 'app', 'hooks', 'styles', 'frontend', 'ui'])
    || normalizedPath.includes('/client/')
    || normalizedPath.includes('/web/');
}

function isBackendFile(normalizedPath: string, extension: string): boolean {
  return BACKEND_HINT_EXTENSIONS.has(extension)
    || includesPathPart(normalizedPath, ['server', 'backend', 'api', 'routes', 'controllers', 'services', 'db', 'database', 'prisma', 'migrations'])
    || normalizedPath.includes('/worker/')
    || normalizedPath.includes('/jobs/');
}

function isSourceFile(normalizedPath: string, extension: string): boolean {
  return CODE_EXTENSIONS.has(extension)
    || includesPathPart(normalizedPath, ['src', 'lib', 'app']);
}

const PROJECT_AREA_RULES: SuggestionRule[] = [
  {
    id: 'frontend',
    name: 'Frontend',
    icon: 'paintcan',
    color: 'charts.blue',
    shortDescription: 'UI code, routes, styles, and browser-facing features',
    matches: (normalizedPath, extension) => isFrontendFile(normalizedPath, extension)
  },
  {
    id: 'backend',
    name: 'Backend',
    icon: 'server',
    color: 'charts.orange',
    shortDescription: 'Services, APIs, data access, workers, and server logic',
    matches: (normalizedPath, extension) => isBackendFile(normalizedPath, extension)
  },
  {
    id: 'tests',
    name: 'Tests & QA',
    icon: 'beaker',
    color: 'charts.purple',
    shortDescription: 'Test suites, specs, end-to-end flows, and QA helpers',
    matches: (normalizedPath, extension, baseName) => isTestFile(normalizedPath, extension, baseName)
  },
  {
    id: 'scripts',
    name: 'Scripts & Tooling',
    icon: 'tools',
    color: 'terminal.ansiCyan',
    shortDescription: 'Build scripts, package files, CI, and tool configuration',
    matches: (normalizedPath, extension, baseName) => isScriptFile(normalizedPath, extension, baseName)
  },
  {
    id: 'docs',
    name: 'Docs & Notes',
    icon: 'book',
    color: 'charts.green',
    shortDescription: 'Readmes, specs, notes, and project documentation',
    matches: (normalizedPath, extension, baseName) => isDocsFile(normalizedPath, extension, baseName)
  },
  {
    id: 'assets',
    name: 'Assets & Media',
    icon: 'file-media',
    color: 'terminal.ansiMagenta',
    shortDescription: 'Images, logos, screenshots, icons, and media assets',
    matches: (normalizedPath, extension) => isAssetFile(normalizedPath, extension)
  },
  {
    id: 'source',
    name: 'Source Core',
    icon: 'code',
    color: 'charts.yellow',
    shortDescription: 'Primary source files that do not fit a narrower area bucket',
    matches: (normalizedPath, extension) => isSourceFile(normalizedPath, extension)
  }
];

const LANGUAGE_RULES: SuggestionRule[] = [
  {
    id: 'typescript',
    name: 'TypeScript',
    icon: 'file-code',
    color: 'charts.blue',
    shortDescription: 'TypeScript and TSX files',
    matches: (_normalizedPath, extension) => extension === '.ts' || extension === '.tsx' || extension === '.mts' || extension === '.cts'
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    icon: 'file-code',
    color: 'charts.yellow',
    shortDescription: 'JavaScript and JSX files',
    matches: (_normalizedPath, extension) => extension === '.js' || extension === '.jsx' || extension === '.mjs' || extension === '.cjs'
  },
  {
    id: 'styles',
    name: 'Styles',
    icon: 'paintcan',
    color: 'terminal.ansiMagenta',
    shortDescription: 'CSS, Sass, Less, and styling assets',
    matches: (_normalizedPath, extension) => STYLE_EXTENSIONS.has(extension)
  },
  {
    id: 'markup',
    name: 'Markup & Components',
    icon: 'window',
    color: 'terminal.ansiCyan',
    shortDescription: 'HTML, Vue, and Svelte component markup',
    matches: (_normalizedPath, extension) => MARKUP_EXTENSIONS.has(extension)
  },
  {
    id: 'data',
    name: 'Data & Config',
    icon: 'database',
    color: 'charts.orange',
    shortDescription: 'JSON, YAML, TOML, and structured config files',
    matches: (_normalizedPath, extension) => JSON_EXTENSIONS.has(extension)
  },
  {
    id: 'docs',
    name: 'Markdown & Docs',
    icon: 'book',
    color: 'charts.green',
    shortDescription: 'Markdown, MDX, and text documentation',
    matches: (_normalizedPath, extension, baseName) => isDocsFile(baseName, extension, baseName)
  },
  {
    id: 'shell',
    name: 'Shell & Automation',
    icon: 'terminal',
    color: 'charts.purple',
    shortDescription: 'Shell, PowerShell, and command automation files',
    matches: (_normalizedPath, extension) => SHELL_EXTENSIONS.has(extension)
  },
  {
    id: 'media',
    name: 'Images & Media',
    icon: 'file-media',
    color: 'terminal.ansiMagenta',
    shortDescription: 'Images, video, audio, and visual assets',
    matches: (_normalizedPath, extension) => MEDIA_EXTENSIONS.has(extension)
  },
  {
    id: 'other-code',
    name: 'Other Code',
    icon: 'code',
    color: 'charts.red',
    shortDescription: 'Code files outside the main JS and TS stack',
    matches: (_normalizedPath, extension) => BACKEND_HINT_EXTENSIONS.has(extension)
  }
];

function buildSuggestions(files: readonly GroupFile[], rules: readonly SuggestionRule[], workspaceRoot?: string): SmartGroupSuggestion[] {
  const buckets = new Map(rules.map((rule) => [rule.id, [] as GroupFile[]]));

  for (const file of files) {
    if (file.isDirectory) {
      continue;
    }

    const normalizedPath = normalizePathForMatch(file.path, workspaceRoot);
    const extension = path.extname(normalizedPath).toLowerCase();
    const baseName = path.basename(normalizedPath).toLowerCase();
    const rule = rules.find((candidate) => candidate.matches(normalizedPath, extension, baseName));

    if (!rule) {
      continue;
    }

    buckets.get(rule.id)?.push(file);
  }

  return rules
    .map((rule) => ({
      id: rule.id,
      name: rule.name,
      icon: rule.icon,
      color: rule.color,
      shortDescription: rule.shortDescription,
      files: buckets.get(rule.id) ?? []
    }))
    .filter((suggestion) => suggestion.files.length > 0);
}

export function suggestSmartGroups(
  strategy: SmartGroupStrategy,
  files: readonly GroupFile[],
  workspaceRoot?: string
): SmartGroupSuggestion[] {
  if (strategy === 'languages') {
    return buildSuggestions(files, LANGUAGE_RULES, workspaceRoot);
  }

  return buildSuggestions(files, PROJECT_AREA_RULES, workspaceRoot);
}