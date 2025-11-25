# Change Log

All notable changes to the "File Groups" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-25

### Added
- **Create file groups** to organize related files from any folder in your workspace
- **Subgroups** for hierarchical organization (nested groups within groups)
- **30+ custom icons** to visually distinguish your groups
- **Color coding** for groups - applied to both icons and file tabs/explorer
- **Multiple ways to add files**:
  - Right-click in Explorer → "Add to File Group"
  - Right-click on editor tabs → "Add to File Group"
  - Drag and drop files from Explorer into groups
- **Drag and drop support**:
  - Drag groups into other groups to create subgroups
  - Drag subgroups to empty space to move them to root level
  - Drag files between groups to reorganize
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