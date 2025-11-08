# Support

Thank you for using BambiSleep Chat! We're here to help you get the most out of the application.

## Getting Help

### 📚 Documentation

Before asking for help, please check our comprehensive documentation:

- **[README.md](README.md)** - Quick start guide and feature overview
- **[docs/WORKFLOWS.md](docs/WORKFLOWS.md)** - Development workflows and processes
- **[docs/BUILD.md](docs/BUILD.md)** - Build system and deployment
- **[docs/DEPLOYMENT.md](public/docs/DEPLOYMENT.md)** - Production deployment guide
- **[docs/TROUBLESHOOTING.md](public/docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[docs/MCP-SETUP.md](docs/MCP-SETUP.md)** - MCP integration setup
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and changes

### Feature Guides

- **[Trigger System Guide](public/docs/TRIGGERS-SYSTEM-GUIDE.md)** - How to use trigger words
- **[TTS Voice Guide](public/docs/TTS-VOICE-GUIDE.md)** - Text-to-speech configuration
- **[Spiral Controls Guide](public/docs/SPIRAL-CONTROLS-GUIDE.md)** - Animation settings
- **[AI Mode Guide](public/docs/AIGF-AI-MODE-GUIDE.md)** - AI chat integration
- **[Collar Settings Guide](public/docs/COLLAR-SETTINGS-GUIDE.md)** - Collar configuration
- **[Brainwave Beats Guide](public/docs/BRAINWAVE-BEATS-GUIDE.md)** - Audio features

## Ways to Get Support

### 1. GitHub Discussions (Recommended)

**Best for**: Questions, ideas, and community discussions

Visit [GitHub Discussions](https://github.com/HarleyVader/js-bambisleep-chat/discussions) to:

- Ask questions about usage
- Share ideas and feature requests
- Discuss best practices
- Get help from the community
- Share your experiences

**Categories**:
- 💬 **General** - General discussions
- 💡 **Ideas** - Feature requests and suggestions
- 🙏 **Q&A** - Questions and answers
- 📣 **Announcements** - Project updates
- 🎨 **Show and Tell** - Share your customizations

### 2. GitHub Issues

**Best for**: Bug reports and specific problems

Create an issue if you've found:

- 🐛 **Bugs** - Something isn't working as expected
- 🔒 **Security Issues** - See [SECURITY.md](SECURITY.md) for private reporting

Use our issue templates:
- [Bug Report](https://github.com/HarleyVader/js-bambisleep-chat/issues/new?template=bug_report.yml)
- [Feature Request](https://github.com/HarleyVader/js-bambisleep-chat/issues/new?template=feature_request.yml)

### 3. Community Resources

- **Official Website**: [bambisleep.chat](https://bambisleep.chat)
- **BambiSleep Info**: [bambisleep.info](https://bambisleep.info)
- **GitHub Repository**: [HarleyVader/js-bambisleep-chat](https://github.com/HarleyVader/js-bambisleep-chat)

## Frequently Asked Questions

### Installation & Setup

**Q: What are the system requirements?**

A: 
- Node.js v20+ (LTS recommended)
- npm v10+
- Modern browser (Chrome, Firefox, Safari, Edge)
- 2GB RAM minimum, 4GB recommended

**Q: How do I install BambiSleep Chat?**

A:
```bash
# Quick install (Linux/macOS)
curl -fsSL https://raw.githubusercontent.com/HarleyVader/js-bambisleep-chat/production/install.sh | bash

# Or manual installation
git clone https://github.com/HarleyVader/js-bambisleep-chat.git
cd js-bambisleep-chat
npm install
npm start
```

**Q: Which ports does the application use?**

A:
- **Production**: Port 7878 (configurable via `.env`)
- **Development**: Port 5173 (Vite) and 7878 (Express)

### Configuration

**Q: How do I configure environment variables?**

A:
```bash
cp .env.example .env
# Edit .env with your settings
```

See [Environment Configuration](README.md#configuration) for details.

**Q: How do I change the TTS voice?**

A: See the [TTS Voice Guide](public/docs/TTS-VOICE-GUIDE.md) for available voices and configuration options.

**Q: Can I add custom trigger words?**

A: No, the system uses only official BambiSleep triggers from [bambisleep.info/Triggers](https://bambisleep.info/Triggers). See the [Trigger System Guide](public/docs/TRIGGERS-SYSTEM-GUIDE.md) for details.

### Usage

**Q: How do I enable/disable features?**

A: Use the dropdown menus in the UI:
- Trigger Words dropdown - Toggle trigger detection
- TTS dropdown - Configure text-to-speech
- Spiral dropdown - Control animations
- AI dropdown - Manage AI chat

**Q: Why isn't TTS working?**

A: Common causes:
- Browser must be HTTPS or localhost
- Kokoro TTS service must be running
- Check browser console for errors
- See [Troubleshooting Guide](public/docs/TROUBLESHOOTING.md)

**Q: How do I use AI chat?**

A: 
1. Ensure LM Studio is running with a model loaded
2. Configure `LMS_HOST` and `LMS_PORT` in `.env`
3. Use the AI chat interface in the application
4. See [AI Mode Guide](public/docs/AIGF-AI-MODE-GUIDE.md)

### Development

**Q: How do I contribute?**

A: See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Setting up development environment
- Coding standards
- Testing requirements
- Pull request process

**Q: How do I run tests?**

A:
```bash
npm test              # Run all tests
npm run test:critical # Run critical tests only
npm run test:watch   # Watch mode
```

**Q: How do I build for production?**

A:
```bash
npm run build        # Full build with validation
npm run build:fast   # Quick build (skips tests)
```

### Deployment

**Q: How do I deploy to production?**

A: See [Deployment Guide](public/docs/DEPLOYMENT.md) or use the automated deployment:
```bash
node scripts/deploy.js
```

**Q: How do I update to the latest version?**

A:
```bash
git pull origin main
npm install
npm run build
sudo systemctl restart bambisleepchat
```

**Q: How do I check service health?**

A:
```bash
# Check service status
sudo systemctl status bambisleepchat

# View logs
journalctl -u bambisleepchat -f

# Run health check
npm run health-check
```

## Troubleshooting

### Common Issues

1. **Port already in use**:
   ```bash
   # Check what's using the port
   lsof -i :7878
   # Kill the process or change port in .env
   ```

2. **Dependencies not installing**:
   ```bash
   # Clear cache and reinstall
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Build failures**:
   ```bash
   # Clean build artifacts
   npm run clean
   # Try building again
   npm run build
   ```

4. **Tests failing**:
   - Check Node.js version (must be v20+)
   - Ensure ports 7878 and 5173 are available
   - See [Test Troubleshooting](tests/README.md)

### Debug Mode

Enable detailed logging:
```bash
NODE_ENV=development npm start
```

Check logs:
```bash
# Production logs
journalctl -u bambisleepchat -f

# Development console
# Check browser console (F12)
```

## Performance Issues

If you experience performance problems:

1. **Reduce particle count** in spiral animations
2. **Disable animations** if on low-end hardware
3. **Check system resources**:
   ```bash
   # CPU and memory usage
   htop
   # Or use the built-in check
   node scripts/validate-service.js
   ```

## Security Concerns

For security vulnerabilities, please follow our [Security Policy](SECURITY.md):

- **Private reporting**: Use [GitHub Security Advisory](https://github.com/HarleyVader/js-bambisleep-chat/security/advisories/new)
- **Do not** create public issues for security vulnerabilities
- We aim to respond within 48 hours

## Contributing

We welcome contributions! If you'd like to help:

1. Read [CONTRIBUTING.md](CONTRIBUTING.md)
2. Check [open issues](https://github.com/HarleyVader/js-bambisleep-chat/issues)
3. Review [TODO.md](TODO.md) for planned features
4. Join discussions on [GitHub Discussions](https://github.com/HarleyVader/js-bambisleep-chat/discussions)

## Contact

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and community support
- **Repository**: [HarleyVader/js-bambisleep-chat](https://github.com/HarleyVader/js-bambisleep-chat)
- **Website**: [bambisleep.chat](https://bambisleep.chat)

## Additional Resources

### Internal Documentation
- [Architecture Overview](.github/copilot-instructions.md)
- [Build System](scripts/README.md)
- [Test Framework](tests/README.md)

### External Resources
- [Node.js Documentation](https://nodejs.org/docs/)
- [Socket.io Documentation](https://socket.io/docs/)
- [Vite Documentation](https://vitejs.dev/)
- [BambiSleep Official](https://bambisleep.info)

---

**Need more help?** Create a discussion or issue, and we'll do our best to assist you!

Thank you for using BambiSleep Chat! 🌀💖
