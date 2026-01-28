# Audio Pattern Synchronization Guide

## Overview

The Audio Pattern Synchronization system analyzes real-time speech patterns from TTS audio and synchronizes haptic device vibrations with vocal characteristics like emphasis, pitch changes, and volume dynamics.

## How It Works

### Web Audio API Analysis

The system uses the **Web Audio API** to perform real-time frequency and amplitude analysis:

```
Audio Stream → AnalyserNode → FFT Analysis → Pattern Detection → Vibration Sync
```

#### 1. **Audio Context Setup**

- Creates an `AudioContext` with sample rate matching system audio
- Connects audio element to `AnalyserNode` for real-time analysis
- Uses FFT size of 2048 for high-resolution frequency detection

#### 2. **Data Extraction**

Two types of data are analyzed every animation frame (~60Hz):

**Frequency Domain Data** (`analyser.getByteFrequencyData()`)

- Spectrum analysis from 0Hz to Nyquist frequency
- Detects speech energy in low-mid range (200-2000Hz)
- Identifies pitch characteristics and tonal quality

**Time Domain Data** (`analyser.getByteTimeDomainData()`)

- Raw waveform amplitude data
- Detects volume peaks and emphasis
- Measures overall speech intensity

#### 3. **Pattern Detection**

The system calculates multiple audio characteristics:

| Metric                 | Calculation                         | Purpose                      |
| ---------------------- | ----------------------------------- | ---------------------------- |
| **Average Frequency**  | Mean of all frequency bins          | Overall audio activity level |
| **Amplitude**          | Deviation from baseline (128)       | Volume/emphasis detection    |
| **Speech Energy**      | Mean energy in 200-2000Hz range     | Vocal clarity and emphasis   |
| **Emphasis Detection** | speechEnergy > 60 OR amplitude > 30 | Peaks in speech for boost    |

#### 4. **Vibration Mapping**

Audio patterns are mapped to vibration intensity:

```javascript
// Base intensity from speech energy (0.1 - 0.6 range)
baseIntensity = 0.1 + (speechEnergy / 255) * 0.5;

// Boost during emphasis
if (isEmphasis) {
  intensity = min(0.8, baseIntensity + 0.3);
}

// Smooth transitions (30% blending factor)
smoothedIntensity = lastIntensity * 0.7 + newIntensity * 0.3;
```

### Integration with Trigger System

The audio sync works **alongside** the trigger-based vibration system:

1. **Trigger Detection** - When TTS starts, triggers are detected and vibrated per category
2. **Audio Sync** - During playback, continuous vibration adjusts to speech patterns
3. **Cleanup** - When audio ends, all vibrations stop

This creates **layered haptic feedback**:

- **Trigger bursts** for keyword activation
- **Continuous modulation** following speech dynamics

## Configuration

### Enable/Disable Audio Sync

In the **Buttplug Dropdown** UI:

```
🎵 Audio Pattern Synchronization
☑️ Sync vibrations with speech patterns (emphasis, pitch, volume)
```

Toggle this checkbox to enable/disable the feature. When enabled:

- Vibration intensity varies with speech characteristics
- Emphasis and peaks cause stronger vibrations
- Transitions are smoothed to avoid jarring changes

When disabled:

- Only trigger-based vibrations occur
- No continuous audio analysis

### Technical Parameters

Advanced users can modify these in [`text2speech.js`](../js/text2speech.js):

```javascript
// Analysis Configuration
this.analyser.fftSize = 2048; // FFT resolution (higher = more detail)
this.analyser.smoothingTimeConstant = 0.8; // Smoothing factor (0-1)

// Vibration Mapping
const baseIntensity = 0.1 + (speechEnergy / 255) * 0.5; // Base range
const emphasisBoost = 0.3; // Boost during peaks
const smoothingFactor = 0.3; // Transition smoothness

// Frequency Ranges
const speechFreqStart = 200; // Hz - Start of speech range
const speechFreqEnd = 2000; // Hz - End of speech range
```

## Performance Considerations

### Browser Compatibility

**Required**: Modern browser with Web Audio API support

- ✅ Chrome/Edge 89+
- ✅ Firefox 88+
- ✅ Safari 14.1+
- ❌ Internet Explorer (not supported)

**Auto-fallback**: If Web Audio API is unavailable, the system automatically disables audio analysis and falls back to trigger-only vibrations.

### Resource Usage

| Component          | Impact            | Mitigation                                      |
| ------------------ | ----------------- | ----------------------------------------------- |
| **FFT Analysis**   | ~5-10ms per frame | Uses `requestAnimationFrame` for optimal timing |
| **Frequency Data** | 1024 bytes buffer | Pre-allocated `Uint8Array`, no GC pressure      |
| **Device Updates** | Network latency   | Throttled to significant changes (>5% delta)    |

### Optimization Strategies

1. **Throttling**: Vibration commands only sent when intensity changes by >5%
2. **Smoothing**: Prevents micro-adjustments and reduces command frequency
3. **Conditional Analysis**: Loop only runs when audio is actively playing
4. **Cleanup**: `cancelAnimationFrame` stops analysis when audio ends

## Troubleshooting

### No Vibration During Speech

**Symptom**: Trigger vibrations work, but no continuous modulation

**Solutions**:

1. Check audio sync toggle is **enabled** in Buttplug dropdown
2. Verify Web Audio API initialized (check console for "🎵 Web Audio API initialized")
3. Ensure device is connected and enabled
4. Check browser console for AudioContext errors

### Jerky/Stuttering Vibrations

**Symptom**: Vibrations are not smooth, rapid on/off

**Solutions**:

1. Increase smoothing factor in `syncVibrationWithAudio()`:
   ```javascript
   const smoothingFactor = 0.5; // Higher = smoother (0.3 → 0.5)
   ```
2. Increase change threshold to reduce update frequency:
   ```javascript
   if (Math.abs(smoothedIntensity - this.lastVibrationIntensity) > 0.1) // 0.05 → 0.1
   ```

### Vibrations Too Weak/Strong

**Symptom**: Intensity doesn't match expectations

**Solutions**:

1. Adjust base intensity range:
   ```javascript
   // Increase range for stronger vibrations
   let targetIntensity = 0.2 + (patterns.speechEnergy / 255) * 0.7; // 0.1-0.6 → 0.2-0.9
   ```
2. Modify emphasis boost:
   ```javascript
   targetIntensity = Math.min(1.0, targetIntensity + 0.5); // 0.3 → 0.5 boost
   ```
3. Check trigger category intensity sliders in Buttplug dropdown

### Web Audio API Not Initializing

**Symptom**: Console shows "Web Audio API not supported"

**Solutions**:

1. Update browser to latest version
2. Check browser compatibility (see table above)
3. Ensure audio element exists before initialization
4. Try creating AudioContext manually in DevTools:
   ```javascript
   new (window.AudioContext || window.webkitAudioContext)();
   ```

## Use Cases

### Meditation & Hypnosis

**Goal**: Subtle, calming vibrations that follow voice guidance

**Configuration**:

- Enable audio sync
- Lower trigger intensities (20-40%)
- Longer smoothing for gentle transitions

### Intense Conditioning

**Goal**: Strong, responsive vibrations emphasizing key phrases

**Configuration**:

- Enable audio sync + trigger detection
- Higher trigger intensities (70-90%)
- Lower smoothing for immediate response

### ASMR & Whispers

**Goal**: Very gentle, sensitivity-focused vibrations

**Configuration**:

- Enable audio sync
- Very low base intensity (0.05-0.3 range)
- High smoothing factor (0.6-0.8)

## Technical Deep Dive

### FFT Analysis Explained

**Fast Fourier Transform** converts time-domain audio (waveform) into frequency-domain (spectrum):

```
Time Domain:     [amplitude1, amplitude2, amplitude3, ...]
                          ↓ FFT
Frequency Domain: [freq1_power, freq2_power, freq3_power, ...]
```

With `fftSize = 2048`:

- 1024 frequency bins (half of FFT size due to Nyquist)
- Bin resolution = sampleRate / fftSize (e.g., 48000Hz / 2048 ≈ 23.4Hz per bin)
- Range: 0Hz to sampleRate/2 (Nyquist frequency)

### Speech Frequency Ranges

Human speech occupies specific frequency bands:

| Range                | Frequency   | Contains              |
| -------------------- | ----------- | --------------------- |
| **Fundamental (F0)** | 85-255Hz    | Pitch/tone            |
| **Formants (F1-F3)** | 200-3500Hz  | Vowel characteristics |
| **Sibilants**        | 4000-8000Hz | "S", "T", "Sh" sounds |

The system focuses on **200-2000Hz** to capture:

- Primary vocal energy
- Emphasis patterns
- Clarity and articulation

### Smoothing Algorithm

Exponential moving average prevents jarring transitions:

```javascript
smooth(t) = smooth(t-1) * (1 - α) + new(t) * α

Where:
  α = smoothing factor (0.3 = 30% new, 70% old)
  smooth(t) = current smoothed value
  smooth(t-1) = previous smoothed value
  new(t) = new target value
```

This creates **gradual ramps** instead of instant changes, making vibrations feel natural and responsive.

## Future Enhancements

Potential additions to the audio sync system:

1. **Preset Profiles** - Pre-configured sensitivity levels (Gentle/Moderate/Intense)
2. **Frequency-Specific Patterns** - Different vibration motors respond to different frequency ranges
3. **Multi-Device Choreography** - Coordinate multiple devices based on stereo/surround audio
4. **Rhythm Detection** - Sync to speech cadence and pauses
5. **Custom Mapping Curves** - Non-linear intensity mapping for advanced users

## References

- [Web Audio API Specification](https://www.w3.org/TR/webaudio/)
- [AnalyserNode Documentation](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode)
- [Buttplug.io Protocol Spec](https://buttplug-spec.docs.buttplug.io/)
- [Speech Acoustics Primer](https://www.phon.ucl.ac.uk/courses/spsci/acoustics/)

---

**Last Updated**: January 28, 2026  
**Version**: 1.0.0  
**Related Guides**: [Buttplug Integration](BUTTPLUG-INTEGRATION-GUIDE.md), [TTS Voice Guide](TTS-VOICE-GUIDE.md), [Triggers System](TRIGGERS-SYSTEM-GUIDE.md)
