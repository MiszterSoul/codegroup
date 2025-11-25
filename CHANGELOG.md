# Change Log

All notable changes to the "CodeGroup - File Organizer" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2025-11-25

### Added
- **Folder support** - Folders can now be added to groups and display with proper folder icons
- **120+ icons** - Massively expanded icon selection for groups (was 30, now 120+)
  - New categories: Development, Communication, Media, People, Navigation, Status, and more
- **Manual reordering** - Drag and drop files within a group to reorder them

### Changed
- **Item counting** - Groups now show "X items" instead of "X files" to account for folders
- **Simplified UI** - Streamlined the tree view title for a cleaner look
- **Quieter notifications** - Removed most info messages for a less intrusive experience

### Fixed
- Folders now show folder icon instead of blank file icon when added to groups
- Tree view state (expanded/collapsed) is now preserved when editing groups

## [1.0.1] - 2025-11-25

### Fixed
- Minor bug fixes and improvements

## [1.0.0] - 2025-11-25

### Added
- **Create file groups** to organize related files from any folder in your workspace
- **Subgroups** for hierarchical organization (nested groups within groups)
- **30+ custom icons** to visually distinguish your groups
- **Color coding** for groups - applied to both icons and file tabs/explorer
  - 9 predefined theme colors (Red, Orange, Yellow, Green, Blue, Purple, Cyan, Magenta, White)
  - **Custom hex colors** - enter any hex color code (e.g., `#FF5733`)
- **Multiple ways to add files**:
  - Right-click in Explorer → "Add to File Group"
  - Right-click on editor tabs → "Add to File Group"
  - Drag and drop files from Explorer into groups
- **Drag and drop support**:
  - Drag groups into other groups to create subgroups
  - Drag subgroups to empty space to move them to root level
  - Drag files between groups to reorganize
- **Smart file tracking**:
  - Automatic handling of file renames (files stay in groups with updated names)
  - Automatic handling of file deletions (deleted files are removed from groups)
  - "Clean Up Missing Files" command for manual cleanup
- **Quick actions**:
  - Open All - open all files in a group (including subgroups)
  - Close All - close files from a specific group
  - Expand All / Collapse All buttons in title bar
  - Delete button in title bar
- **Git-friendly storage** - groups saved to `.vscode/file-groups.json` for team sharing
- **Move to Root Level** - convert subgroups back to main groups
- **Rename, delete, and customize** groups at any time

### Technical
- Workspace state synchronization with file-based storage
- Relative paths for cross-machine compatibility
- File decoration provider for tab and explorer coloring
- Hex color to theme color mapping for VS Code API compatibility
- File system watcher for real-time file change detection