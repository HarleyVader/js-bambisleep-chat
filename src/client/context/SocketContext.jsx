import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState(null);

    useEffect(() => {
        // Initialize socket connection
        const newSocket = io({
            transports: ['websocket', 'polling'],
            upgrade: true,
            rememberUpgrade: true
        });

        // Connection event handlers
        newSocket.on('connect', () => {
            console.log('🔌 Socket connected:', newSocket.id);
            setIsConnected(true);
            setConnectionError(null);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('🔌 Socket disconnected:', reason);
            setIsConnected(false);
        });

        newSocket.on('connect_error', (error) => {
            console.error('🔌 Socket connection error:', error);
            setConnectionError(error.message);
            setIsConnected(false);
        });

        setSocket(newSocket);

        // Cleanup on unmount
        return () => {
            newSocket.close();
        };
    }, []);

    const emit = (event, data) => {
        if (socket && isConnected) {
            socket.emit(event, data);
        } else {
            console.warn('Socket not connected, cannot emit:', event);
        }
    };

    const on = (event, callback) => {
        if (socket) {
            socket.on(event, callback);
        }
    };

    const off = (event, callback) => {
        if (socket) {
            socket.off(event, callback);
        }
    };

    const value = {
        socket,
        isConnected,
        connectionError,
        emit,
        on,
        off
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};