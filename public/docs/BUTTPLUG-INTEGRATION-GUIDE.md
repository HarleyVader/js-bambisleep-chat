# 🔌 Buttplug.io Device Integration Guide

## Overview

BambiSleep Chat now integrates with [Buttplug.io](https://buttplug.io), enabling intimate hardware devices to respond to BambiSleep trigger words during AI conversations. When triggers are detected in chat messages, connected devices will activate with customized vibration patterns.

## 🎯 Features

- **Automatic Trigger Detection**: Devices respond when BambiSleep triggers appear in AI messages
- **Category-Based Patterns**: Different trigger categories use unique vibration patterns
- **Customizable Intensity**: Adjust vibration strength for each trigger category
- **Multiple Device Support**: Control multiple devices simultaneously
- **Pattern Variety**: Pulse, wave, burst, and steady vibration patterns

## 📋 Requirements

### Software

1. **Intiface Central** - Device connection server
   - Download: [https://intiface.com/central/](https://intiface.com/central/)
   - Platform: Windows, macOS, Linux
   - Required Version: v2.5.0 or higher

2. **BambiSleep Chat** (this application)

### Hardware

- Any Buttplug.io-compatible device
- Check compatibility: [https://iostindex.com/](https://iostindex.com/)
- Supported brands include:
  - Lovense (all products)
  - Kiiroo
  - We-Vibe
  - The Handy
  - And 750+ other devices

## 🚀 Setup Instructions

### Step 1: Install Intiface Central

1. Download Intiface Central from [intiface.com](https://intiface.com/central/)
2. Install and launch the application
3. Click "Start Server" (default WebSocket port: 12345)
4. Leave Intiface Central running in the background

### Step 2: Configure BambiSleep Chat

1. Open BambiSleep Chat in your browser
2. Click the **🔌 Devices** button in the dropdown menu
3. Verify the Server URL is set to: `ws://localhost:12345`
4. Click **"Connect to Intiface Central"**
5. Wait for the connection status to show **✅ Connected**

### Step 3: Connect Your Device

1. Turn on your intimate hardware device
2. Put the device in pairing/connection mode (refer to device manual)
3. In BambiSleep Chat, click **"🔍 Scan for Devices"**
4. Wait for your device to appear in the device list
5. Once connected, you'll see: **📳 [Device Name] ✅ Connected**

### Step 4: Enable Triggers

1. Click the **🎯 Triggers** button
2. Toggle triggers **ON** (status indicator turns green)
3. Select which triggers to activate (recommended: Good Girl, Bambi, Drop for Cock)

### Step 5: Enable Device Integration

1. In the **🔌 Devices** dropdown, the toggle is automatically enabled when connected
2. Optionally adjust intensity sliders for each trigger category:
   - **Primary Triggers** (70%): Bambi, Good Girl, Bambi Sleep
   - **Mental Triggers** (50%): Blonde Moment, Snap and Forget
   - **Physical Triggers** (90%): Drop for Cock, Bambi Freeze, Bambi Limp

## 🎨 Vibration Patterns

### Primary Triggers

- **Pattern**: Pulse (alternating on/off)
- **Default Intensity**: 70%
- **Duration**: 2 seconds
- **Examples**: "Bambi", "Good Girl", "Bambi Sleep"
- **Effect**: Medium-high intensity with rhythmic pulsing

### Mental Triggers

- **Pattern**: Wave (gradual increase/decrease)
- **Default Intensity**: 50%
- **Duration**: 3 seconds
- **Examples**: "Blonde Moment", "Snap and Forget", "Airhead Barbie"
- **Effect**: Gentle, flowing sensation

### Physical Triggers

- **Pattern**: Burst (quick intense bursts)
- **Default Intensity**: 90%
- **Duration**: 1.5 seconds
- **Examples**: "Drop for Cock", "Bambi Freeze", "Bambi Limp"
- **Effect**: Strong, commanding bursts

### Default Pattern

- **Pattern**: Steady (constant vibration)
- **Default Intensity**: 60%
- **Duration**: 2 seconds
- **Used for**: Uncategorized triggers

## ⚙️ Configuration

### Adjusting Intensity

1. Open **🔌 Devices** dropdown
2. Locate the "Trigger Patterns" section
3. Drag the intensity sliders for each category:
   - **0%**: Device off (no response)
   - **50%**: Medium intensity
   - **100%**: Maximum intensity
4. Changes apply immediately to future triggers

### Testing Your Setup

1. Click **"🎯 Test Vibration"** in the Devices dropdown
2. Your device should activate with the Primary pattern
3. If nothing happens:
   - Check device connection in Intiface Central
   - Ensure device is turned on and charged
   - Verify device supports vibration (some devices are rotate/stroke only)

### Emergency Stop

- Click **"⛔ Emergency Stop"** to immediately halt all device activity
- All active patterns will be cancelled
- Devices will return to idle state

## 🔧 Troubleshooting

### "Connection Failed" Error

**Problem**: Cannot connect to Intiface Central

**Solutions**:

1. Ensure Intiface Central is running
2. Verify the server is started (green "Server Running" status)
3. Check the WebSocket port is 12345 (default)
4. Try restarting Intiface Central
5. Disable firewall/antivirus temporarily to test

### Device Not Appearing

**Problem**: Device doesn't show up during scan

**Solutions**:

1. Ensure device is powered on
2. Put device in pairing mode (usually hold power button)
3. Check device battery level
4. Move device closer to computer
5. Try scanning again after 10 seconds
6. Restart Intiface Central and device

### No Vibration on Trigger

**Problem**: Triggers detected but device doesn't respond

**Solutions**:

1. Verify **🎯 Triggers** are enabled (green status)
2. Check device integration is enabled (🔌 Devices toggle on)
3. Ensure intensity sliders are above 0%
4. Test with **"🎯 Test Vibration"** button
5. Check device connection status in Intiface Central
6. Some devices may not support vibration (check iostindex.com)

### Delayed Response

**Problem**: Device vibrates several seconds after trigger appears

**Solutions**:

1. This is normal for AI-generated messages (triggers detected as message streams)
2. Reduce TTS queue if speech is enabled
3. Close other applications using device
4. Ensure stable Bluetooth connection

## 🔒 Privacy & Security

### Local Processing

- All device communication happens **locally** on your computer
- No device data is sent to external servers
- Buttplug.io uses encrypted WebSocket connections

### Data Storage

- Only trigger pattern settings are saved (intensity levels)
- No device names or connection history stored
- Settings stored in browser localStorage only

### Permissions

- Requires WebSocket connection permission
- No microphone, camera, or location access needed
- Bluetooth permissions handled by Intiface Central

## 📊 Advanced Usage

### Multiple Devices

When multiple devices are connected:

- All devices respond to every trigger simultaneously
- Each device receives the same pattern and intensity
- Individual device control coming in future updates

### Custom Patterns (Advanced)

Developers can modify vibration patterns in `buttplug-integration.js`:

```javascript
this.triggerPatterns = {
  primary: {
    intensity: 0.7, // 0.0 to 1.0
    duration: 2000, // milliseconds
    pattern: "pulse", // pulse, wave, burst, steady
  },
  // Add custom categories...
};
```

### Event Integration

The system dispatches custom events you can hook into:

```javascript
// Listen for trigger detection
document.addEventListener("trigger-detected", (event) => {
  console.log("Trigger:", event.detail.triggerName);
  console.log("Category:", event.detail.category);
});

// Listen for device updates
document.addEventListener("buttplug-devices-updated", (event) => {
  console.log("Devices:", event.detail.devices);
});
```

## 🆘 Support

### Getting Help

1. **Documentation**: Check [Buttplug.io docs](https://docs.buttplug.io)
2. **Discord**: [https://discord.buttplug.io](https://discord.buttplug.io)
3. **Forums**: [https://discuss.buttplug.io](https://discuss.buttplug.io)
4. **Device Compatibility**: [https://iostindex.com](https://iostindex.com)

### Common Questions

**Q: Does this work on mobile?**  
A: Currently desktop only. Mobile support requires Intiface Mobile app (in development).

**Q: Can I use this with other apps?**  
A: Yes! Intiface Central can connect multiple applications simultaneously.

**Q: Is this safe for my device?**  
A: Yes. Buttplug.io respects device safety limits and won't exceed manufacturer specs.

**Q: Do I need internet?**  
A: No. Device control is 100% local. Internet only needed for AI chat.

**Q: What if I don't have Intiface Central?**  
A: The integration is optional. Chat works normally without it.

## 📝 Technical Details

### Architecture

```
BambiSleep Chat (Browser)
    ↓ WebSocket
Intiface Central (Desktop App)
    ↓ Bluetooth/USB
Device Hardware
```

### Libraries Used

- **buttplug-js**: JavaScript client library
- **Intiface Central**: Device connection server
- **WebSocket API**: Real-time communication

### Browser Compatibility

- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ⚠️ Safari (limited support)
- ❌ Internet Explorer

## 🎓 Best Practices

1. **Start Low**: Begin with lower intensities and increase gradually
2. **Test First**: Always use "Test Vibration" before live use
3. **Emergency Stop**: Know where the stop button is
4. **Device Care**: Keep devices charged and clean
5. **Trigger Selection**: Start with 2-3 triggers, add more gradually
6. **Intensity Balance**: Mental triggers should be lower than physical
7. **Session Length**: Take breaks, monitor device temperature

## 🔮 Future Features

Planned enhancements:

- Individual device control
- Custom pattern builder UI
- Trigger-specific pattern overrides
- Pattern synchronization with TTS speech
- Mobile device support
- Multi-channel control (different motors)
- Pattern recording and playback
- Community pattern sharing

## ⚖️ Disclaimer

This integration is for adult use only. Users are responsible for:

- Safe and consensual use of intimate devices
- Following device manufacturer guidelines
- Monitoring device temperature and battery
- Using appropriate intensity levels
- Ensuring device hygiene

The developers are not responsible for device misuse, damage, or injury.

---

**Enjoy your enhanced BambiSleep experience! 💖**

_For questions or issues, please refer to the troubleshooting section or contact support._
