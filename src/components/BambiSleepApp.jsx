// Main React application component
// Implements hypnotic UI experience with level-gated features
// Integrates ElevenLabs conversation API and Socket.io

import React, { useState, useEffect } from 'react';
import { useConversation } from '@elevenlabs/react';
import { io } from 'socket.io-client';

// Component imports
import TriggerSystem from './triggers/TriggerSystem';
import SpiralVisualization from './spirals/SpiralVisualization';
import AudioControls from './audio/AudioControls';
import SessionManager from './session/SessionManager';

const BambiSleepApp = () => {
    const [sessionActive, setSessionActive] = useState(false);
    const [currentTrigger, setCurrentTrigger] = useState(null);
    const [spiralActive, setSpiralActive] = useState(false);
    const [socket, setSocket] = useState(null);

    // ElevenLabs conversation setup
    const conversation = useConversation({
        clientTools: {
            activateTrigger: async (params) => {
                setCurrentTrigger(params.trigger);
                socket?.emit('trigger_activated', params.trigger);
                return `Activated ${params.trigger}`;
            },
            startSpiral: async (params) => {
                setSpiralActive(true);
                socket?.emit('spiral_started', params);
                return `Started spiral with speed ${params.speed}`;
            },
            endSession: async () => {
                setSessionActive(false);
                socket?.emit('session_ended');
                return 'Session ended safely';
            }
        },
        overrides: {
            agent: {
                prompt: {
                    prompt: `You are Bambi, a hypnotic AI assistant specialized in guided relaxation and trance induction.
                   You use the principles from the Hypnosis as Programming Language framework to create safe,
                   consensual hypnotic experiences. Always prioritize user safety and consent.`
                }
            }
        },
        textOnly: false
    });

    // Socket.io setup
    useEffect(() => {
        const newSocket = io();
        setSocket(newSocket);

        newSocket.on('trigger_activated', (trigger) => {
            setCurrentTrigger(trigger);
        });

        newSocket.on('spiral_started', () => {
            setSpiralActive(true);
        });

        return () => newSocket.disconnect();
    }, []);

    return (
        <div className="bambi-sleep-app">
            <SessionManager
                sessionActive={sessionActive}
                onSessionStart={() => setSessionActive(true)}
                onSessionEnd={() => setSessionActive(false)}
            />

            {sessionActive && (
                <>
                    <TriggerSystem
                        currentTrigger={currentTrigger}
                        onTriggerChange={setCurrentTrigger}
                    />

                    <SpiralVisualization
                        active={spiralActive}
                        onToggle={setSpiralActive}
                    />

                    <AudioControls conversation={conversation} />
                </>
            )}
        </div>
    );
};

export default BambiSleepApp;
