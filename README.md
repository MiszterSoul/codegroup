# File Groups

Organize files from different folders into named groups for quick access. Perfect for large projects where you need to work with related files scattered across multiple directories.

## Features

### 📁 Create File Groups
- Create named groups to organize related files
- Add files from any folder in your workspace
- Multi-select support: add multiple files at once

### 🎨 Customize Groups
- **Icons**: Choose from 30+ built-in icons (folder, rocket, flame, star, etc.)
- **Colors**: Apply colors to group icons for visual distinction

### ➕ Multiple Ways to Add Files
- **Right-click in Explorer**: Select files → "Add to File Group"
- **Right-click on Tab**: Click tab → "Add to File Group"
- **Drag & Drop**: Drag files from Explorer directly into a group in the sidebar

### 📂 Quick Actions
- **Open All**: Open all files in a group with one click
- **Close All**: Close only the files belonging to a group (keeps other tabs)
- **Rename/Delete**: Manage your groups easily

### 🔄 Drag & Drop Support
- Drag files from Explorer into groups
- Drag tabs into groups
- Reorder groups by dragging
- Move files between groups

## Usage

1. Click the **File Groups** icon in the Activity Bar (sidebar)
2. Click the **+** button to create a new group
3. Add files by:
   - Right-clicking files in Explorer → "Add to File Group"
   - Right-clicking a tab → "Add to File Group"
   - Dragging files into a group
4. Click a group to expand/collapse it
5. Right-click a group for more options:
   - Open All Files
   - Close All Files
   - Rename
   - Set Icon
   - Set Color
   - Delete

## Commands

All commands are available in the Command Palette (Ctrl+Shift+P):

| Command | Description |
|---------|-------------|
| `File Groups: Create Group` | Create a new file group |
| `File Groups: Refresh` | Refresh the groups view |

## Storage

Groups are stored per-workspace, so each project has its own set of file groups.

## Requirements

VS Code 1.106.0 or higher.

## Known Issues

- Tab colors based on group colors are not yet supported (VS Code API limitation)

## Release Notes

### 0.0.1

Initial release:
- Create, rename, delete file groups
- Add/remove files to groups
- Custom icons and colors for groups
- Drag & drop support
- Open all / Close all files in a group
- Right-click context menus in Explorer and tabs
