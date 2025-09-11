// Main application entry point
// Renders the BambiSleepApp React component

import React from 'react';
import ReactDOM from 'react-dom/client';
import BambiSleepApp from './components/BambiSleepApp';
import './public/css/style.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <BambiSleepApp />
    </React.StrictMode>
);
