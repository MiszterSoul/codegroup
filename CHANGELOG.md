# Changelog

All notable changes to **CodeGroup - File Organizer** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- markdownlint-disable MD022 MD024 MD032 -->

## [1.4.1] - 2026-08-10

### Added

- **onboarding:** Added a native first-install Getting Started walkthrough with current English screenshots and direct actions for creating and using bookmark groups.
- **feat:** Added separate actions to open only a group's direct files or the group together with every nested subgroup.
- **feat:** Added copying all existing file paths from a group and its subgroups.
- **docs:** Added shared-group JSON recipes and clearer guidance about groups as bookmark folders that do not move files on disk.

### Changed

- **accessibility:** Improved accessible labels and semantics throughout the tree and visual Group Editor.
- **localization:** Updated all nine supported languages for the new onboarding, group actions, copy-path feedback, and accessibility text.
- **test:** Expanded multi-root workspace, manifest, localization, accessibility, and nested-group path coverage.

## [1.4.0] - 2026-08-10

### Added

- **docs:** Added current English screenshots for the persistent Quick Actions tree and visual Group Editor.
- **test:** Added a manifest regression test that prevents the duplicate welcome-action panel from returning.

### Changed

- **improvement:** Empty workspaces now use the Quick Actions tree as the single creation workflow instead of also showing a duplicate stack of welcome buttons.
- **improvement:** Refreshed Marketplace discovery metadata, the README landing page, contributor guidance, issue forms, and repository social preview.

## [1.3.1] - 2026-07-27

### Fixed

- **fix:** Hardened workspace-relative path handling for sibling folders, names beginning with two dots, and paths containing colons.
- **fix:** Strengthened group storage, import, and file-operation behavior across multi-root and edge-case workspaces.

### Changed

- **test:** Expanded unit and extension-host coverage for path handling, shared groups, smart groups, and Quick Open.
- **build:** Standardized validation and packaging on the Node/npm toolchain.

## [1.3.0] - 2026-06-09

### Added

- **feat:** Persistent `Quick Actions` now live under the tree even when groups already exist, so create/import/smart-group flows stay visible.
- **feat:** `Create Smart Groups` can auto-build groups by either project areas or language families.
- **feat:** Groups can now be exported as shareable JSON and imported from clipboard or file.
- **feat:** The Group Editor now includes one-click presets for Frontend, Backend, Scripts, Docs, and Research workflows.
- **feat:** Expanded the built-in color palette with additional theme color options.
- **test:** Added focused coverage for smart grouping and shared group import/export helpers.

### Changed

- **improvement:** Group context menus are slimmer now; advanced operations moved into a single `More Group Actions...` hub.
- **improvement:** README and welcome content now surface smart groups and sharing flows more clearly.
- **improvement:** Global groups remain intact during create/update/import flows even when they are hidden in the current workspace.

## [1.2.0] - 2026-06-09

### Added

- **feat:** `Quick Open from Groups` adds a searchable picker for every grouped file, including matches on group names, notes, and paths.
- **feat:** Recently opened CodeGroup files are tracked and surfaced at the top of Quick Open for faster repeat access.
- **test:** Added focused coverage for quick-open grouping, recent ordering, and nested group trails.

### Changed

- **improvement:** Opening a grouped file from the tree now feeds the same recent-file workflow used by Quick Open.
- **improvement:** Missing files opened from CodeGroup now offer cleanup immediately so stale entries are easier to recover from.
- **improvement:** Build and test scripts now run on a standard Node toolchain instead of requiring Bun, which lowers setup friction for contributors.

## [1.1.2] - 2026-03-09

### Added

- **feat:** Drag and drop from CodeGroup to Copilot Chat now attaches files directly from groups, including multiple files in one drag.

### Changed

- **improvement:** `Open All Files` is now significantly faster by opening grouped files in a batched flow instead of one-by-one.
- **improvement:** Dragging a group into the editor opens the full set of group files instantly for a quicker workflow.

## [1.1.1] - 2026-03-05

### Changed

- **improvement:** File items in CodeGroup now show a compact parent path suffix (up to the last 2 folders) next to the filename, making repeated names like `route.ts` and `route.tsx` easier to distinguish.
- **improvement:** Full absolute path remains available on hover for detailed context.

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
