# Contributing to CodeGroup

Thank you for your interest in contributing to CodeGroup! 🎉

## Ways to Contribute

### 🐛 Report Bugs

Found a bug? Please [open an issue](https://github.com/MiszterSoul/codegroup/issues/new?labels=bug) with:

- VS Code version
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

### 💡 Suggest Features

Have an idea? [Open a feature request](https://github.com/MiszterSoul/codegroup/issues/new?labels=enhancement) with:

- Clear description of the feature
- Use case / why it would be useful
- Mockups or examples if possible

### 🔧 Submit Pull Requests

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/codegroup.git
   cd codegroup
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Make your changes**
6. **Test** your changes:
   - Press `F5` in VS Code to launch the Extension Development Host
   - Verify your changes work as expected
7. **Commit** with a clear message:
   ```bash
   git commit -m "feat: add XYZ feature"
   ```
8. **Push** and create a Pull Request

## Development Setup

### Prerequisites

- Node.js 16+
- VS Code 1.74.0+
- npm or yarn

### Getting Started

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes (recommended during development)
npm run watch
```

### Running the Extension

1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. The extension will be active in the new window

### Project Structure

```
codegroup/
├── src/
│   ├── extension.ts          # Extension entry point
│   ├── fileGroupsProvider.ts # Tree view provider
│   ├── fileDecorationProvider.ts # File decorations
│   ├── storageService.ts     # Data persistence
│   ├── models.ts             # TypeScript interfaces
│   └── test/                 # Test files
├── images/                   # Icons and screenshots
├── package.json              # Extension manifest
└── tsconfig.json             # TypeScript config
```

## Code Style

- Use TypeScript
- Follow existing code patterns
- Add JSDoc comments for public functions
- Keep commits focused and atomic

## Commit Messages

Use conventional commit format:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

Examples:
```
feat: add keyboard shortcuts for group navigation
fix: handle file rename when path contains spaces
docs: update README with new features
```

## Good First Issues

Looking for something to work on? Check out issues labeled [`good first issue`](https://github.com/MiszterSoul/codegroup/labels/good%20first%20issue) – these are great for newcomers!

## Questions?

Feel free to [open an issue](https://github.com/MiszterSoul/codegroup/issues) for any questions.

---

Thank you for contributing! ❤️
