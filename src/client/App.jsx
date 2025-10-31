import React from 'react';
import { SocketProvider } from './context/SocketContext';
import { ChatProvider } from './context/ChatContext';
import MainLayout from './components/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
    return (
        <ErrorBoundary>
            <SocketProvider>
                <ChatProvider>
                    <MainLayout />
                </ChatProvider>
            </SocketProvider>
        </ErrorBoundary>
    );
}

export default App;