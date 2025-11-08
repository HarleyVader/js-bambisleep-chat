# Contributing to BambiSleep Chat

Thank you for your interest in contributing to BambiSleep Chat! We welcome contributions from the community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/js-bambisleep-chat.git
   cd js-bambisleep-chat
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Process

### Prerequisites

- Node.js v20+ (LTS)
- npm v10+
- Git

### Running the Development Server

```bash
npm run dev
```

This starts:
- Express server on port 7878
- Vite dev server on port 5173 (with hot reload)

### Project Structure

```
js-bambisleep-chat/
├── src/
│   ├── server/         # Express server
│   ├── config/         # Configuration files
│   ├── workers/        # Background workers
│   └── client/         # React frontend (if applicable)
├── public/             # Static assets
├── tests/              # Test files
├── scripts/            # Build and deployment scripts
└── docs/               # Documentation
```

### Making Changes

1. **Read the custom instructions**: Check `.github/copilot-instructions.md` for development guidelines
2. **Follow the patterns**: Look at existing code for consistency
3. **Write tests**: Add tests for new features or bug fixes
4. **Update docs**: Keep documentation in sync with code changes
5. **Test thoroughly**: Run all tests before submitting

### Running Tests

```bash
# Run all tests
npm test

# Run critical tests only (faster)
npm run test:critical

# Run tests in watch mode
npm run test:watch

# Run CI tests with reports
npm run test:ci
```

### Building

```bash
# Full build with validation
npm run build

# Fast build (skips tests)
npm run build:fast
```

## Pull Request Process

1. **Update your branch** with the latest changes from main:
   ```bash
   git checkout main
   git pull origin main
   git checkout your-branch
   git rebase main
   ```

2. **Ensure all tests pass**:
   ```bash
   npm test
   ```

3. **Commit your changes** with clear, descriptive messages:
   ```bash
   git commit -m "feat: add new trigger animation system"
   ```

   Use conventional commit format:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation only
   - `style:` - Code style changes (formatting, etc.)
   - `refactor:` - Code refactoring
   - `test:` - Adding or updating tests
   - `chore:` - Maintenance tasks

4. **Push to your fork**:
   ```bash
   git push origin your-branch
   ```

5. **Create a Pull Request** on GitHub with:
   - Clear title and description
   - Link to related issues
   - Screenshots (if UI changes)
   - Test results

6. **Address review feedback** promptly and professionally

7. **Squash commits** if requested before merging

## Coding Standards

### JavaScript/Node.js Style

- Use CommonJS (`require`/`module.exports`) for Node.js files
- Use ES6+ features appropriately
- Follow existing code formatting
- Add JSDoc comments for public APIs
- Use meaningful variable and function names

### Code Organization

- **Centralized configuration**: Use `src/config/env.js` for environment variables
- **Worker threads**: Background services go in `src/workers/`
- **Socket.io events**: Use kebab-case naming (e.g., `ai-chat`, `tts-request`)
- **Error handling**: Always handle errors gracefully

### Best Practices

- **No `process.env` directly**: Use the centralized `ENV` module
- **Worker communication**: Use `postMessage` and `on('message')`
- **Graceful degradation**: Features should fail safely
- **Performance first**: Optimize critical paths
- **Security by design**: Consider security implications

### Example Pattern

```javascript
// ✅ CORRECT: Use centralized ENV
const ENV = require('../config/env');
const port = ENV.SERVER.PORT;

// ❌ WRONG: Direct process.env access
const port = process.env.PORT;
```

## Testing

### Test Philosophy

- Write tests for all new features
- Maintain existing test coverage
- Use the unified test framework (`tests/unified-test-runner.js`)
- Follow the suite class pattern

### Test Structure

```javascript
class MyTestSuite {
  constructor() {
    this.name = 'Feature Name';
    this.tags = ['critical', 'feature'];
    this.priority = 90;
  }

  async run() {
    const results = { passed: 0, failed: 0, tests: [] };
    // Test logic here
    return results;
  }
}

module.exports = MyTestSuite;
```

### Critical Tests

Tag tests as `critical` if they:
- Validate core functionality
- Check environment configuration
- Test API endpoints
- Verify security features

## Documentation

### When to Update Docs

- Adding new features
- Changing existing behavior
- Adding configuration options
- Fixing bugs that affect usage
- Adding API endpoints

### Documentation Files

- `README.md` - Main project documentation
- `docs/` - Detailed guides and tutorials
- `CHANGELOG.md` - Version history and changes
- Code comments - Inline documentation
- `.github/copilot-instructions.md` - AI agent guidance (do not modify)

### Documentation Style

- Clear and concise
- Include code examples
- Add screenshots for UI features
- Keep it up to date
- Use markdown formatting

## Community

### Getting Help

- **GitHub Discussions**: Ask questions and share ideas
- **Issues**: Report bugs or request features
- **Pull Requests**: Submit code contributions
- **Documentation**: Read the guides in `docs/`

### Communication Guidelines

- Be respectful and constructive
- Search before asking (issue might already exist)
- Provide clear descriptions and examples
- Be patient with responses
- Help others when you can

### Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes (for significant contributions)
- CHANGELOG.md credits

## Additional Resources

- **Architecture Guide**: See `.github/copilot-instructions.md`
- **Build Process**: See `scripts/README.md`
- **Testing Guide**: See `tests/README.md`
- **Deployment**: See `docs/DEPLOYMENT.md`

## Questions?

If you have questions about contributing, please:
1. Check the documentation first
2. Search existing issues and discussions
3. Create a new discussion or issue
4. Be specific and provide context

Thank you for contributing to BambiSleep Chat! 🌀💖
