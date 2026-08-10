# Contributing to CodeGroup

Thank you for your interest in contributing to CodeGroup.

## Ways to Contribute

### Report Bugs

Found a bug? Please use the repository's **Bug report** issue form and include:

- VS Code version
- CodeGroup version
- operating system
- steps to reproduce
- expected vs. actual behavior
- screenshots, GIFs, or relevant logs when useful

### Suggest Features

Use the **Feature request** issue form and explain:

- the workflow problem
- the proposed behavior
- a concrete example
- alternatives or workarounds you already tried, if any

### Submit Pull Requests

1. **Fork** the repository.
2. **Clone** your fork:

   ```bash
   git clone https://github.com/YOUR_USERNAME/codegroup.git
   cd codegroup
   ```

3. **Install the locked dependencies**:

   ```bash
   npm ci
   ```

4. **Create a focused branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

5. Make your changes.
6. Run the validation suite:

   ```bash
   npm run verify
   ```

7. For extension-host behavior, also run:

   ```bash
   npm run test:extension
   ```

8. Commit with a clear conventional commit message.
9. Push the branch and open a Pull Request.

## Development Setup

### Prerequisites

- Node.js 22+
- VS Code 1.74.0+
- npm

### Getting Started

```bash
npm ci
npm run compile
npm run verify
```

For continuous development:

```bash
npm run watch
```

### Running the Extension

1. Open the project in VS Code.
2. Press `F5` to launch the Extension Development Host.
3. Test the changed workflow in the new window.

For release validation and local sharing:

```bash
npm run package:vsix
npm run package:list
code --install-extension dist/codegroup-file-organizer.vsix --force
```

### Project Structure

```text
codegroup/
├── src/
│   ├── extension.ts
│   ├── fileGroupsProvider.ts
│   ├── fileDecorationProvider.ts
│   ├── storageService.ts
│   ├── models.ts
│   └── userInfo.ts
├── tests/
├── images/
├── package.json
└── tsconfig.json
```

## Pull Request Expectations

Keep pull requests focused and easy to review.

Before opening a PR:

- run `npm run verify`
- add or update tests for behavioral changes when practical
- update README/CHANGELOG documentation when user-facing behavior changes
- avoid unrelated formatting or refactors in the same PR
- include screenshots or GIFs for visible UI changes

## Code Style

- Use TypeScript.
- Follow existing code patterns.
- Prefer clear, small functions over clever abstractions.
- Add comments where intent is not obvious from the code.
- Keep commits focused and atomic.

## Commit Messages

Use conventional commit prefixes:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `refactor:` code refactoring
- `test:` tests
- `chore:` maintenance

Examples:

```text
feat: add keyboard shortcuts for group navigation
fix: handle file rename when path contains spaces
docs: add shared group examples
```

## Good First Issues

Looking for something small to start with? Check issues labeled [`good first issue`](https://github.com/MiszterSoul/codegroup/labels/good%20first%20issue).

Good first contributions usually include documentation, tests, localization, or isolated commands that do not require changing the storage format.

## Questions

If a question may help other users or contributors too, open an issue so the answer remains searchable.

Thanks for contributing to CodeGroup.
