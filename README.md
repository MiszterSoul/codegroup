# CodeGroup - File Organizer

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/PeterDev.codegroup-file-organizer?style=flat-square&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=PeterDev.codegroup-file-organizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**Organize files from different folders into named groups for quick access.** Perfect for large projects where you need to work with related files scattered across multiple directories.

## 📸 Screenshots

### Main View - Organize Files into Groups
![Main View](https://raw.githubusercontent.com/MiszterSoul/codegroup/master/images/screenshot-main.png)

### Right-Click Context Menu
![Context Menu](https://raw.githubusercontent.com/MiszterSoul/codegroup/master/images/screenshot-context-menu.png)

## ✨ Features

### 📁 Create File Groups & Subgroups
- Create named groups to organize related files
- **Create subgroups** for hierarchical organization (e.g., "Backend" → "API", "Database")
- Add files from any folder in your workspace
- Multi-select support: add multiple files at once

### 🎨 Customize Groups
- **Icons**: Choose from 30+ built-in icons (folder, rocket, flame, star, etc.)
- **Colors**: Apply predefined colors OR **custom hex colors** to group icons AND file tabs/explorer
- Enter any hex color code (e.g., `#FF5733`, `#3498DB`) for precise color matching

### ➕ Multiple Ways to Add Files
- **Right-click in Explorer**: Select files → "Add to File Group"
- **Right-click on Tab**: Click tab → "Add to File Group"
- **Drag & Drop**: Drag files from Explorer directly into a group in the sidebar

### 📂 Quick Actions
- **Open All**: Open all files in a group (including subgroups) with one click
- **Close All**: Close only the files belonging to a group (keeps other tabs)
- **Expand All / Collapse All**: Quick navigation buttons in the title bar
- **Delete from Title Bar**: Quick delete button without right-clicking

### 🔄 Drag & Drop Support
- Drag files from Explorer into groups
- Drag tabs into groups
- **Drag groups onto other groups** to create subgroups
- **Drag subgroups to empty space** to move them back to root level
- Move files between groups by dragging

### 🔃 Smart File Tracking
- **Automatic rename handling**: When you rename a file in VS Code, it stays in its group with the new name
- **Automatic deletion handling**: Deleted files are automatically removed from groups
- **Clean Up command**: Manually remove any missing files that were deleted outside VS Code

### 💾 Git-Friendly Storage
- Groups are saved to `.vscode/file-groups.json`
- **Commit to Git** to share group configurations with your team
- Relative paths for portability across machines

## Usage

1. Click the **File Groups** icon (📦) in the Activity Bar (sidebar)
2. Click the **+** button to create a new group
3. Add files by:
   - Right-clicking files in Explorer → "Add to File Group"
   - Right-clicking a tab → "Add to File Group"
   - Dragging files into a group
4. Click a group to expand/collapse it
5. Right-click a group for more options:
   - Open All Files
   - Close All Files
   - Create Subgroup
   - Rename
   - Set Icon
   - Set Color
   - Delete

### Creating Subgroups

1. Right-click on any group
2. Select "Create Subgroup"
3. Enter a name (e.g., "Frontend", "API", "Tests")
4. Subgroups inherit the parent's color by default

### Opening Files

- **Open group files only**: Click "Open All" on a subgroup
- **Open group + all subgroups**: Click "Open All" on a parent group

## Commands

All commands are available in the Command Palette (Ctrl+Shift+P):

| Command | Description |
|---------|-------------|
| `File Groups: Create Group` | Create a new root file group |
| `File Groups: Create Subgroup` | Create a subgroup under selected group |
| `File Groups: Delete Group...` | Delete a group (with picker) |
| `File Groups: Expand All` | Expand all groups |
| `File Groups: Collapse All` | Collapse all groups |
| `File Groups: Clean Up Missing Files` | Remove files that no longer exist |
| `File Groups: Refresh` | Refresh the groups view |

## Storage

Groups are saved in two locations:
1. **Workspace state** (VS Code internal) - for immediate use
2. **`.vscode/file-groups.json`** - for Git sync and team sharing

### Example file-groups.json

```json
{
  "version": 1,
  "groups": [
    {
      "id": "abc123",
      "name": "Authentication",
      "icon": "key",
      "color": "charts.blue",
      "files": [
        { "path": "src/auth/login.ts", "name": "login.ts" },
        { "path": "src/auth/logout.ts", "name": "logout.ts" }
      ],
      "order": 0
    }
  ]
}
```

## Requirements

- VS Code version 1.74.0 or higher

## Extension Settings

This extension does not add any VS Code settings. All configuration is done through the File Groups panel.

## Known Issues

None at this time. Please report issues on [GitHub](https://github.com/MiszterSoul/codegroup/issues).

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

### 1.0.0

Initial release with full feature set:
- File groups and subgroups
- Custom icons and colors
- Drag & drop support
- Git-friendly storage
- Tab/Explorer coloring

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request on [GitHub](https://github.com/MiszterSoul/codegroup).

## License

This extension is licensed under the [MIT License](LICENSE).

---

**Enjoy organizing your files!** ⭐ If you find this extension useful, please consider leaving a review on the VS Code Marketplace.
