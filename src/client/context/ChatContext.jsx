import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useSocket } from './SocketContext';

const ChatContext = createContext();

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};

// Chat state management
const chatReducer = (state, action) => {
    switch (action.type) {
        case 'SET_USERNAME':
            return { ...state, username: action.payload };
        case 'ADD_MESSAGE':
            return {
                ...state,
                messages: [...state.messages.slice(-99), action.payload] // Keep last 100 messages
            };
        case 'CLEAR_MESSAGES':
            return { ...state, messages: [] };
        case 'SET_AI_MODE':
            return { ...state, aiMode: action.payload };
        case 'SET_COLLAR_ACTIVE':
            return { ...state, collarActive: action.payload };
        case 'SET_CHAT_ENABLED':
            return { ...state, chatEnabled: action.payload };
        case 'SET_ACTIVE_TRIGGERS':
            return { ...state, activeTriggers: action.payload };
        case 'SET_ALL_TRIGGERS':
            return { ...state, allTriggers: action.payload };
        case 'SET_TRIGGER_CATEGORIES':
            return { ...state, triggerCategories: action.payload };
        default:
            return state;
    }
};

const initialState = {
    username: '',
    messages: [],
    aiMode: false,
    collarActive: false,
    chatEnabled: true,
    activeTriggers: [],
    allTriggers: [],
    triggerCategories: {}
};

export const ChatProvider = ({ children }) => {
    const [state, dispatch] = useReducer(chatReducer, initialState);
    const { socket, isConnected, emit, on, off } = useSocket();

    // Generate username on mount
    useEffect(() => {
        const generateUsername = () => {
            const adjectives = ['Happy', 'Sleepy', 'Dreamy', 'Peaceful', 'Gentle', 'Sweet', 'Soft'];
            const nouns = ['Doll', 'Pet', 'Angel', 'Bambi', 'Toy', 'Good Girl', 'Princess'];
            const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
            const noun = nouns[Math.floor(Math.random() * nouns.length)];
            return `${adj}${noun}${Math.floor(Math.random() * 1000)}`;
        };

        if (!state.username) {
            dispatch({ type: 'SET_USERNAME', payload: generateUsername() });
        }
    }, [state.username]);

    // Load official BambiSleep triggers
    useEffect(() => {
        const loadOfficialTriggers = async () => {
            try {
                const response = await fetch('/api/triggers/json');
                const data = await response.json();

                if (data.triggers && Array.isArray(data.triggers)) {
                    const allTriggers = data.triggers.map(trigger => ({
                        name: trigger.name.toUpperCase(),
                        category: trigger.category,
                        safetyLevel: trigger.safetyLevel,
                        description: trigger.description
                    }));

                    dispatch({ type: 'SET_ALL_TRIGGERS', payload: allTriggers });
                    dispatch({ type: 'SET_TRIGGER_CATEGORIES', payload: data.categories || {} });

                    // Select default active triggers - prioritize primary category
                    const primaryTriggers = data.triggers.filter(t => t.category === 'primary').slice(0, 2);
                    const mentalTriggers = data.triggers.filter(t => t.category === 'mental').slice(0, 1);
                    const defaultActive = [...primaryTriggers, ...mentalTriggers].map(t => t.name.toUpperCase());

                    dispatch({ type: 'SET_ACTIVE_TRIGGERS', payload: defaultActive });
                }
            } catch (error) {
                console.error('Failed to load triggers:', error);
            }
        };

        loadOfficialTriggers();
    }, []);

    // Socket event handlers
    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleGlobalMessage = (data) => {
            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: Date.now(),
                    type: 'global',
                    username: data.username,
                    message: data.message,
                    timestamp: new Date().toISOString()
                }
            });
        };

        const handleAIMessage = (data) => {
            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: Date.now(),
                    type: 'ai',
                    message: data.message,
                    timestamp: new Date().toISOString()
                }
            });
        };

        const handleSystemMessage = (data) => {
            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: Date.now(),
                    type: 'system',
                    message: data.message,
                    timestamp: new Date().toISOString()
                }
            });
        };

        on('global-message', handleGlobalMessage);
        on('ai-message', handleAIMessage);
        on('system-message', handleSystemMessage);

        return () => {
            off('global-message', handleGlobalMessage);
            off('ai-message', handleAIMessage);
            off('system-message', handleSystemMessage);
        };
    }, [socket, isConnected, on, off]);

    // Chat actions
    const sendGlobalMessage = (message) => {
        if (!isConnected || !state.chatEnabled || !message.trim()) return;

        emit('global-message', {
            username: state.username,
            message: message.trim()
        });
    };

    const sendAIMessage = (message) => {
        if (!isConnected || !state.aiMode || !message.trim()) return;

        emit('ai-message', {
            username: state.username,
            message: message.trim()
        });
    };

    const clearMessages = () => {
        dispatch({ type: 'CLEAR_MESSAGES' });
    };

    const setUsername = (username) => {
        dispatch({ type: 'SET_USERNAME', payload: username });
    };

    const setAIMode = (enabled) => {
        dispatch({ type: 'SET_AI_MODE', payload: enabled });
    };

    const setCollarActive = (active) => {
        dispatch({ type: 'SET_COLLAR_ACTIVE', payload: active });
    };

    const setChatEnabled = (enabled) => {
        dispatch({ type: 'SET_CHAT_ENABLED', payload: enabled });
    };

    const setActiveTriggers = (triggers) => {
        dispatch({ type: 'SET_ACTIVE_TRIGGERS', payload: triggers });
    };

    const value = {
        ...state,
        sendGlobalMessage,
        sendAIMessage,
        clearMessages,
        setUsername,
        setAIMode,
        setCollarActive,
        setChatEnabled,
        setActiveTriggers,
        isConnected
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};