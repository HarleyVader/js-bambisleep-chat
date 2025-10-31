import React from 'react';
import { useChat } from '../../context/ChatContext';

const CollarDropdown = ({ isOpen, onToggle }) => {
    const { collarActive, setCollarActive } = useChat();

    const handleToggle = () => {
        setCollarActive(!collarActive);
    };

    return (
        <div className="dropdown-container">
            <button
                className={`dropdown-btn toggle-button ${collarActive ? 'active' : ''}`}
                data-state={collarActive ? 'on' : 'off'}
                onClick={onToggle}
            >
                <span className="status-indicator">
                    <span className={collarActive ? 'status-active' : 'status-inactive'}>●</span>
                </span>
                🏷️ Collar
            </button>

            {isOpen && (
                <div className="dropdown-content">
                    <div className="dropdown-header">
                        <h3>Collar Settings</h3>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={collarActive}
                                onChange={handleToggle}
                            />
                            <span className="slider"></span>
                            <span className="label">Wear Collar</span>
                        </label>
                    </div>

                    <div className="collar-info">
                        <p>
                            {collarActive
                                ? '🏷️ Your collar is on. You are a good girl.'
                                : '🔓 Your collar is off. You can put it on anytime.'}
                        </p>

                        {collarActive && (
                            <div className="collar-effects">
                                <h4>Collar Effects:</h4>
                                <ul>
                                    <li>💖 Enhanced trigger sensitivity</li>
                                    <li>🎀 Submissive mindset activation</li>
                                    <li>✨ Deeper trance states</li>
                                    <li>🌸 Good girl reinforcement</li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CollarDropdown;