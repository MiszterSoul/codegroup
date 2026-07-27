<!-- markdownlint-disable MD022 MD032 MD060 -->
# CodeGroup - File Organizer

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/PeterDev.codegroup-file-organizer?style=flat-square&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=PeterDev.codegroup-file-organizer)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/PeterDev.codegroup-file-organizer?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=PeterDev.codegroup-file-organizer)
[![Open VSX Installs](https://img.shields.io/open-vsx/dt/PeterDev/codegroup-file-organizer?style=flat-square)](https://open-vsx.org/extension/PeterDev/codegroup-file-organizer)
[![GitHub stars](https://img.shields.io/github/stars/MiszterSoul/codegroup?style=flat-square)](https://github.com/MiszterSoul/codegroup)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

> **Organize scattered files into named groups – like bookmarks for your codebase.**

![CodeGroup Demo GIF](https://raw.githubusercontent.com/MiszterSoul/codegroup/master/images/demo.gif)

---

## ⚡ What It Does

- 📁 **Create custom file groups** – Group related files from any folder into named collections
- 🎨 **Customize with colors & icons** – 120+ icons, hex colors, badges visible in tabs & explorer
- 🖱️ **Drag & drop everything** – Files, folders, groups, subgroups – all draggable

---

## 🚀 Quick Start

1. Open **CodeGroup** in the Explorer sidebar
2. Click **+** to create a new group
3. Drag files from Explorer into your group
4. Done! Click a file to open it, or "Open All" to open the entire group

---

## ✨ Features

### 📁 Groups & Subgroups
- Create named groups to organize related files
- Create **subgroups** for hierarchical organization (e.g., "Backend" → "API", "Database")
- Add files from any folder in your workspace
- Multi-select support: add multiple files at once

### 🎨 Customization
- **120+ icons**: folder, rocket, flame, star, key, database, and more
- **Colors**: extended theme palette plus any **custom hex color** (e.g., `#FF5733`)
- **Badges**: Custom 1-2 character badge for file decorations
- **Descriptions**: Add notes with Markdown support
- **Group Editor**: Update the main settings for a group in one editor panel instead of stepping through separate prompts
- **Presets**: Apply one-click Frontend, Backend, Scripts, Docs, or Research styling presets inside the editor

### 🖱️ Drag & Drop
- Drag files from Explorer into groups
- Drag tabs into groups
- Drag groups into Copilot Chat to attach multiple files at once
- Drag a group into the editor to open its files instantly
- Drag groups onto other groups to create subgroups
- Drag subgroups to empty space to move them back to root
- Reorder files within groups

### ⚡ Quick Actions
- **Open All**: Open all files in a group (including subgroups) with improved speed
- **Close All**: Close only files from a specific group
- **Quick Open**: Search every grouped file from one picker, with recently opened CodeGroup files pinned at the top
- **Quick Actions Section**: Create, import, search, or auto-build groups from a persistent section at the bottom of the tree
- **Pin groups**: Keep important groups at the top (📌)
- **Expand/Collapse All**: Quick navigation in title bar

### ✨ Smart Groups & Sharing
- **Create Smart Groups**: Auto-group the workspace by project areas like frontend, backend, docs, tests, scripts, and source core
- **Language-based Grouping**: Generate groups from language families like TypeScript, JavaScript, styles, docs, config, media, and more
- **Shareable Group JSON**: Export a whole group tree as JSON, copy it to the clipboard, and import it in another workspace later
- **More Group Actions**: The group context menu stays lean, while a single action hub exposes rename, duplicate, move, sort, export, and other advanced operations

### ⚙️ Working Sets
- **Create from Open Editors**: Turn your currently open tabs into a group instantly
- **Create from Git Changes**: Capture your uncommitted work as a review or bugfix group
- Start from a generated working set, then rename or refine it like any other group

### 🔄 Smart File Tracking
- Auto-handles file renames – files stay in groups with updated names
- Auto-removes deleted files from groups
- "Clean Up Missing Files" command for manual cleanup
- Auto-cleanup prompt on startup

### 💾 Git-Friendly Storage
- Groups saved to `.vscode/file-groups.json`
- Share group configs with your team via Git
- Relative paths for cross-machine compatibility
- Creator attribution – see who set up each group

### 🌐 Global Groups
- **Create global groups** available across all your projects
- Stored in AppData (global storage), not tied to any workspace
- Perfect for common utilities, documentation, or frequently accessed files
- **Toggle visibility** per project – hide global groups in specific workspaces
- Visual indicator (🌐) to distinguish global from local groups
- Moving any group (drag or context command) relocates the entire tree to the target storage so files and child groups never split between configs.
- Global groups now behave exactly like local groups – same context menus, drag operations, open/close, and decoration behavior while keeping path handling (absolute vs. relative) consistent.
- Right-click an empty area in the File Groups view to create a new root group without selecting an existing node.

---

## 📋 Commands

All commands available via Command Palette (`Ctrl+Shift+P`):

| Command | Description |
|---------|-------------|
| `File Groups: Quick Open from Groups` | Search and open any grouped file, with recent CodeGroup files first |
| `File Groups: Create Smart Groups` | Auto-build groups by project areas or language families |
| `File Groups: Import Shared Group` | Import a shareable CodeGroup JSON from clipboard or file |
| `File Groups: Export Group as Shareable JSON` | Copy a group tree as reusable JSON |
| `File Groups: More Group Actions...` | Open the advanced action hub for rename, duplicate, move, sort, and export |
| `File Groups: Create Group` | Create a new root file group |
| `File Groups: Create Group from Open Editors` | Create a group from the files currently open in tabs |
| `File Groups: Create Group from Git Changes` | Create a group from uncommitted Git changes in the current workspace |
| `File Groups: Create Subgroup` | Create a subgroup under selected group |
| `File Groups: Open Group Editor` | Edit name, icon, color, badge, descriptions, scope, and file membership in one panel |
| `File Groups: Delete Group...` | Delete a group (with picker) |
| `File Groups: Edit Summary` | Set short description for a group |
| `File Groups: Edit Description` | Add longer Markdown notes |
| `File Groups: Pin/Unpin Group` | Pin group to top |
| `File Groups: Set Badge Text` | Custom badge for file decorations |
| `File Groups: Find Duplicate Files` | Find files in multiple groups |
| `File Groups: Clean Up Missing Files` | Remove deleted files |
| `File Groups: Expand/Collapse All` | Navigation helpers |
| `File Groups: Create Global Group` | Create a global group (available in all projects) |
| `File Groups: Toggle Hide Global Groups` | Show/hide global groups in current project |

---

## 📸 Screenshots

### Main View
![Main View](https://raw.githubusercontent.com/MiszterSoul/codegroup/master/images/screenshot-main.png)

### Context Menu
![Context Menu](https://raw.githubusercontent.com/MiszterSoul/codegroup/master/images/screenshot-context-menu.png)

---

## 💾 Storage Format

Groups are saved to `.vscode/file-groups.json`:

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

---

## 📦 Requirements

- VS Code 1.74.0 or higher

### Development and release

Development and packaging require Node.js 22 or newer. Install the exact locked dependencies first:

```bash
npm ci
```

| Command | Purpose |
|---------|---------|
| `npm run compile` | Type-check, lint, and create a development bundle with a source map |
| `npm test` | Run the fast unit test suite |
| `npm run verify` | Run type checks, lint, and all unit tests |
| `npm run test:extension` | Build and activate CodeGroup in an isolated VS Code 1.74 test host |
| `npm run build` | Run all verification and create the minified production bundle |
| `npm run package:list` | Show exactly which files will be included in the extension |
| `npm run package:vsix` | Verify, build, and create `dist/codegroup-file-organizer.vsix` |

Install the packaged extension locally for a final manual check:

```bash
code --install-extension dist/codegroup-file-organizer.vsix --force
```

Share the `.vsix` file directly, or publish it to the VS Code Marketplace after updating the version in `package.json`:

```bash
npm run vsce:publish
```

Marketplace publishing requires a Personal Access Token and publisher access for `PeterDev`. The first extension-host test also downloads VS Code 1.74 and therefore requires network access.

---

## 🐛 Known Issues

None at this time. Please report issues on [GitHub](https://github.com/MiszterSoul/codegroup/issues).

---

## 📝 Release Notes

See [CHANGELOG.md](CHANGELOG.md) for full release history.

### 1.3.0
- Added persistent Quick Actions under the tree so create/import/smart-group flows stay visible even after you already have groups
- Added Smart Groups for project areas and language families
- Added shareable group export/import via JSON
- Added editor presets and extra color options for faster setup
- Reduced the group context menu and moved advanced actions into one `More Group Actions...` hub

### 1.1.2
- Added drag and drop from groups to Copilot Chat, including multiple files in one drop
- Improved `Open All Files` speed significantly
- Dragging a group into the editor now opens all group files instantly

### 1.2.0
- Added `Quick Open from Groups` to search grouped files by filename, group name, notes, or path
- Recently opened CodeGroup files now float to the top for faster repeat navigation
- Missing files opened from CodeGroup now offer cleanup immediately instead of failing silently

### 1.1.1
- File items now show up to the last 2 parent folders next to filename for easier disambiguation (for example, repeated `route.ts` files)
- Full path on hover remains unchanged

### 1.1.0
- Added global groups available across projects
- Added quick create group action from empty area context menu
---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- 🐛 [Report a bug](https://github.com/MiszterSoul/codegroup/issues/new?labels=bug)
- 💡 [Request a feature](https://github.com/MiszterSoul/codegroup/issues/new?labels=enhancement)
- 🔧 [Submit a PR](https://github.com/MiszterSoul/codegroup/pulls)

---

## 📄 License

[MIT License](LICENSE)

---

**⭐ If you find this extension useful, please leave a review on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=PeterDev.codegroup-file-organizer)!**
