<!-- markdownlint-disable MD022 MD032 MD060 -->
<div align="center">

# CodeGroup

### File bookmarks and bookmark folders for VS Code — without moving files.

CodeGroup is a VS Code file-bookmark organizer. Collect related files from any folder into persistent bookmark-style groups, nested bookmark folders, smart working sets, and shareable collections directly inside the Explorer.

[![VS Code Marketplace](https://vsmarketplacebadges.dev/version/PeterDev.codegroup-file-organizer.svg)](https://marketplace.visualstudio.com/items?itemName=PeterDev.codegroup-file-organizer)
[![Installs](https://vsmarketplacebadges.dev/installs/PeterDev.codegroup-file-organizer.svg)](https://marketplace.visualstudio.com/items?itemName=PeterDev.codegroup-file-organizer)
[![Open VSX](https://img.shields.io/open-vsx/dt/PeterDev/codegroup-file-organizer?style=for-the-badge&label=Open%20VSX)](https://open-vsx.org/extension/PeterDev/codegroup-file-organizer)
[![GitHub stars](https://img.shields.io/github/stars/MiszterSoul/codegroup?style=for-the-badge)](https://github.com/MiszterSoul/codegroup)

**[Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=PeterDev.codegroup-file-organizer)** · **[Open VSX](https://open-vsx.org/extension/PeterDev/codegroup-file-organizer)** · **[Report an issue](https://github.com/MiszterSoul/codegroup/issues)**

</div>

<p align="center">
  <img src="https://raw.githubusercontent.com/MiszterSoul/codegroup/master/images/screenshot-quick-actions.png" alt="CodeGroup VS Code file bookmarks and Quick Actions in the Explorer">
</p>

## File bookmarks for VS Code

Large projects rarely fit neatly into folders. A single feature can span routes, components, tests, services, configs, and database files.

Normal folders describe where files live. CodeGroup adds bookmark folders that describe which files belong together while you work—without changing your project structure.

- **Keep feature files together** even when they live in different directories.
- **Build working sets instantly** from open editors or current Git changes.
- **Navigate large codebases faster** with Quick Open and pinned groups.
- **Share team-specific file collections** through Git-friendly JSON.
- **Keep reusable global groups** available across projects.

## Bookmarks, groups, and folders

CodeGroup uses familiar folder ideas without changing the folders on disk:

| CodeGroup concept | Bookmark-style meaning |
|---|---|
| File in a group | A bookmark pointing to the original file |
| Group | A named bookmark collection for a feature, task, or topic |
| Subgroup | A bookmark folder nested inside another collection |
| Local group | A bookmark collection stored with the current workspace |
| Global group | A bookmark collection available across every project |
| Smart Group | A generated starter collection based on project area or language |

The same file can appear in multiple groups because CodeGroup stores references, not copies. Renaming or moving a tracked file updates its bookmark, and deleting a file can be cleaned from the affected groups. Your Explorer folder structure remains unchanged.

## Core features

| Feature | What it gives you |
|---|---|
| File bookmarks & bookmark folders | Organize related files into groups and nested subgroups |
| Drag & drop | Move files, folders, tabs, groups, and subgroups naturally |
| Smart Groups | Auto-build groups by project area or language family |
| Working Sets | Create groups from open editors or Git changes |
| Quick Open | Search grouped files, group names, notes, and paths |
| Global Groups | Reuse important groups across different workspaces |
| Group customization | 120+ icons, colors, badges, descriptions, presets |
| Shareable JSON | Export/import complete group trees |
| Git-friendly storage | Store workspace groups in `.vscode/file-groups.json` |
| Smart file tracking | Follow renames and clean up deleted files |

## Quick start

After a fresh install, VS Code automatically opens the **Getting Started with CodeGroup** walkthrough. It explains the bookmark model and guides you through creating a group, adding files, and reopening a working set. You can revisit it later from **Help → Get Started**.

1. Install **CodeGroup** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=PeterDev.codegroup-file-organizer).
2. Open the **CodeGroup** view inside Explorer.
3. Click **+** to create a group—your first bookmark folder.
4. Drag files from Explorer or open tabs into the bookmark group.
5. Click a file to open it, or use **Open All** for the full working set.

That is enough to start. Everything else is optional.

## Visual group editor

Open any group in the visual editor to manage its name, notes, icon, color, badge, order, storage scope, presets, and file membership in one place.

![CodeGroup visual editor for VS Code file bookmarks and bookmark folders](https://raw.githubusercontent.com/MiszterSoul/codegroup/master/images/screenshot-group-editor.png)

## Smart Groups

CodeGroup can generate useful groups automatically instead of making you organize everything manually.

### Project-area grouping

Create groups such as:

- Frontend
- Backend
- Tests
- Scripts
- Documentation
- Source core

### Language-family grouping

Generate groups for TypeScript, JavaScript, styles, documentation, configuration, media, and more.

Generated groups remain normal editable CodeGroup groups, so you can rename, recolor, reorder, nest, or extend them afterward.

## Working Sets

Turn temporary development context into a reusable group in one action.

### From open editors

Capture your currently open tabs into a group.

Useful for:

- feature work
- debugging sessions
- refactors
- research

### From Git changes

Create a group from uncommitted files in the current workspace.

Useful for:

- PR review
- bugfix context
- release preparation
- keeping a change set visible while working

## Drag & drop

CodeGroup supports drag & drop across the workflow:

- Explorer files → groups
- open tabs → groups
- groups → groups to create subgroups
- subgroups → root
- files → reorder inside groups
- groups → editor to open all files
- groups → Copilot Chat to attach multiple files at once

## Global Groups

Create groups that are available across projects instead of being tied to a single workspace.

Typical uses:

- frequently used scripts
- shared documentation
- utility files
- reference projects

Global groups can be hidden per workspace and can be moved back to local workspace storage when needed.

## Sharing and storage

Workspace groups are stored in:

```text
.vscode/file-groups.json
```

Paths are relative, so the configuration can be committed to Git and shared with a team.

You can also export an individual group tree as shareable JSON and import it elsewhere.

See the copy-paste [shared-group JSON recipes](docs/shared-group-recipes.md) for frontend/backend, bugfix, PR review, and documentation workflows.

Workspace storage example:

```json
{
  "version": 2,
  "groups": [
    {
      "id": "abc123",
      "name": "Authentication",
      "icon": "key",
      "color": "#3498DB",
      "shortDescription": "Login endpoints",
      "files": [
        { "path": "src/auth/login.ts", "name": "login.ts" }
      ]
    }
  ]
}
```

## Screenshots

### Main view

![CodeGroup Quick Actions and file bookmark workflow](https://raw.githubusercontent.com/MiszterSoul/codegroup/master/images/screenshot-quick-actions.png)

### Context menu

![CodeGroup context menu](https://raw.githubusercontent.com/MiszterSoul/codegroup/master/images/screenshot-context-menu.png)

## Commands

<details>
<summary><strong>Show Command Palette commands</strong></summary>

| Command | Description |
|---|---|
| `File Groups: Quick Open from Groups` | Search grouped files, with recent files first |
| `File Groups: Create Smart Groups` | Auto-build groups by project area or language family |
| `File Groups: Import Shared Group` | Import shareable CodeGroup JSON |
| `File Groups: Export Group as Shareable JSON` | Export a reusable group tree |
| `File Groups: Copy File Paths` | Copy existing files from a group and its subgroups, one normalized path per line |
| `File Groups: More Group Actions...` | Rename, duplicate, move, sort, export, and more |
| `File Groups: Create Group` | Create a root group |
| `File Groups: Create Group from Open Editors` | Build a working set from open tabs |
| `File Groups: Create Group from Git Changes` | Build a working set from Git changes |
| `File Groups: Create Subgroup` | Create a nested group |
| `File Groups: Open Group Editor` | Edit group metadata and membership |
| `File Groups: Open This Group's Files` | Open only files directly assigned to the selected group |
| `File Groups: Open Group and Subgroups` | Open files from the selected group and every nested subgroup |
| `File Groups: Delete Group...` | Delete a group |
| `File Groups: Edit Summary` | Set a short description |
| `File Groups: Edit Description` | Add Markdown notes |
| `File Groups: Pin/Unpin Group` | Keep important groups at the top |
| `File Groups: Set Badge Text` | Add a 1–2 character badge |
| `File Groups: Find Duplicate Files` | Find files used in multiple groups |
| `File Groups: Clean Up Missing Files` | Remove deleted files |
| `File Groups: Expand/Collapse All` | Expand or collapse the tree |
| `File Groups: Create Global Group` | Create a cross-project group |
| `File Groups: Toggle Hide Global Groups` | Show/hide global groups for a workspace |

</details>

## Requirements

- VS Code 1.74.0 or newer

## Development

CodeGroup is written in TypeScript.

### Requirements

- Node.js 22+
- npm
- VS Code 1.74+

### Setup

```bash
git clone https://github.com/MiszterSoul/codegroup.git
cd codegroup
npm ci
npm run verify
```

### Useful commands

| Command | Purpose |
|---|---|
| `npm run compile` | Type-check, lint, and create a development bundle |
| `npm test` | Run the fast unit test suite |
| `npm run verify` | Run type checks, lint, and unit tests |
| `npm run test:extension` | Test inside an isolated VS Code host |
| `npm run build` | Create the production bundle |
| `npm run package:list` | Inspect packaged extension files |
| `npm run package:vsix` | Build a local `.vsix` package |

Install the local package with:

```bash
code --install-extension dist/codegroup-file-organizer.vsix --force
```

## Contributing

Contributions are welcome.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

- [Report a bug](https://github.com/MiszterSoul/codegroup/issues/new?labels=bug)
- [Request a feature](https://github.com/MiszterSoul/codegroup/issues/new?labels=enhancement)
- [Browse good first issues](https://github.com/MiszterSoul/codegroup/labels/good%20first%20issue)
- [Open pull requests](https://github.com/MiszterSoul/codegroup/pulls)

## Releases

See [CHANGELOG.md](CHANGELOG.md) for release history.

The current extension manifest version is published through the VS Code Marketplace and Open VSX release flow.

## License

[MIT](LICENSE)

---

<div align="center">

If CodeGroup saves you time, **[star the repository](https://github.com/MiszterSoul/codegroup)** and **[leave a Marketplace review](https://marketplace.visualstudio.com/items?itemName=PeterDev.codegroup-file-organizer)**.

</div>
