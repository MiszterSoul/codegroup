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
- **Descriptions**: Add a short summary plus a longer Markdown-friendly note for every group
- **Custom badge text**: Set a 1-2 character badge for file decorations (default is first letter of group name)

### ➕ Multiple Ways to Add Files
- **Right-click in Explorer**: Select files → "Add to File Group"
- **Right-click on Tab**: Click tab → "Add to File Group"
- **Drag & Drop**: Drag files from Explorer directly into a group in the sidebar

### 📂 Quick Actions
- **Open All**: Open all files in a group (including subgroups) with one click
- **Close All**: Close only the files belonging to a group (keeps other tabs)
- **Expand All / Collapse All**: Quick navigation buttons in the title bar
- **Delete from Title Bar**: Quick delete button without right-clicking
- **Smart collapse state**: Groups remember whether you left them open or closed between sessions
- **Pin / Unpin groups**: Pin frequently used groups to always appear at the top (📌). The right-click menu shows "Pin" or "Unpin" based on the current state.
- **Activity bar badge**: The sidebar icon shows the count of groups or pinned groups

### 📝 Document Your Groups
- Store a short summary that shows beside each group name
- Capture detailed notes (Markdown supported) to explain the purpose of a group
- Display the creator's username when it differs from yours so team ownership stays visible
- Groups with extra notes surface a 📝 indicator so teammates know there's more info

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
- **Auto-cleanup prompt**: On startup, prompts you if missing files are detected
- **Find duplicates**: Quickly locate files that appear in multiple groups

### 📊 Statistics on Hover
- Hover over any group to see file count, folder count, and subgroup count
- Summary, description, and creator info are all shown in the tooltip

### 💾 Git-Friendly Storage
- Groups are saved to `.vscode/file-groups.json`
- **Commit to Git** to share group configurations with your team
- Relative paths for portability across machines
- Creator usernames travel with the file so teammates know who set things up

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
   - Edit Summary
   - Edit Description
   - Show Description
   - Pin/Unpin Group
   - Set Badge Text
   - Show Statistics
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
| `File Groups: Edit Summary` | Set or update the short description for a group |
| `File Groups: Edit Description` | Add longer Markdown-friendly notes to a group |
| `File Groups: Pin Group` | Pin a group to the top of the list |
| `File Groups: Unpin Group` | Unpin a group back to normal sorting |
| `File Groups: Set Badge Text` | Set a custom 1-2 character badge for file decorations |
| `File Groups: Find Duplicate Files` | Find files that appear in multiple groups |
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
  "version": 2,
  "groups": [
    {
      "id": "abc123",
      "name": "Authentication",
      "icon": "key",
      "color": "charts.blue",
      "shortDescription": "Login endpoints",
      "details": "Handles login/logout flows for the app.",
      "createdBy": "alice",
      "collapsed": false,
      "pinned": true,
      "badgeText": "🔐",
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
