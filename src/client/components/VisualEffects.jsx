import React, { useRef, useEffect, useState } from 'react';

const VisualEffects = () => {
    const [spiralEnabled, setSpiralEnabled] = useState(false);
    const [brainwaveEnabled, setBrainwaveEnabled] = useState(false);
    const spiralCanvasRef = useRef(null);
    const brainwaveCanvasRef = useRef(null);
    const spiralAnimationRef = useRef(null);
    const brainwaveAnimationRef = useRef(null);

    // Listen for component state changes from other parts of the app
    useEffect(() => {
        const handleSpiralToggle = (event) => {
            setSpiralEnabled(event.detail.enabled);
        };

        const handleBrainwaveToggle = (event) => {
            setBrainwaveEnabled(event.detail.enabled);
        };

        document.addEventListener('spiral-toggle', handleSpiralToggle);
        document.addEventListener('brainwave-toggle', handleBrainwaveToggle);

        return () => {
            document.removeEventListener('spiral-toggle', handleSpiralToggle);
            document.removeEventListener('brainwave-toggle', handleBrainwaveToggle);
        };
    }, []);

    useEffect(() => {
        if (spiralEnabled) {
            startSpiralAnimation();
        } else {
            stopSpiralAnimation();
        }

        return () => stopSpiralAnimation();
    }, [spiralEnabled]);

    useEffect(() => {
        if (brainwaveEnabled) {
            startBrainwaveVisualization();
        } else {
            stopBrainwaveVisualization();
        }

        return () => stopBrainwaveVisualization();
    }, [brainwaveEnabled]);

    const startSpiralAnimation = () => {
        const canvas = spiralCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        let angle = 0;

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Main spiral
            ctx.strokeStyle = '#ff69b4';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff69b4';

            ctx.beginPath();
            for (let i = 0; i < 360 * 6; i++) {
                const radius = i * 0.8;
                const x = centerX + Math.cos((i + angle) * Math.PI / 180) * radius;
                const y = centerY + Math.sin((i + angle) * Math.PI / 180) * radius;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();

            angle += 2;
            spiralAnimationRef.current = requestAnimationFrame(animate);
        };

        animate();
    };

    const stopSpiralAnimation = () => {
        if (spiralAnimationRef.current) {
            cancelAnimationFrame(spiralAnimationRef.current);
            spiralAnimationRef.current = null;
        }
    };

    const startBrainwaveVisualization = () => {
        const canvas = brainwaveCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        let time = 0;

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Brainwave visualization
            ctx.strokeStyle = 'rgba(138, 43, 226, 0.3)';
            ctx.lineWidth = 2;

            for (let wave = 0; wave < 5; wave++) {
                ctx.beginPath();
                for (let x = 0; x < canvas.width; x += 5) {
                    const frequency = 0.01 + wave * 0.002;
                    const amplitude = 50 + wave * 20;
                    const y = canvas.height / 2 +
                        Math.sin((x * frequency) + (time * 0.05) + (wave * 0.5)) * amplitude;

                    if (x === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();
            }

            time++;
            brainwaveAnimationRef.current = requestAnimationFrame(animate);
        };

        animate();
    };

    const stopBrainwaveVisualization = () => {
        if (brainwaveAnimationRef.current) {
            cancelAnimationFrame(brainwaveAnimationRef.current);
            brainwaveAnimationRef.current = null;
        }
    };

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            if (spiralCanvasRef.current) {
                spiralCanvasRef.current.width = window.innerWidth;
                spiralCanvasRef.current.height = window.innerHeight;
            }
            if (brainwaveCanvasRef.current) {
                brainwaveCanvasRef.current.width = window.innerWidth;
                brainwaveCanvasRef.current.height = window.innerHeight;
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div id="visual-effects" className="visual-effects-container">
            {/* Spiral Canvas */}
            <canvas
                ref={spiralCanvasRef}
                className={`spiral-canvas ${spiralEnabled ? 'active' : ''}`}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: -1,
                    opacity: spiralEnabled ? 0.8 : 0,
                    transition: 'opacity 0.5s ease'
                }}
            />

            {/* Brainwave Canvas */}
            <canvas
                ref={brainwaveCanvasRef}
                className={`brainwave-canvas ${brainwaveEnabled ? 'active' : ''}`}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: -2,
                    opacity: brainwaveEnabled ? 0.6 : 0,
                    transition: 'opacity 0.5s ease'
                }}
            />

            {/* Psychedelic Background */}
            <div
                className="psychedelic-background"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(circle at center, rgba(255,105,180,0.1) 0%, rgba(138,43,226,0.05) 50%, rgba(75,0,130,0.02) 100%)',
                    pointerEvents: 'none',
                    zIndex: -3
                }}
            />
        </div>
    );
};

export default VisualEffects;