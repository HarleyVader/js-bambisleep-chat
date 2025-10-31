import React, { useState, useRef, useEffect } from 'react';

const SpiralDropdown = ({ isOpen, onToggle }) => {
    const [isEnabled, setIsEnabled] = useState(false);
    const [speed, setSpeed] = useState(5);
    const [intensity, setIntensity] = useState(0.7);
    const [pattern, setPattern] = useState('classic');
    const [colors, setColors] = useState('pink');
    const canvasRef = useRef(null);
    const animationRef = useRef(null);

    const patterns = {
        'classic': 'Classic Spiral',
        'double': 'Double Spiral',
        'triple': 'Triple Spiral',
        'hypno': 'Hypnotic Waves',
        'pulsing': 'Pulsing Circle'
    };

    const colorSchemes = {
        'pink': ['#ff69b4', '#ff1493', '#c71585'],
        'purple': ['#9370db', '#8a2be2', '#4b0082'],
        'blue': ['#00bfff', '#1e90ff', '#0000ff'],
        'rainbow': ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'],
        'white': ['#ffffff', '#f0f0f0', '#e0e0e0']
    };

    useEffect(() => {
        if (isEnabled && canvasRef.current) {
            startSpiral();
        } else {
            stopSpiral();
        }

        return () => stopSpiral();
    }, [isEnabled, speed, intensity, pattern, colors]);

    const startSpiral = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        let angle = 0;

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const colorPalette = colorSchemes[colors];
            const currentColor = colorPalette[Math.floor(angle / 10) % colorPalette.length];

            ctx.strokeStyle = currentColor;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = currentColor;

            switch (pattern) {
                case 'classic':
                    drawClassicSpiral(ctx, centerX, centerY, angle);
                    break;
                case 'double':
                    drawDoubleSpiral(ctx, centerX, centerY, angle);
                    break;
                case 'triple':
                    drawTripleSpiral(ctx, centerX, centerY, angle);
                    break;
                case 'hypno':
                    drawHypnoWaves(ctx, centerX, centerY, angle);
                    break;
                case 'pulsing':
                    drawPulsingCircle(ctx, centerX, centerY, angle);
                    break;
            }

            angle += speed * 0.1;
            animationRef.current = requestAnimationFrame(animate);
        };

        animate();
    };

    const stopSpiral = () => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
    };

    const drawClassicSpiral = (ctx, centerX, centerY, angle) => {
        ctx.beginPath();
        for (let i = 0; i < 360 * 4; i++) {
            const radius = i * intensity * 0.5;
            const x = centerX + Math.cos((i + angle) * Math.PI / 180) * radius;
            const y = centerY + Math.sin((i + angle) * Math.PI / 180) * radius;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    };

    const drawDoubleSpiral = (ctx, centerX, centerY, angle) => {
        for (let spiral = 0; spiral < 2; spiral++) {
            ctx.beginPath();
            for (let i = 0; i < 360 * 3; i++) {
                const radius = i * intensity * 0.4;
                const spiralAngle = spiral * 180;
                const x = centerX + Math.cos((i + angle + spiralAngle) * Math.PI / 180) * radius;
                const y = centerY + Math.sin((i + angle + spiralAngle) * Math.PI / 180) * radius;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }
    };

    const drawTripleSpiral = (ctx, centerX, centerY, angle) => {
        for (let spiral = 0; spiral < 3; spiral++) {
            ctx.beginPath();
            for (let i = 0; i < 360 * 2; i++) {
                const radius = i * intensity * 0.3;
                const spiralAngle = spiral * 120;
                const x = centerX + Math.cos((i + angle + spiralAngle) * Math.PI / 180) * radius;
                const y = centerY + Math.sin((i + angle + spiralAngle) * Math.PI / 180) * radius;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }
    };

    const drawHypnoWaves = (ctx, centerX, centerY, angle) => {
        for (let wave = 0; wave < 8; wave++) {
            const radius = 50 + wave * 30 * intensity;
            ctx.beginPath();
            ctx.arc(
                centerX + Math.sin(angle * 0.05 + wave) * 20,
                centerY + Math.cos(angle * 0.05 + wave) * 20,
                radius + Math.sin(angle * 0.1 + wave * 0.5) * 10,
                0,
                2 * Math.PI
            );
            ctx.stroke();
        }
    };

    const drawPulsingCircle = (ctx, centerX, centerY, angle) => {
        const baseRadius = 100;
        const pulseRadius = baseRadius + Math.sin(angle * 0.1) * 50 * intensity;

        for (let i = 0; i < 5; i++) {
            const radius = pulseRadius - i * 20;
            if (radius > 0) {
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                ctx.globalAlpha = 1 - (i * 0.2);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    };

    const handleToggle = () => {
        setIsEnabled(!isEnabled);
    };

    return (
        <div className="dropdown-container">
            <button
                className={`dropdown-btn toggle-button ${isEnabled ? 'active' : ''}`}
                data-state={isEnabled ? 'on' : 'off'}
                onClick={onToggle}
            >
                <span className="status-indicator">
                    <span className={isEnabled ? 'status-active' : 'status-inactive'}>●</span>
                </span>
                🌀 Spiral
            </button>

            {isOpen && (
                <div className="dropdown-content">
                    <div className="dropdown-header">
                        <h3>Spiral Animation</h3>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={handleToggle}
                            />
                            <span className="slider"></span>
                            <span className="label">Enable Spiral</span>
                        </label>
                    </div>

                    {isEnabled && (
                        <>
                            <div className="spiral-preview">
                                <canvas
                                    ref={canvasRef}
                                    width={200}
                                    height={200}
                                    className="spiral-canvas"
                                />
                            </div>

                            <div className="spiral-controls">
                                <div className="control-group">
                                    <label>Pattern:</label>
                                    <select
                                        value={pattern}
                                        onChange={(e) => setPattern(e.target.value)}
                                        className="pattern-select"
                                    >
                                        {Object.entries(patterns).map(([key, name]) => (
                                            <option key={key} value={key}>{name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="control-group">
                                    <label>Colors:</label>
                                    <select
                                        value={colors}
                                        onChange={(e) => setColors(e.target.value)}
                                        className="colors-select"
                                    >
                                        <option value="pink">Pink</option>
                                        <option value="purple">Purple</option>
                                        <option value="blue">Blue</option>
                                        <option value="rainbow">Rainbow</option>
                                        <option value="white">White</option>
                                    </select>
                                </div>

                                <div className="control-group">
                                    <label htmlFor="speed">Speed: {speed}</label>
                                    <input
                                        type="range"
                                        id="speed"
                                        min="1"
                                        max="20"
                                        value={speed}
                                        onChange={(e) => setSpeed(parseInt(e.target.value))}
                                        className="speed-slider"
                                    />
                                </div>

                                <div className="control-group">
                                    <label htmlFor="intensity">Intensity: {Math.round(intensity * 100)}%</label>
                                    <input
                                        type="range"
                                        id="intensity"
                                        min="0.1"
                                        max="2"
                                        step="0.1"
                                        value={intensity}
                                        onChange={(e) => setIntensity(parseFloat(e.target.value))}
                                        className="intensity-slider"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default SpiralDropdown;