import React from 'react';
import ChatInterface from './ChatInterface';
import DropdownSystem from './DropdownSystem';
import VisualEffects from './VisualEffects';
import ConnectionStatus from './ConnectionStatus';

const MainLayout = () => {
    return (
        <div id="app" className="main-layout">
            {/* Visual effects layer (background) */}
            <VisualEffects />

            {/* Main interface */}
            <div className="interface-layer">
                <ConnectionStatus />
                <DropdownSystem />
                <ChatInterface />
            </div>
        </div>
    );
};

export default MainLayout;