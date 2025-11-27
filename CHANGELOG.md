# Changelog

All notable changes to **CodeGroup - File Organizer** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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