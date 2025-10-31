import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';

const TTSDropdown = ({ isOpen, onToggle }) => {
    const [isEnabled, setIsEnabled] = useState(false);
    const [selectedVoice, setSelectedVoice] = useState('af_bella');
    const [speed, setSpeed] = useState(1.0);
    const [isPlaying, setIsPlaying] = useState(false);
    const { emit, on, off, isConnected } = useSocket();

    // Available voices from Kokoro TTS
    const voices = [
        { id: 'af_bella', name: 'Bella', description: 'Warm and friendly' },
        { id: 'af_sky', name: 'Sky', description: 'Sweet and gentle' },
        { id: 'af_bella+af_sky', name: 'Bella + Sky', description: 'Mixed voices' }
    ];

    useEffect(() => {
        const handleTTSResponse = (data) => {
            setIsPlaying(false);
            // Handle audio playback
            if (data.audioData) {
                const audio = new Audio(`data:audio/mpeg;base64,${data.audioData}`);
                audio.play().catch(err => console.error('Audio playback failed:', err));
            }
        };

        const handleTTSError = (error) => {
            setIsPlaying(false);
            console.error('TTS Error:', error);
        };

        if (isConnected) {
            on('tts-response', handleTTSResponse);
            on('tts-error', handleTTSError);
        }

        return () => {
            off('tts-response', handleTTSResponse);
            off('tts-error', handleTTSError);
        };
    }, [isConnected, on, off]);

    const handleToggle = () => {
        setIsEnabled(!isEnabled);
    };

    const handleVoiceChange = (voiceId) => {
        setSelectedVoice(voiceId);
    };

    const handleSpeedChange = (e) => {
        setSpeed(parseFloat(e.target.value));
    };

    const testTTS = () => {
        if (!isConnected || isPlaying) return;

        setIsPlaying(true);
        emit('tts-request', {
            text: 'Hello, this is a voice test for BambiSleep Chat',
            voice: selectedVoice,
            speed: speed
        });
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
                🔊 TTS
            </button>

            {isOpen && (
                <div className="dropdown-content">
                    <div className="dropdown-header">
                        <h3>Text-to-Speech Settings</h3>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={handleToggle}
                            />
                            <span className="slider"></span>
                            <span className="label">Enable TTS</span>
                        </label>
                    </div>

                    {isEnabled && (
                        <div className="tts-controls">
                            <div className="control-group">
                                <label>Voice Selection:</label>
                                <div className="voice-options">
                                    {voices.map((voice) => (
                                        <div key={voice.id} className="voice-option">
                                            <input
                                                type="radio"
                                                id={voice.id}
                                                name="voice"
                                                value={voice.id}
                                                checked={selectedVoice === voice.id}
                                                onChange={() => handleVoiceChange(voice.id)}
                                            />
                                            <label htmlFor={voice.id}>
                                                <strong>{voice.name}</strong>
                                                <span className="voice-description">{voice.description}</span>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="control-group">
                                <label htmlFor="speed">Speed: {speed}x</label>
                                <input
                                    type="range"
                                    id="speed"
                                    min="0.5"
                                    max="2.0"
                                    step="0.1"
                                    value={speed}
                                    onChange={handleSpeedChange}
                                    className="speed-slider"
                                />
                            </div>

                            <div className="control-group">
                                <button
                                    onClick={testTTS}
                                    disabled={!isConnected || isPlaying}
                                    className="test-button"
                                >
                                    {isPlaying ? '🔄 Playing...' : '🎵 Test Voice'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TTSDropdown;