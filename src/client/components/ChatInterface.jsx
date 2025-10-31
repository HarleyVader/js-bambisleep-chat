import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../context/ChatContext';

const ChatInterface = () => {
    const [inputMessage, setInputMessage] = useState('');
    const messagesEndRef = useRef(null);
    const {
        messages,
        username,
        aiMode,
        chatEnabled,
        isConnected,
        sendGlobalMessage,
        sendAIMessage,
        clearMessages
    } = useChat();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || !isConnected) return;

        if (aiMode) {
            sendAIMessage(inputMessage);
        } else {
            sendGlobalMessage(inputMessage);
        }

        setInputMessage('');
    };

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getMessageClass = (message) => {
        switch (message.type) {
            case 'ai':
                return 'ai-message';
            case 'system':
                return 'system-message';
            case 'global':
                return message.username === username ? 'own-message' : 'other-message';
            default:
                return 'default-message';
        }
    };

    return (
        <div className="chat-interface">
            <div className="chat-header">
                <h2>BambiSleep Chat</h2>
                <div className="chat-controls">
                    <span className="username-display">@{username}</span>
                    <button
                        onClick={clearMessages}
                        className="clear-button"
                        title="Clear messages"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            <div className="messages-container">
                {messages.length === 0 && (
                    <div className="welcome-message">
                        <p>Welcome to BambiSleep Chat! 💕</p>
                        <p>Start typing to join the conversation...</p>
                    </div>
                )}

                {messages.map((message) => (
                    <div key={message.id} className={`message ${getMessageClass(message)}`}>
                        <div className="message-header">
                            {message.username && (
                                <span className="message-username">@{message.username}</span>
                            )}
                            <span className="message-time">{formatTimestamp(message.timestamp)}</span>
                        </div>
                        <div className="message-content">
                            {message.message}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="message-input-form">
                <div className="input-container">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder={
                            !isConnected
                                ? 'Connecting...'
                                : !chatEnabled
                                    ? 'Chat disabled'
                                    : aiMode
                                        ? 'Message AI...'
                                        : 'Type a message...'
                        }
                        disabled={!isConnected || !chatEnabled}
                        className="message-input"
                    />
                    <button
                        type="submit"
                        disabled={!isConnected || !chatEnabled || !inputMessage.trim()}
                        className="send-button"
                    >
                        {aiMode ? '🤖' : '💬'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ChatInterface;