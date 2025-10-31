# Test Reports Directory

This directory contains generated test reports:

## Report Types

- **HTML Reports** (`bambisleep-test-report-*.html`) - Interactive visual reports
- **JSON Reports** (`bambisleep-test-report-*.json`) - Machine-readable test data
- **Summary Report** (`latest-summary.txt`) - Quick text overview (always latest)

## Report Contents

Each report includes:
- Test suite results (Environment, Stability, Resource)
- Performance metrics (response times, memory usage)
- Detailed test logs and timings
- Recommendations and analysis
- Platform and environment information

## Viewing Reports

### HTML Reports
Open any `.html` file in your web browser for an interactive dashboard.

### JSON Reports
Use for automated analysis, CI/CD integration, or data processing.

### Summary Reports
Quick text overview perfect for command-line viewing:
```bash
cat tests/reports/latest-summary.txt
```

## Retention

Reports are timestamped and preserved. Clean up old reports periodically:
```bash
# Keep only reports from last 30 days (example)
find tests/reports -name "*.html" -mtime +30 -delete
find tests/reports -name "*.json" -mtime +30 -delete
```

The `latest-summary.txt` file is always overwritten with the most recent test results.
