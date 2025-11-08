# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| 0.2.x   | :x:                |
| 0.1.x   | :x:                |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take the security of BambiSleep Chat seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **GitHub Security Advisory** (Preferred):
   - Go to https://github.com/HarleyVader/js-bambisleep-chat/security/advisories/new
   - Fill in the details of the vulnerability
   - Submit the advisory

2. **Create a private issue**:
   - Contact the maintainers through GitHub directly
   - Request a private discussion
   - Provide details of the vulnerability

### What to Include

Please include the following information in your report:

- **Type of vulnerability** (e.g., XSS, SQL injection, authentication bypass)
- **Affected component(s)** (e.g., server, client, specific module)
- **Step-by-step instructions** to reproduce the issue
- **Proof of concept** or exploit code (if possible)
- **Potential impact** of the vulnerability
- **Suggested fix** (if you have one)
- **Your contact information** for follow-up

### Example Report

```
## Vulnerability Type
Cross-Site Scripting (XSS)

## Affected Component
Chat message display in public/js/aigf-core.js

## Steps to Reproduce
1. Send a message with malicious HTML: <img src=x onerror=alert(1)>
2. Message is rendered without sanitization
3. JavaScript executes in other users' browsers

## Impact
Allows attackers to execute arbitrary JavaScript in victims' browsers,
potentially stealing session tokens or performing actions on behalf of users.

## Suggested Fix
Implement DOMPurify or similar sanitization library before rendering messages.
```

## Response Timeline

We will endeavor to:

1. **Acknowledge receipt** within 48 hours
2. **Provide an initial assessment** within 7 days
3. **Keep you informed** of progress weekly
4. **Release a fix** as soon as possible (typically within 30 days)
5. **Credit you** in the release notes (unless you prefer to remain anonymous)

## Disclosure Policy

- **Coordinated Disclosure**: We practice coordinated disclosure and ask that you give us reasonable time to fix the vulnerability before public disclosure
- **Public Disclosure**: After a fix is released, we will publish a security advisory
- **CVE Assignment**: For significant vulnerabilities, we will request a CVE identifier
- **Credit**: We will credit the reporter in the advisory (unless anonymity is requested)

## Security Updates

Security updates will be released as:

- **Patch releases** (e.g., 0.3.1) for minor vulnerabilities
- **Minor releases** (e.g., 0.4.0) for moderate vulnerabilities
- **Emergency releases** for critical vulnerabilities (released immediately)

Subscribe to:
- GitHub releases: https://github.com/HarleyVader/js-bambisleep-chat/releases
- Security advisories: https://github.com/HarleyVader/js-bambisleep-chat/security/advisories

## Security Best Practices for Users

### Deployment

1. **Keep dependencies updated**:
   ```bash
   npm audit
   npm audit fix
   ```

2. **Use environment variables** for sensitive configuration:
   ```bash
   cp .env.example .env
   # Edit .env with secure values
   ```

3. **Enable HTTPS** in production:
   - Use Let's Encrypt for free SSL certificates
   - Configure Nginx/Apache as reverse proxy with SSL

4. **Implement rate limiting**:
   - Configure firewall rules
   - Use fail2ban for brute force protection

5. **Regular security audits**:
   ```bash
   npm run health-check
   npm audit --audit-level moderate
   ```

### Development

1. **Never commit secrets**:
   - Use `.env` files (already in `.gitignore`)
   - Use environment variables
   - Rotate secrets if accidentally committed

2. **Validate input**:
   - Sanitize user input
   - Validate on both client and server
   - Use prepared statements for database queries

3. **Follow secure coding practices**:
   - Review `.github/copilot-instructions.md` for guidelines
   - Run security tests before committing
   - Use the CodeQL checker tool

4. **Keep dependencies minimal**:
   - Only add necessary dependencies
   - Review dependency security advisories
   - Use `npm audit` regularly

## Known Security Considerations

### Current Implementation

- **Authentication**: Not currently implemented (v0.3.0)
  - All users have equal access
  - No user accounts or session management
  - Consider implementing JWT-based auth for production

- **Message Persistence**: Messages stored in memory only
  - Lost on server restart
  - No database encryption needed
  - Consider Redis/database for persistence

- **TTS System**: External Kokoro API
  - Review Kokoro API security practices
  - Use HTTPS for API communication
  - Validate audio data before processing

- **AI Integration**: LM Studio local instance
  - Runs on local network
  - Review model security implications
  - Sanitize AI responses before display

- **WebSocket Security**: Socket.io implementation
  - CORS enabled for development
  - Configure CORS properly for production
  - Consider WebSocket authentication

### Planned Security Enhancements

See [TODO.md](TODO.md) for planned security features:
- [ ] Content Security Policy (CSP) headers
- [ ] Input sanitization with DOMPurify
- [ ] HTTPS/TLS certificate setup
- [ ] Rate limiting middleware
- [ ] User authentication system

## Security Tools

We use the following security tools:

- **npm audit** - Dependency vulnerability scanning
- **CodeQL** - Static code analysis (GitHub Actions)
- **Dependabot** - Automated dependency updates
- **GitHub Security Advisories** - Vulnerability notifications

## Bug Bounty Program

We do not currently offer a bug bounty program, but we greatly appreciate security researchers who responsibly disclose vulnerabilities. Contributors who report valid security issues will be:

- Credited in release notes (if desired)
- Acknowledged in CHANGELOG.md
- Given contributor status
- Thanked personally by maintainers

## Questions?

If you have questions about this security policy, please create a [GitHub Discussion](https://github.com/HarleyVader/js-bambisleep-chat/discussions) or contact the maintainers.

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [npm Security Best Practices](https://docs.npmjs.com/security-best-practices)
- [GitHub Security Advisories](https://docs.github.com/en/code-security/security-advisories)

---

**Last Updated**: November 8, 2025
**Version**: 1.0
