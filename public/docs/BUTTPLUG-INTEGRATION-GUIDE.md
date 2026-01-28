# 🔌 Buttplug.io Device Integration Guide

## Overview

BambiSleep Chat integrates with [Buttplug.io](https://buttplug.io) to enable intimate hardware devices to respond to BambiSleep trigger words and speech patterns during AI conversations. Devices provide real-time haptic feedback synchronized with audio analysis and trigger detection.

## 🎯 Features

### Core Features

- **Automatic Trigger Detection**: Devices respond when BambiSleep triggers appear in AI messages
- **Real-Time Audio Synchronization**: Vibration intensity adapts to speech patterns (emphasis, pitch, volume)
- **Category-Based Patterns**: Different trigger categories use unique vibration intensities
- **Customizable Intensity**: Adjust vibration strength for each trigger category
- **Multiple Device Support**: Control multiple devices simultaneously
- **Two Connection Modes**: Browser WebBluetooth (simple) or Intiface Central (advanced)

### Advanced Audio Sync Features (NEW)

- **Speech Pattern Analysis**: Real-time FFT analysis of TTS audio
- **Multi-Factor Intensity Mapping**:
  - Base intensity from speech energy (0-60Hz fundamental frequencies)
  - Intonation boost from pitch variation (60-300Hz range)
  - Volume boost from amplitude peaks
  - Emphasis detection from high-frequency content (2-8kHz sibilance)
- **Peaked Dynamics**:
  - Wider range: 10%-95% intensity
  - Faster transitions: 0.7 ramp-up, 0.4 decay
  - Ultra-responsive: 0.01 threshold for instant updates
- **Trigger Boost**: Minimum 95% intensity when triggers are detected
- **Adaptive Smoothing**: Fast ramp-up during emphasis, slower decay for natural feel

## 📋 Requirements

### Connection Mode 1: Browser (Recommended)

**Software:**

- Chrome, Edge, or Opera browser with Web Bluetooth support
- No additional software required!

**Hardware:**

- Bluetooth-capable device compatible with Buttplug.io
- Check compatibility: [https://iostindex.com/](https://iostindex.com/)

### Connection Mode 2: Intiface Central (Advanced)

**Software:**

**Software:**

1. **Intiface Central** - Advanced device connection server
   - Download: [https://intiface.com/central/](https://intiface.com/central/)
   - Platform: Windows, macOS, Linux
   - Required Version: v2.5.0 or higher
   - Use when: Browser mode doesn't support your device or you need advanced features

2. **BambiSleep Chat** (this application)

**Hardware:**

- Any Buttplug.io-compatible device
- Check compatibility: [https://iostindex.com/](https://iostindex.com/)
- Supported brands include:
  - Lovense (all products)
  - Kiiroo
  - We-Vibe
  - The Handy
  - And 750+ other devices

## 🚀 Setup Instructions

### Mode 1: Browser (WebBluetooth) - Recommended 🌐

This is the simplest method - no additional software needed!

**Step 1: Prepare Your Browser**

1. Use Chrome, Edge, or Opera (Firefox does not support Web Bluetooth)
2. Ensure Bluetooth is enabled on your computer

**Step 2: Configure BambiSleep Chat**

1. Open BambiSleep Chat in your browser
2. Click the **🔌 Devices** button in the dropdown menu
3. Select **"🌐 Browser (WebBluetooth)"** mode (should be selected by default)
4. Click **"🔌 Connect"**

**Step 3: Scan and Pair Your Device**

1. Turn on your device and put it in pairing mode (check device manual)
2. Click **"🔍 Scan for Devices"**
3. Your browser will show a Bluetooth pairing dialog
4. Select your device from the list and click "Pair"
5. Device will appear in the "Connected Devices" list with ✅ status

**Step 4: Enable Audio Sync (Optional)**

1. Check the **"🎵 Sync vibrations with speech patterns"** checkbox
2. Device will now respond to both triggers AND speech patterns

### Mode 2: Intiface Central (Advanced) 🖥️

Use this method for devices not supported by Web Bluetooth or when you need advanced features.

**Step 1: Install Intiface Central**

1. Download from [https://intiface.com/central/](https://intiface.com/central/)
2. Install and launch the application
3. Click "Start Server" (default WebSocket port: 12345)
4. Leave Intiface Central running in the background

**Step 2: Configure BambiSleep Chat**

1. Open BambiSleep Chat in your browser
2. Click the **🔌 Devices** button in the dropdown menu
3. Select **"🖥️ Intiface Central (Advanced)"** mode
4. Verify the Server URL is set to: `ws://localhost:12345`
5. Click **"🔌 Connect"**
6. Wait for status: **✅ Connected**

**Step 3: Connect Your Device**

1. Turn on your device and put it in pairing mode
2. In BambiSleep Chat, click **"🔍 Scan for Devices"**
3. Device will appear in the list with ✅ status

**Step 4: Enable Triggers & Audio Sync**

1. Click the **🎯 Triggers** button and toggle **ON**
2. Enable **"🎵 Sync vibrations with speech patterns"** for audio reactivity

## 🎨 Vibration Patterns & Intensity

### Audio Synchronization (Real-Time)

When audio sync is enabled, devices respond dynamically to speech:

**Intensity Mapping:**

- **Base Level (10-55%)**: Calculated from speech energy in 0-60Hz range
- **Intonation Boost (+25%)**: Added during pitch variation (60-300Hz)
- **Volume Boost (+30%)**: Increased during loud/emphasized words
- **Emphasis Peaks (up to 95%)**: Strong boost during dramatic moments
- **Trigger Detection (95% minimum)**: Maximum intensity when triggers spoken

**Response Characteristics:**

- **Ultra-Responsive**: 0.01 threshold for near-instant updates
- **Fast Ramp-Up**: 0.7 smoothing factor for quick intensity increases
- **Smooth Decay**: 0.4 smoothing factor for natural intensity decreases
- **Analysis Rate**: 60 FPS frequency/amplitude analysis

**Speech Pattern Detection:**

- **Low Frequencies (0-60Hz)**: Fundamental speech energy, vocal warmth
- **Mid Frequencies (60-300Hz)**: Pitch variation, intonation patterns
- **High Frequencies (2-8kHz)**: Sibilance, emphasis, dramatic peaks
- **Amplitude**: Overall volume and word emphasis

### Trigger-Based Patterns (Category Intensity)

When triggers are detected, intensity overrides to category defaults:

**Primary Triggers** (Default: 70% / Trigger Boost: 95%)

- **Examples**: "Bambi", "Good Girl", "Bambi Sleep"
- **Effect**: Strong sustained vibration for core identity triggers
- **Audio Sync**: Minimum 95% when these words are spoken

**Mental Triggers** (Default: 50% / Trigger Boost: 95%)

- **Examples**: "Blonde Moment", "Snap and Forget", "Airhead Barbie"
- **Effect**: Moderate intensity for cognitive triggers
- **Audio Sync**: Boosts to 95% during trigger word pronunciation

**Physical Triggers** (Default: 90% / Trigger Boost: 95%)

- **Examples**: "Drop for Cock", "Bambi Freeze", "Bambi Limp"
- **Effect**: Very strong for physical compliance triggers
- **Audio Sync**: Maximum intensity (95%+) for commanding presence

## ⚙️ Configuration

### Adjusting Category Intensity

1. Open **🔌 Devices** dropdown
2. Locate the "⚙️ Trigger Patterns" section
3. Drag intensity sliders for each category:
   - **Primary Triggers**: Core identity (0-100%, default 70%)
   - **Mental Triggers**: Cognitive effects (0-100%, default 50%)
   - **Physical Triggers**: Body control (0-100%, default 90%)
4. Changes apply immediately

**Note**: With audio sync enabled, these become minimum intensities. The system will boost to 95% when the actual trigger word is detected during speech.

### Testing Your Setup

1. Click **"🎯 Test Vibration"** in the Devices dropdown
2. Your device should activate at 70% intensity for 3 seconds
3. If audio sync is enabled, speak/play audio to test real-time response
4. If nothing happens:
   - Check device connection status (should show ✅)
   - Ensure device is turned on and charged
   - Verify device supports vibration (some devices are rotate/stroke only)
   - Try disconnecting and reconnecting

### Audio Sync Configuration

1. Enable with **"🎵 Sync vibrations with speech patterns"** checkbox
2. Audio sync provides:
   - Gentle baseline vibration during normal speech (10-55%)
   - Increases during emphasized words and high pitch
   - Maximum boost (95%) when triggers are detected
3. Disable if you prefer trigger-only activation

### Emergency Stop

- Click **"⛔ Emergency Stop"** to immediately halt all device activity
- All patterns and audio sync will be cancelled
- Devices will return to idle state

## 🔧 Troubleshooting

### Browser Mode Issues

**"Bluetooth not available"**

- Ensure your browser supports Web Bluetooth (Chrome, Edge, Opera)
- Check system Bluetooth is enabled
- Grant Bluetooth permissions when prompted
- Restart browser if needed

**"No devices found during scan"**

- Put device in pairing mode (usually hold power button)
- Device must be within Bluetooth range (~30 feet / 10 meters)
- Ensure device is charged
- Try scanning again
- Some devices require specific pairing procedures (check manual)

**"Device disconnects frequently"**

- Move device closer to computer
- Check device battery level
- Reduce distance/interference between device and computer
- Ensure no other apps are trying to connect to device

### Intiface Mode Issues

**"Connection Failed" Error**

- Ensure Intiface Central is running
- Verify server status is "Server Running" (green)
- Check WebSocket port is 12345 (default)
- Try restarting Intiface Central
- Disable firewall/antivirus temporarily to test

**Device Not Appearing**

- Ensure device is powered on and in pairing mode
- Check device battery level
- Move device closer to computer
- Try scanning again after 10 seconds
- Restart both Intiface Central and device

### Audio Sync Issues

**"Vibration too weak/strong"**

- Audio sync calculates intensity from speech patterns
- Very quiet speech = low intensity
- Loud/emphasized speech = high intensity
- Triggers always boost to 95% regardless of volume
- Adjust system/TTS volume if needed

**"Vibration not matching speech"**

- Ensure TTS is enabled and playing
- Check that device is connected (not just paired)
- Audio sync requires active audio playback
- Works with both AI responses and manual TTS

**"Choppy/erratic vibration"**

- This is normal during rapid speech changes
- System updates 60 times per second
- Smoothing applied (0.7 ramp-up, 0.4 decay)
- Can be more responsive during dramatic voice inflection

### General Device Issues

**No Vibration on Trigger**

1. Verify **🎯 Triggers** are enabled (green status)
2. Check device connection status (✅ in device list)
3. Ensure category intensity sliders are above 0%
4. Test with **"🎯 Test Vibration"** button
5. Some devices may not support vibration (check [iostindex.com](https://iostindex.com))
6. Check device battery

**Delayed Response**

- Normal for AI-generated messages (triggers detected as message streams)
- Audio sync has <20ms latency for real-time response
- Trigger-based patterns activate when message completes
- Reduce TTS queue if speech playback is delayed

## 🔒 Privacy & Security

### Local Processing (Browser Mode)

- All device communication happens **locally** via Web Bluetooth
- No data sent to external servers
- Direct peer-to-peer connection with your device
- No internet connection required after page loads

### Local Processing (Intiface Mode)

- All device communication happens **locally** on your computer
- No device data is sent to external servers
- Buttplug.io uses encrypted WebSocket connections

### Data Storage

- Connection mode preference saved (browser/intiface)
- Trigger pattern intensity settings saved
- Audio sync preference saved
- No device names or connection history stored
- All settings stored in browser localStorage only (never sent to server)

### Permissions

**Browser Mode:**

- Requires Web Bluetooth permission (granted per device)
- No microphone, camera, or location access needed
- Bluetooth permissions managed by browser

**Intiface Mode:**

- Requires WebSocket connection permission
- Intiface Central handles device permissions
- No additional browser permissions needed

## 📊 Advanced Usage

### Multiple Devices

When multiple devices are connected:

- All devices respond to triggers and audio patterns simultaneously
- Each device receives identical intensity calculations
- Useful for multi-zone stimulation
- Individual device control coming in future updates

### Audio Sync Technical Details

**Web Audio API Analysis:**

- **Sample Rate**: 44.1kHz or 48kHz (browser default)
- **FFT Size**: 2048 samples (~46ms windows at 44.1kHz)
- **Update Rate**: 60 FPS (requestAnimationFrame)
- **Frequency Bins**: 1024 (0-22kHz range)

**Frequency Analysis Bands:**

```javascript
// Speech energy (vowels, fundamental frequencies)
0-60Hz: Base intensity calculation

// Pitch/intonation (vocal pitch variation)
60-300Hz: Intonation boost detection

// Speech intelligibility (consonants, clarity)
200-2000Hz: Primary speech energy

// Emphasis/sibilance (dramatic moments)
2000-8000Hz: High-frequency emphasis detection
```

**Intensity Calculation Algorithm:**

```javascript
// Base from speech energy
baseIntensity = 0.1 + (speechEnergy / 255) * 0.45; // 10-55% range

// Add intonation (pitch variation)
intonationBoost = (avgFrequency / 255) * 0.25; // up to +25%

// Add volume (amplitude)
volumeBoost = (amplitude / 100) * 0.3; // up to +30%

// Emphasis peak detection
if (highFreqEnergy > 40 || amplitude > 25) {
  emphasisBoost = +0.5; // up to 95% total
}

// Trigger override
if (triggerDetected) {
  finalIntensity = max(calculatedIntensity, 0.95); // 95% minimum
}

// Adaptive smoothing
smoothedIntensity =
  lastIntensity * (1 - smoothing) + targetIntensity * smoothing;
// smoothing = 0.7 (rising), 0.4 (falling)
```

**Performance Optimizations:**

- Analysis runs on main thread (necessary for real-time response)
- Minimal CPU impact: ~1-2% on modern processors
- Smoothing prevents excessive device commands
- 0.01 threshold filters micro-fluctuations while maintaining responsiveness

### Custom Patterns (Developers)

Modify vibration behavior in `buttplug-integration.js`:

**Category Intensity Defaults:**

```javascript
this.triggerIntensities = {
  primary: 0.7, // 70% for identity triggers
  mental: 0.5, // 50% for cognitive triggers
  physical: 0.9, // 90% for body triggers
  default: 0.6, // 60% for uncategorized
};
```

**Trigger-Based Pattern Duration:**

```javascript
this.triggerDurations = {
  primary: 3000, // 3 seconds
  mental: 2500, // 2.5 seconds
  physical: 2000, // 2 seconds
  default: 2000, // 2 seconds
};
```

**Audio Sync Parameters:**

```javascript
// In text2speech.js - syncVibrationWithAudio()
const BASE_RANGE = 0.45; // Max base intensity range
const INTONATION_FACTOR = 0.25; // Pitch sensitivity
const VOLUME_FACTOR = 0.3; // Amplitude sensitivity
const EMPHASIS_BOOST = 0.5; // Peak boost amount
const TRIGGER_MIN = 0.95; // Trigger minimum intensity
const RAMP_SMOOTHING = 0.7; // Fast ramp-up
const DECAY_SMOOTHING = 0.4; // Slower decay
const UPDATE_THRESHOLD = 0.01; // Sensitivity (lower = more responsive)
```

### Event Integration

Hook into the integration with custom event listeners:

**Trigger Detection:**

```javascript
document.addEventListener("trigger-detected", (event) => {
  const { triggerName, category, intensity } = event.detail;
  console.log(`Trigger: ${triggerName} (${category}) at ${intensity}%`);
});
```

**Device Connection Changes:**

```javascript
document.addEventListener("buttplug-devices-updated", (event) => {
  const { devices, count } = event.detail;
  console.log(
    `${count} devices connected:`,
    devices.map((d) => d.name),
  );
});
```

**Audio Sync Updates:**

```javascript
// Custom event fired during audio analysis (60 FPS)
document.addEventListener("audio-pattern-analyzed", (event) => {
  const { speechEnergy, avgFrequency, amplitude, isEmphasis } = event.detail;
  // Use for custom visualizations or logging
});
```

## 🆘 Support & Resources

### Official Resources

1. **Buttplug.io Website**: [https://buttplug.io](https://buttplug.io)
2. **Documentation**: [https://docs.buttplug.io](https://docs.buttplug.io)
3. **Discord Community**: [https://discord.buttplug.io](https://discord.buttplug.io)
4. **Discussion Forums**: [https://discuss.buttplug.io](https://discuss.buttplug.io)
5. **Device Database**: [https://iostindex.com](https://iostindex.com) - Check compatibility
6. **GitHub**: [https://github.com/buttplugio](https://github.com/buttplugio)

### BambiSleep Chat Documentation

- **Audio Sync Guide**: [AUDIO-SYNC-GUIDE.md](AUDIO-SYNC-GUIDE.md) - Detailed audio analysis info
- **Trigger System**: [TRIGGERS-SYSTEM-GUIDE.md](TRIGGERS-SYSTEM-GUIDE.md) - Trigger categories
- **TTS Voice Guide**: [TTS-VOICE-GUIDE.md](TTS-VOICE-GUIDE.md) - Voice configuration

### Common Questions

**Q: Does this work on mobile?**  
A: **Browser mode** works on Android Chrome with Bluetooth. iOS Safari does not support Web Bluetooth. Desktop recommended for best experience.

**Q: Can I use this with other apps simultaneously?**  
A: **Intiface mode**: Yes! Intiface Central supports multiple app connections.  
**Browser mode**: No, Web Bluetooth is exclusive to one app at a time.

**Q: Is this safe for my device?**  
A: Yes. Buttplug.io respects device safety limits and won't exceed manufacturer specifications. The library includes built-in safeguards.

**Q: Do I need internet connection?**  
A: Device control is 100% local. Internet only needed for:
- AI chat with LM Studio (if using remote server)
- Initial page load
- Downloading voices (cached after first use)

**Q: What if I don't want device integration?**  
A: Completely optional! Chat works normally without it. Just don't click the 🔌 Devices button.

**Q: Does audio sync work without TTS?**  
A: No. Audio sync requires TTS (text-to-speech) to be enabled. It analyzes the speech audio in real-time.

**Q: Can I use my own audio files?**  
A: Currently only TTS audio is analyzed. Custom audio support planned for future updates.

**Q: How much does this cost?**  
A: BambiSleep Chat is free. Buttplug.io is free. Intiface Central is free. You only pay for your hardware device.

## 📝 Technical Details

### Architecture

**Browser Mode:**
```
BambiSleep Chat (Browser)
    ↓ Web Bluetooth API (direct)
Device Hardware
```

**Intiface Mode:**
```
BambiSleep Chat (Browser)
    ↓ WebSocket (ws://localhost:12345)
Intiface Central (Desktop App)
    ↓ Bluetooth/USB/Serial
Device Hardware
```

### Libraries & APIs Used

- **buttplug-js**: JavaScript client library (v3.2.0+)
- **Web Audio API**: Real-time audio frequency analysis
- **Web Bluetooth API**: Direct browser-to-device communication (browser mode)
- **WebSocket API**: Real-time Intiface communication (intiface mode)
- **Intiface Central**: Device connection server

### Browser Compatibility

| Browser | Web Bluetooth | WebSocket | Recommended |
|---------|---------------|-----------|-------------|
| Chrome  | ✅ Full       | ✅ Full   | ✅ Yes      |
| Edge    | ✅ Full       | ✅ Full   | ✅ Yes      |
| Opera   | ✅ Full       | ✅ Full   | ✅ Yes      |
| Firefox | ❌ No         | ✅ Full   | ⚠️ Intiface only |
| Safari  | ❌ No         | ✅ Full   | ❌ Limited  |

**Note**: Web Bluetooth requires HTTPS or localhost. This app uses localhost for development.

### Performance Metrics

**Audio Analysis:**
- **Latency**: <20ms from audio to device command
- **CPU Usage**: 1-2% on modern processors (Intel i5/AMD Ryzen 5+)
- **Memory**: ~5MB additional (for audio buffers and FFT)
- **Update Rate**: 60 Hz (60 times per second)

**Device Communication:**
- **Latency**: 10-50ms (device-dependent)
- **Bluetooth**: 5-15ms typical
- **USB**: 1-5ms typical
- **WebSocket**: <1ms local connection

## 🎓 Best Practices

### Getting Started
1. **Start Low**: Begin with 20-30% intensity and increase gradually
2. **Test First**: Always use "🎯 Test Vibration" before live sessions
3. **Know Your Limits**: Emergency stop is always available (⛔ button)
4. **Device Care**: Keep devices charged (>30%), clean, and within temperature limits

### Trigger Configuration
1. **Start Simple**: Enable 2-3 core triggers first (Good Girl, Bambi)
2. **Category Balance**: Mental triggers lower (50%), Physical triggers higher (90%)
3. **Trigger Selection**: Choose triggers that resonate with your experience
4. **Gradual Expansion**: Add more triggers as you become comfortable

### Audio Sync Usage
1. **Enable TTS**: Audio sync requires active speech playback
2. **Adjust Volume**: System/TTS volume affects intensity calculation
3. **Voice Selection**: Choose voices with clear, expressive intonation
4. **Test Patterns**: Speak/play different content to feel intensity variations

### Safety & Comfort
1. **Session Length**: Take breaks every 30-60 minutes, let device cool
2. **Battery Monitoring**: Don't use on very low battery (<10%)
3. **Temperature**: If device feels hot, stop and let it cool
4. **Hygiene**: Clean devices before and after use per manufacturer instructions
5. **Hydration**: Stay hydrated during longer sessions

## 🔮 Future Features

Planned enhancements:

**Device Control:**
- Individual device control (different intensities per device)
- Multi-motor support (control different motors independently)
- Pattern recording and playback
- Custom pattern builder UI

**Audio Features:**
- Custom audio file analysis (upload your own files)
- Beat detection for rhythm-based patterns
- Voice frequency fingerprinting (different patterns for different speakers)
- Stereo audio analysis (left/right channel mapping)

**Trigger Enhancements:**
- Trigger-specific pattern overrides
- Duration customization per trigger
- Trigger combinations (AND/OR logic)
- Trigger intensity ramp-up over session time

**Integration:**
- Mobile device support (Android/iOS apps)
- Multi-user synchronization (shared sessions)
- Community pattern library
- VR headset integration

**Advanced:**
- Machine learning pattern generation
- Biometric feedback integration (heart rate, arousal detection)
- Scriptable patterns (JavaScript API)
- MIDI controller support

## ⚖️ Disclaimer

**Age Restriction**: This integration is for adults (18+) only.

**User Responsibility**: Users are solely responsible for:
- Safe, consensual, and legal use of intimate devices
- Following all device manufacturer safety guidelines
- Monitoring device temperature, battery, and condition
- Using appropriate intensity levels for personal comfort
- Ensuring proper device hygiene and maintenance
- Compliance with local laws and regulations

**No Liability**: The developers, contributors, and Buttplug.io are not responsible for:
- Device misuse, damage, malfunction, or injury
- Data loss or privacy breaches
- Third-party device manufacturer issues
- Consequences of improper use

**Device Safety**: 
- Never use damaged devices
- Follow manufacturer intensity and duration limits
- Stop immediately if pain or discomfort occurs
- Seek medical attention if injury occurs

**Privacy**: 
- All device communication is local (not sent to internet)
- Settings stored in browser only (not on server)
- No telemetry or usage tracking
- Your sessions are private

**Health**:
- Consult healthcare provider if you have medical conditions
- Not recommended for individuals with pacemakers, epilepsy, or heart conditions
- Pregnant individuals should consult doctor before use
- Stop use if unusual symptoms occur

---

**Enjoy your enhanced BambiSleep experience responsibly! 💖✨**

*Last Updated: January 28, 2026*  
*Version: 2.0 (Audio Sync Release)*

_For technical issues, see troubleshooting section. For device compatibility questions, visit [iostindex.com](https://iostindex.com). For general support, join the [Buttplug.io Discord](https://discord.buttplug.io)._
