# CodeGroup - File Organizer

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/PeterDev.codegroup-file-organizer?style=flat-square&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=PeterDev.codegroup-file-organizer)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/PeterDev.codegroup-file-organizer?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=PeterDev.codegroup-file-organizer)
[![GitHub stars](https://img.shields.io/github/stars/MiszterSoul/codegroup?style=flat-square)](https://github.com/MiszterSoul/codegroup)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

> **Organize scattered files into named groups – like bookmarks for your codebase.**

---

## ⚡ What It Does

- 📁 **Create custom file groups** – Group related files from any folder into named collections
- 🎨 **Customize with colors & icons** – 120+ icons, hex colors, badges visible in tabs & explorer
- 🖱️ **Drag & drop everything** – Files, folders, groups, subgroups – all draggable

![CodeGroup Demo](https://raw.githubusercontent.com/MiszterSoul/codegroup/master/images/screenshot-main.png)

<!-- TODO: Replace with a short GIF (8-12 sec) showing: create group → drag file → open all -->
<!-- ![CodeGroup Demo GIF](https://raw.githubusercontent.com/MiszterSoul/codegroup/master/images/demo.gif) -->

---

## 🚀 Quick Start

1. Click the **File Groups** icon (📦) in the Activity Bar
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
- **Colors**: 9 predefined colors OR any **custom hex color** (e.g., `#FF5733`)
- **Badges**: Custom 1-2 character badge for file decorations
- **Descriptions**: Add notes with Markdown support

### 🖱️ Drag & Drop
- Drag files from Explorer into groups
- Drag tabs into groups
- Drag groups onto other groups to create subgroups
- Drag subgroups to empty space to move them back to root
- Reorder files within groups

### ⚡ Quick Actions
- **Open All**: Open all files in a group (including subgroups)
- **Close All**: Close only files from a specific group
- **Pin groups**: Keep important groups at the top (📌)
- **Expand/Collapse All**: Quick navigation in title bar

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

---

## 📋 Commands

All commands available via Command Palette (`Ctrl+Shift+P`):

| Command | Description |
|---------|-------------|
| `File Groups: Create Group` | Create a new root file group |
| `File Groups: Create Subgroup` | Create a subgroup under selected group |
| `File Groups: Delete Group...` | Delete a group (with picker) |
| `File Groups: Edit Summary` | Set short description for a group |
| `File Groups: Edit Description` | Add longer Markdown notes |
| `File Groups: Pin/Unpin Group` | Pin group to top |
| `File Groups: Set Badge Text` | Custom badge for file decorations |
| `File Groups: Find Duplicate Files` | Find files in multiple groups |
| `File Groups: Clean Up Missing Files` | Remove deleted files |
| `File Groups: Expand/Collapse All` | Navigation helpers |

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

---

## 🐛 Known Issues

None at this time. Please report issues on [GitHub](https://github.com/MiszterSoul/codegroup/issues).

---

## 📝 Release Notes

See [CHANGELOG.md](CHANGELOG.md) for full release history.

### 1.0.3
- Persistent expand/collapse state
- Group summaries & descriptions
- Pin/Unpin groups
- Custom badge text
- Activity bar badge
- Find duplicate files

### 1.0.2
- Folder support
- 120+ icons (was 30)
- Manual file reordering

### 1.0.0
- Initial release with groups, subgroups, icons, colors, drag & drop

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
