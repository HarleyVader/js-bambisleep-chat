# Scripts

Utility scripts for development and maintenance.

## Available Scripts

### `clean.js`
Removes build artifacts and test reports.

**Usage:**
```bash
npm run clean
```

**Removes:**
- `node_modules/`
- `public/dist/`
- `package-lock.json`
- `tests/reports/bambisleep-*.html`
- `tests/reports/bambisleep-*.json`
- `tests/reports/latest-summary.txt`

**Preserves:**
- `tests/reports/.gitignore`
- `tests/reports/README.md`

## Adding New Scripts

When adding new scripts:
1. Create script in this directory
2. Add entry to `package.json` scripts section
3. Document it in this README
4. Make script executable on Unix: `chmod +x script-name.js`
