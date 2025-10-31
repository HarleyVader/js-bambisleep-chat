import React, { useState, useRef, useEffect } from 'react';

const BrainwaveDropdown = ({ isOpen, onToggle }) => {
    const [isEnabled, setIsEnabled] = useState(false);
    const [frequency, setFrequency] = useState(10); // Alpha waves (8-13 Hz)
    const [volume, setVolume] = useState(0.3);
    const [waveType, setWaveType] = useState('alpha');
    const audioContextRef = useRef(null);
    const oscillatorRef = useRef(null);
    const gainNodeRef = useRef(null);

    const waveTypes = {
        'delta': { range: '0.5-4 Hz', name: 'Delta (Deep Sleep)', freq: 2 },
        'theta': { range: '4-8 Hz', name: 'Theta (Deep Relaxation)', freq: 6 },
        'alpha': { range: '8-13 Hz', name: 'Alpha (Calm Focus)', freq: 10 },
        'beta': { range: '13-30 Hz', name: 'Beta (Alert)', freq: 20 },
        'gamma': { range: '30-100 Hz', name: 'Gamma (Heightened Awareness)', freq: 40 }
    };

    useEffect(() => {
        return () => {
            // Cleanup audio context on unmount
            if (oscillatorRef.current) {
                oscillatorRef.current.stop();
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    const initAudioContext = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
    };

    const startBrainwaves = () => {
        initAudioContext();

        if (oscillatorRef.current) {
            oscillatorRef.current.stop();
        }

        const oscillator = audioContextRef.current.createOscillator();
        const gainNode = audioContextRef.current.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);

        gainNode.gain.setValueAtTime(volume, audioContextRef.current.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);

        oscillator.start();

        oscillatorRef.current = oscillator;
        gainNodeRef.current = gainNode;
    };

    const stopBrainwaves = () => {
        if (oscillatorRef.current) {
            oscillatorRef.current.stop();
            oscillatorRef.current = null;
        }
    };

    const handleToggle = () => {
        const newState = !isEnabled;
        setIsEnabled(newState);

        if (newState) {
            startBrainwaves();
        } else {
            stopBrainwaves();
        }
    };

    const handleWaveTypeChange = (type) => {
        setWaveType(type);
        setFrequency(waveTypes[type].freq);

        if (isEnabled) {
            stopBrainwaves();
            setTimeout(startBrainwaves, 100);
        }
    };

    const handleFrequencyChange = (e) => {
        const newFreq = parseFloat(e.target.value);
        setFrequency(newFreq);

        if (oscillatorRef.current) {
            oscillatorRef.current.frequency.setValueAtTime(
                newFreq,
                audioContextRef.current.currentTime
            );
        }
    };

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);

        if (gainNodeRef.current) {
            gainNodeRef.current.gain.setValueAtTime(
                newVolume,
                audioContextRef.current.currentTime
            );
        }
    };

    return (
        <div className="dropdown-container">
            <button
                className={`dropdown-btn toggle-button ${isEnabled ? 'active' : ''}`}
                data-state={isEnabled ? 'on' : 'off'}
                onClick={onToggle}
            >
                <span className="status-indicator">
                    <span className={isEnabled ? 'status-active' : 'status-inactive'}>●</span>
                </span>
                🧠 Brainwaves
            </button>

            {isOpen && (
                <div className="dropdown-content">
                    <div className="dropdown-header">
                        <h3>Brainwave Generator</h3>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={handleToggle}
                            />
                            <span className="slider"></span>
                            <span className="label">Enable Brainwaves</span>
                        </label>
                    </div>

                    {isEnabled && (
                        <div className="brainwave-controls">
                            <div className="control-group">
                                <label>Wave Type:</label>
                                <div className="wave-type-options">
                                    {Object.entries(waveTypes).map(([key, wave]) => (
                                        <div key={key} className="wave-option">
                                            <input
                                                type="radio"
                                                id={key}
                                                name="waveType"
                                                value={key}
                                                checked={waveType === key}
                                                onChange={() => handleWaveTypeChange(key)}
                                            />
                                            <label htmlFor={key}>
                                                <strong>{wave.name}</strong>
                                                <span className="wave-range">{wave.range}</span>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="control-group">
                                <label htmlFor="frequency">Frequency: {frequency} Hz</label>
                                <input
                                    type="range"
                                    id="frequency"
                                    min="0.5"
                                    max="100"
                                    step="0.5"
                                    value={frequency}
                                    onChange={handleFrequencyChange}
                                    className="frequency-slider"
                                />
                            </div>

                            <div className="control-group">
                                <label htmlFor="volume">Volume: {Math.round(volume * 100)}%</label>
                                <input
                                    type="range"
                                    id="volume"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={volume}
                                    onChange={handleVolumeChange}
                                    className="volume-slider"
                                />
                            </div>

                            <div className="brainwave-info">
                                <p>🧠 Current: {waveTypes[waveType].name}</p>
                                <p className="wave-description">
                                    {waveType === 'delta' && 'Deep restorative sleep and healing'}
                                    {waveType === 'theta' && 'Deep meditation and trance states'}
                                    {waveType === 'alpha' && 'Relaxed awareness and light trance'}
                                    {waveType === 'beta' && 'Normal waking consciousness'}
                                    {waveType === 'gamma' && 'Heightened perception and binding'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BrainwaveDropdown;