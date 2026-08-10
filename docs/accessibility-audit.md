# Accessibility audit

Scope: CodeGroup tree items, group actions, the visual Group Editor, command
reachability, and user-facing status text. This is a source-level audit for the
1.4.x codebase; it does not claim certification against a specific assistive
technology matrix.

## Findings and changes

| Area | Finding | Resolution |
|---|---|---|
| Tree groups | Pinned and note states were represented visually by emoji. | Added explicit screen-reader labels containing group type, state, summary, and item counts. |
| Tree actions | Codicon-prefixed labels could be announced inconsistently. | Added plain-text accessibility labels built from the action name and description. |
| Tree files | File and folder rows relied on the resource icon for their type. | Added labels that state file/folder type and path. |
| Group Editor pin option | The checkbox had nearby text but no programmatic label relationship. | Connected the checkbox to its title and hint with ARIA attributes. |
| Group Editor file actions | Repeated Open and Remove buttons did not identify their target file. | Added item-specific accessible labels. |
| Group Editor structure | Presets and file membership were visually grouped only. | Added group/list semantics and accessible descriptions. |
| Status messages | Save, validation, missing-file, and action results already used a polite live status region. | Retained the existing `role="status"` and `aria-live="polite"` behavior. |
| Keyboard access | Core actions are registered commands and available through the Command Palette; group actions are also available from the keyboard-operated action picker. | Verified in the manifest and added regression coverage for Copy File Paths. |
| Color, icon, and badges | These provide optional visual metadata but must not replace the group name or state. | Screen-reader labels now expose meaningful text independently of visual metadata. |

## Focused regression coverage

- accessible-label formatting removes codicon markup and preserves meaningful text
- the Group Editor keeps labels for its checkbox and repeated file actions
- the manifest exposes core group actions to the Command Palette

Manual checks with specific screen readers and operating-system high-contrast
modes remain appropriate before claiming platform-specific accessibility
certification.
