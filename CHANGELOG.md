# Changelog

All notable changes to **CodeGroup - File Organizer** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- markdownlint-disable MD022 MD024 MD032 -->

## [1.1.0] - 2026-01-28

### Added

- **feat:** Global groups – Create groups that are available across all projects, stored in global storage (AppData).
- **feat:** Command to create global groups accessible from all workspaces.
- **feat:** Toggle to hide/show global groups per project via local settings.
- **feat:** Visual indicators (🌐) to distinguish global groups from local groups.
- **feat:** Moving any group (drag or command) relocates the entire nested tree between the local and global configs so every child moves together.
- **feat:** Right-clicking the empty area in the File Groups view now offers a quick “Create Group” action without selecting an existing group.

### Changed

- **improvement:** Global groups behave exactly like local groups (same context menus, drag/drop, open/close support) while keeping path handling (relative local vs absolute global) clean.
- **improvement:** Dragging any group onto the Global Groups section or moving it via commands now detaches it from mixed storage and re-saves the complete JSON subtree.
- **improvement:** View now appears at the bottom of the Explorer sidebar instead of a separate activity bar icon.
- **improvement:** View starts collapsed by default on first use for a cleaner workspace.

## [1.0.8] - 2026-01-08

### Added

- **feat:** Sort files within groups – organize by name (A-Z or Z-A), date modified (oldest/newest first), file type, or manual drag & drop
- **improvement:** Switched bundler from esbuild to Bun for faster builds

### Changed

- **improvement:** Reduced package size from 32kb to 22kb

## [1.0.7] - 2026-01-07

### Changed

- **improvement:** Removed test infrastructure to reduce package size
- **improvement:** Optimized icon size from 14.6kb to 5.5kb

## [1.0.6] - 2026-01-07

### Changed

- **improvement:** Decreased package size from 130kb to 70kb through code optimization
- **improvement:** Reduced extension load time from 15ms to 7ms

## [1.0.5] - 2025-12-15

### Changed

- **improvement:** File hover tooltip now shows full group path (e.g., "CodeGroup: Bearer\Backend\") instead of just the group name
- **improvement:** Reorganized README with demo GIF moved to the top for better visibility

## [1.0.4] - 2025-11-27

### Changed
- Removed activity bar badge (group count) – the number was interfering with other indicators
- Fixed sidebar title showing "CODEGROUP:" instead of "CodeGroup"
- Reduced extension package size by excluding readme images from bundle

## [1.0.3] - 2025-11-27

### Added
- **feat:** Persistent expand/collapse state – groups remember their state across reloads
- **feat:** Group summaries & detailed notes – document why a group exists with Markdown support
- **feat:** Creator attribution – see who created each group
- **feat:** Pin/Unpin groups – keep important groups at the top (📌)
- **feat:** Custom badge text – set custom 1-2 character badges for file decorations
- **feat:** Activity bar badge – shows count of groups or pinned groups
- **feat:** Find duplicate files – locate files that appear in multiple groups
- **feat:** Auto-cleanup prompt – checks for missing files on startup

### Changed
- Removed folder emoji from folder items for cleaner tree view
- Groups with notes now show 📝 indicator

## [1.0.2] - 2025-11-25

### Added
- **feat:** Folder support – folders can now be added to groups with proper icons
- **feat:** 120+ icons – massively expanded icon selection (was 30)
- **feat:** Manual reordering – drag and drop files within a group to reorder

### Changed
- Groups show "X items" instead of "X files" to account for folders
- Simplified tree view title for cleaner UI
- Reduced notification frequency for less intrusive experience

### Fixed
- **fix:** Folders now show folder icon instead of blank file icon
- **fix:** Tree view state (expanded/collapsed) preserved when editing groups

## [1.0.1] - 2025-11-25

### Fixed
- Minor bug fixes and improvements

## [1.0.0] - 2025-11-25

### Added
- **feat:** Create file groups to organize related files from any folder
- **feat:** Subgroups for hierarchical organization
- **feat:** 30+ custom icons for groups
- **feat:** Color coding with 9 predefined colors + custom hex colors
- **feat:** Multiple ways to add files: Explorer context menu, tab context menu, drag & drop
- **feat:** Drag & drop support for reorganizing groups and files
- **feat:** Smart file tracking with auto-rename and auto-delete handling
- **feat:** Quick actions: Open All, Close All, Expand/Collapse All
- **feat:** Git-friendly storage in `.vscode/file-groups.json`
- **feat:** Move subgroups to root level
- **feat:** File decoration provider for tab and explorer coloring
.github/steps/1-create-a-branch.md
