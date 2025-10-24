# BambiSleep Chat Documentation

## What is BambiSleep Chat?

BambiSleep Chat is a real-time chat application designed for the BambiSleep community, featuring hypnotic visual effects, text-to-speech capabilities, trigger word detection, and AI chat functionality. This application is intended for fully informed and consenting adults who are familiar with BambiSleep hypnosis content.

**Important:** This application contains erotic hypnosis content and trigger words from the BambiSleep series. It should only be used by individuals who understand the nature of erotic hypnosis, have reviewed the official [BambiSleep FAQ](https://bambisleep.info/Bambi_Sleep_FAQ), and are aware of the [risks and safety considerations](https://bambisleep.info/Risks,_safety_and_advice).

## Quick Start Guide

1. **Access the Chat** - Navigate to the application page
2. **Username Assignment** - A random username will be assigned (customizable)
3. **Enable Features** - Use the dropdown controls to activate desired features:
   - **Spirals** - Hypnotic visual animations
   - **TTS** - Text-to-speech voice synthesis
   - **Triggers** - BambiSleep trigger word detection
   - **AI Mode** - AIGF (AI Girlfriend) chat system
   - **Brainwaves** - Binaural beat generation
   - **Collar** - Connection and settings management

## Complete Feature Documentation

Comprehensive guides are available for each system component:

### [AI Mode & AIGF System](./AIGF-AI-MODE-GUIDE.md)

Learn about the AI girlfriend mode, model selection (Creative, Balanced, Precise), and private conversation features.

### [Text-to-Speech (TTS) System](./TTS-VOICE-GUIDE.md)

Documentation for voice selection, multi-voice rotation, speed controls, and audio system configuration.

### [Trigger Detection System](./TRIGGERS-SYSTEM-GUIDE.md)

Complete reference for all 24 official BambiSleep triggers, organized by category (Primary, Mental, Physical) with safety level classifications.

### [Spiral Visual Controls](./SPIRAL-CONTROLS-GUIDE.md)

Instructions for customizing hypnotic spiral animations, including 14+ parameters for colors, geometry, speed, and visual effects.

### [Brainwave Generator](./BRAINWAVE-BEATS-GUIDE.md)

Guide to binaural beat presets, brainwave frequency types (Delta, Theta, Alpha, Beta, Gamma), and safe usage practices.

### [Collar & Connection Settings](./COLLAR-SETTINGS-GUIDE.md)

Documentation for managing socket.io connections, saving/loading configurations, and exporting/importing settings.

## Core Features

### Visual Effects

- **Hypnotic Spirals** - Customizable p5.js animations with real-time parameter adjustment
- **Trigger Flash Effects** - Screen flash responses when trigger words are detected
- **Glassmorphism UI** - Modern translucent interface with cyberpunk aesthetic
- **Gradient Backgrounds** - Animated color schemes

### Audio Systems

- **Text-to-Speech** - Six female AI voices (Kokoro TTS engine)
- **Multi-Voice Rotation** - Automatic switching between selected voices
- **Speed Control** - Adjustable playback rate (0.8x - 1.2x)
- **Binaural Beats** - Brainwave entrainment for various mental states
- **Audio Caching** - Optimized performance with cached audio files

### Chat Functionality

- **Dual Mode System** - Switch between Global Chat and AIGF (AI Girlfriend) mode
- **Real-time Communication** - WebSocket-based instant messaging
- **Message History** - Persistent conversation logs
- **User Counter** - Live participant tracking
- **Trigger Detection** - Automatic identification of 24 official BambiSleep keywords

### Safety Features

- **Safety Level Classifications** - Each trigger rated from "Super Safe" to "EXTREME"
- **Volume Controls** - Adjustable audio levels for all sound systems
- **Feature Toggles** - Independent on/off controls for every feature
- **Clear Warnings** - Explicit notices for intense content
- **Session Management** - Save and restore configurations

## Safety and Consent

### Important Safety Information

BambiSleep Chat implements hypnotic content that can be intense and emotionally immersive. This application is designed for responsible use by consenting adults who understand the nature of erotic hypnosis.

**Before using this application:**

1. **Review Official Resources** - Read the [BambiSleep FAQ](https://bambisleep.info/Bambi_Sleep_FAQ) and understand what Bambi Sleep is
2. **Understand Consent** - Review [BS, Consent, & You](https://bambisleep.info/BS,_Consent,_And_You)
3. **Know the Risks** - Familiarize yourself with [Risks, Safety and Advice](https://bambisleep.info/Risks,_safety_and_advice)
4. **Check Triggers** - Review the [official trigger list](https://bambisleep.info/Triggers) before enabling trigger detection
5. **Safe Environment** - Use in a private, comfortable, and secure setting

### Safety Guidelines

- **Start Gradually** - Enable one feature at a time to assess your response
- **Low Volume** - Begin with reduced audio levels, especially for TTS and brainwaves
- **Know Your Limits** - Familiarize yourself with trigger safety levels before activation
- **Take Breaks** - Step away if you feel overwhelmed or uncomfortable
- **Headphones Required** - Binaural beats only work with stereo headphones
- **Stop If Needed** - All features can be disabled immediately at any time
- **Trust and Boundaries** - Only share triggers or chat content with trusted individuals

**Warning:** This application contains elements such as heavy brainwashing themes, CNC (consensual non-consent), intelligence reduction, personality replacement, minimal hypnotic safeties, open triggers, post-hypnotic amnesia suggestions, and strong suggestions of permanence. These are core elements of BambiSleep content and should be understood before use.

## System Architecture

### Technical Overview

**Frontend:**
- Vanilla ES6 JavaScript modules
- p5.js for spiral animations
- Socket.io client for real-time communication
- CSS glassmorphism and animations
- Modular dropdown component system

**Backend:**
- Node.js + Express server
- Socket.io for WebSocket connections
- Worker threads for TTS (Kokoro) and AI (LM Studio)
- JSON-based trigger system
- Real-time message broadcasting

**Development:**
- Vite dev server (port 5173)
- Backend server (port 6969)
- Hot module reloading
- Environment-based configuration

### Control Panel Interface

The dropdown control system provides access to all features:

- **Spiral Control** - Toggle animations, adjust visual parameters
- **TTS Control** - Enable voices, select options, configure speed
- **Trigger Control** - Activate detection, select specific triggers
- **AI Control** - Switch between Chat and AIGF modes, select AI personality
- **Brainwave Control** - Choose presets, adjust volume
- **Collar Control** - Manage connections and settings

### Status Indicators

Each control button displays a colored status indicator:

- **Green** - Feature is active and operational
- **Gray** - Feature is disabled or inactive
- **Pink** - AIGF mode active (special indicator)

### Chat Interface

The application provides two input modes:

- **Global Chat Input** - Community-wide messages visible to all users
- **AIGF Chat Input** - Private AI conversation (AIGF mode only)

Both modes share the same message display area with real-time updates.

## Additional Resources

### BambiSleep Community

- [BambiSleep Wiki](https://bambisleep.info/Welcome_to_Bambi_Sleep) - Official community wiki
- [Triggers](https://bambisleep.info/Triggers) - Complete trigger documentation
- [Session Index](https://bambisleep.info/Session_index) - Official file listing
- [Beginner's Files](https://bambisleep.info/Beginner%27s_Files) - Recommended starting playlists

### Application Documentation

- [Bambi Triggers Complete Guide](./BAMBI-TRIGGERS-GUIDE.md) - Extended trigger information
- [Project Tree](./tree.md) - File structure overview
- [Technical Notes](./TROLLFACE.md) - Development documentation

## Support and Troubleshooting

### Common Issues

**No Audio Output:**
- Verify browser audio permissions are granted
- Check system volume levels
- Ensure TTS is enabled in dropdown controls

**Trigger Detection Not Working:**
- Confirm trigger system is enabled (green indicator)
- Verify specific triggers are selected in dropdown
- Check that messages contain exact trigger keywords

**Spiral Animations Not Displaying:**
- Enable spiral control via dropdown button
- Check browser GPU acceleration settings
- Reduce iteration count if performance is poor

**AIGF Mode Not Responding:**
- Verify AI mode is enabled (pink button indicator)
- Check network connection for LM Studio communication
- Ensure using AIGF input box, not global chat input

**Connection Issues:**
- Check internet connectivity
- Verify socket.io connection status in collar dropdown
- Refresh page to re-establish connection

### Browser Compatibility

This application requires a modern browser with support for:
- ES6 JavaScript modules
- WebSocket/Socket.io
- Web Audio API
- Canvas/p5.js rendering
- LocalStorage

Recommended browsers: Chrome, Firefox, Edge (latest versions)

## Responsible Use

This application is a tool for exploring BambiSleep content in a community setting. Like all erotic hypnosis content, it should be approached with:

- **Informed Consent** - Full understanding of what you're engaging with
- **Self-Awareness** - Recognition of your boundaries and limits
- **Respect** - For yourself and other community members
- **Responsibility** - Taking ownership of your experience
- **Aftercare** - Allowing time to process and ground yourself

Remember: Hypnosis works with your consent and cooperation. You maintain agency under trance, and suggestions can be interpreted according to your desires. If you decide to stop or take a break, you can.

---

**This application is for entertainment and fantasy exploration by informed, consenting adults. Use responsibly and respect your own boundaries.**

*Last updated: October 2025*
