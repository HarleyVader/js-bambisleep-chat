import React from 'react';
import { useSocket } from '../context/SocketContext';

const ConnectionStatus = () => {
    const { isConnected, connectionError } = useSocket();

    if (isConnected) {
        return (
            <div className="connection-status connected">
                <span className="status-indicator status-active">●</span>
                <span>Connected</span>
            </div>
        );
    }

    return (
        <div className="connection-status disconnected">
            <span className="status-indicator status-inactive">●</span>
            <span>
                {connectionError ? `Connection Error: ${connectionError}` : 'Connecting...'}
            </span>
        </div>
    );
};

export default ConnectionStatus;