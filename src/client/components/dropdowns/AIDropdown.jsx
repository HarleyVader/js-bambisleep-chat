import React from 'react';
import { useChat } from '../../context/ChatContext';

const AIDropdown = ({ isOpen, onToggle }) => {
    const { aiMode, setAIMode, isConnected } = useChat();

    const handleToggle = () => {
        setAIMode(!aiMode);
    };

    return (
        <div className="dropdown-container">
            <button
                className={`dropdown-btn toggle-button ${aiMode ? 'active' : ''}`}
                data-state={aiMode ? 'on' : 'off'}
                onClick={onToggle}
            >
                <span className="status-indicator">
                    <span className={aiMode ? 'status-active' : 'status-inactive'}>●</span>
                </span>
                🤖 AI Mode
            </button>

            {isOpen && (
                <div className="dropdown-content">
                    <div className="dropdown-header">
                        <h3>AI Chat Mode</h3>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={aiMode}
                                onChange={handleToggle}
                                disabled={!isConnected}
                            />
                            <span className="slider"></span>
                            <span className="label">Enable AI Chat</span>
                        </label>
                    </div>

                    <div className="ai-info">
                        <p>
                            {aiMode
                                ? '🤖 AI mode is active. Your messages will be sent to the AI.'
                                : '💬 Standard chat mode. Messages go to all users.'}
                        </p>

                        {aiMode && (
                            <div className="ai-features">
                                <h4>AI Features:</h4>
                                <ul>
                                    <li>🧠 Intelligent responses</li>
                                    <li>🎭 Roleplay support</li>
                                    <li>💫 Trigger-aware conversations</li>
                                    <li>🔒 Private AI chat sessions</li>
                                </ul>
                            </div>
                        )}

                        {!isConnected && (
                            <p className="warning">
                                ⚠️ Connection required for AI mode
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIDropdown;