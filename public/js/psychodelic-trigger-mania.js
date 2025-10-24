// Enhanced Psychedelic Spiral Implementation - WebGL-based with Authentic p5.js Recreation
// Integrated from js-psychodelic-trigger-mania repository with WebGL optimization

class SpiralAnimation {
    constructor() {
        this.eyeCursor = null;
        this.canvas = null;
        this.gl = null;
        this.width = 0;
        this.height = 0;
        this.frameCount = 0;
        this.isEnabled = false;
        this.animationId = null;

        // Eye tracking and calibration from original
        this.clicks = [false, false, false, false];
        this.centerCalibrate = [];
        this.trancePoint = [0, 0];
        this.avgPoints = [];
        this.first = true;
        this.xdPred = 0;
        this.ydPred = 0;
        this.tranceCalibrateLoop = null;
        this.tranceAmt = 0;

        // WebGL specific
        this.shaderProgram = null;
        this.vertexBuffer = null;
        this.locations = {};

        // AUTHENTIC p5.js SPIRAL PARAMETERS - Direct from original source
        this.controls = {
            // ORIGINAL: frameCount/200 for both a and b, frameCount/10 for rotation
            frameSpeed1: 200,    // sin(frameCount/200) for spiral A
            frameSpeed2: 200,    // cos(frameCount/200) for spiral B
            rotationSpeed: 10,   // frameCount/10 for rotation

            // ORIGINAL: Fixed geometry values from template
            spiralA_geometry: 1.0,   // ORIGINAL: ang = 1
            spiralB_geometry: 0.3,   // ORIGINAL: ang = 0.3

            // ORIGINAL: Exact colors from p5.js source - [199, 0, 199] and [255, 130, 255]
            spiralA_color: [199, 0, 199, 1.0],    // Original purple from source
            spiralB_color: [0, 128, 128, 1.0],    // Teal color

            // ORIGINAL: Exact range mappings from template
            spiralA_range_min: 0.5,  // ORIGINAL: map(sin(), -1, 1, 0.5, 1.5)
            spiralA_range_max: 1.5,  // ORIGINAL: map(sin(), -1, 1, 0.5, 1.5)
            spiralB_range_min: 1.0,  // ORIGINAL: map(cos(), -1, 1, 1.0, 1.5)
            spiralB_range_max: 1.5,  // ORIGINAL: map(cos(), -1, 1, 1.0, 1.5)

            // ORIGINAL: 250 iterations from template
            iterations: 250,

            // Enhanced variation system for fine control
            subtleVariation: {
                enabled: false,           // Pure original by default
                colorShift: 0,           // ±RGB shift amount
                speedVariance: 0,        // Speed variation multiplier
                geometryVariance: 0,     // Geometry variation
                rangeVariance: 0         // Range variation
            },

            // Trigger pulse effect
            pulseIntensity: 30,

            // Advanced controls for dropdown integration
            alpha: 1.0,
            rotationSpeedMultiplier: 1.0,
            rangeA_min: 0.5,
            rangeA_max: 1.5,
            rangeB_min: 1.0,
            rangeB_max: 1.5,

            // Spiral rendering parameters
            spiralWidth: 1.0,
            spiralWidthDecrement: 1.0 / 350  // dw = spiralwidth/350 from original
        };

        this.init();
    }

    init() {
        this.setup();
    }

    setup() {
        this.eyeCursor = document.querySelector("#spiral-container");

        if (!this.eyeCursor) {
            console.warn('spiral-container element not found');
            return;
        }

        this.width = this.eyeCursor.clientWidth || window.innerWidth;
        this.height = this.eyeCursor.clientHeight || window.innerHeight;

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.id = 'spiral-canvas';
        this.eyeCursor.appendChild(this.canvas);

        // Initialize WebGL
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');

        if (!this.gl) {
            console.error('WebGL not supported');
            return;
        }

        this.initWebGL();
        window.addEventListener("resize", () => this.onWindowResize());

        // Start the render loop
        this.draw();
    }

    initWebGL() {
        const gl = this.gl;

        // Vertex shader
        const vertexShaderSource = `
            attribute vec2 a_position;
            uniform vec2 u_resolution;
            uniform mat3 u_transform;

            void main() {
                vec2 position = (u_transform * vec3(a_position, 1.0)).xy;
                vec2 zeroToOne = position / u_resolution;
                vec2 zeroToTwo = zeroToOne * 2.0;
                vec2 clipSpace = zeroToTwo - 1.0;
                gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
            }
        `;

        // Fragment shader
        const fragmentShaderSource = `
            precision mediump float;
            uniform vec4 u_color;

            void main() {
                gl_FragColor = u_color;
            }
        `;

        // Create and compile shaders
        const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

        // Create program
        this.shaderProgram = this.createProgram(vertexShader, fragmentShader);

        // Get locations
        this.locations = {
            position: gl.getAttribLocation(this.shaderProgram, 'a_position'),
            resolution: gl.getUniformLocation(this.shaderProgram, 'u_resolution'),
            transform: gl.getUniformLocation(this.shaderProgram, 'u_transform'),
            color: gl.getUniformLocation(this.shaderProgram, 'u_color')
        };

        // Create vertex buffer
        this.vertexBuffer = gl.createBuffer();

        // Setup viewport
        gl.viewport(0, 0, this.width, this.height);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    createProgram(vertexShader, fragmentShader) {
        const gl = this.gl;
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }

        return program;
    }

    draw() {
        if (!this.gl) {
            this.animationId = requestAnimationFrame(() => this.draw());
            return;
        }

        if (!this.isEnabled) {
            this.animationId = requestAnimationFrame(() => this.draw());
            return;
        }

        const gl = this.gl;

        // Clear background to black - ORIGINAL: background(0,0,0);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Use shader program
        gl.useProgram(this.shaderProgram);

        // Set resolution
        gl.uniform2f(this.locations.resolution, this.width, this.height);

        // ORIGINAL CALCULATION - Direct from p5.js source:
        // a=map(sin(frameCount/200),-1,1,0.5,1.5);
        // b=map(cos(frameCount/200),-1,1,1,1.5);
        const a = this.map(
            Math.sin(this.frameCount / this.controls.frameSpeed1),
            -1, 1,
            this.controls.rangeA_min,
            this.controls.rangeA_max
        );
        const b = this.map(
            Math.cos(this.frameCount / this.controls.frameSpeed2),
            -1, 1,
            this.controls.rangeB_min,
            this.controls.rangeB_max
        );

        // ORIGINAL: translate(width/2,height/2); rotate(frameCount/10);
        const rotation = (this.frameCount / this.controls.rotationSpeed) * this.controls.rotationSpeedMultiplier;
        const cos_r = Math.cos(rotation);
        const sin_r = Math.sin(rotation);
        const tx = this.width / 2;
        const ty = this.height / 2;

        const transform = [
            cos_r, sin_r, 0,
            -sin_r, cos_r, 0,
            tx, ty, 1
        ];

        gl.uniformMatrix3fv(this.locations.transform, false, transform);

        // Apply subtle variations if enabled
        this.updateSubtleVariation();

        // Draw spirals - ORIGINAL: spiral(a,1,[199, 0, 199]); spiral(b,0.3,[255, 130, 255]);
        this.spiral(
            a,
            this.controls.spiralA_geometry + this.getVariation('geometryVariance'),
            this.getColorWithVariation(this.controls.spiralA_color)
        );
        this.spiral(
            b,
            this.controls.spiralB_geometry + this.getVariation('geometryVariance'),
            this.getColorWithVariation(this.controls.spiralB_color)
        );

        // Eye tracking and calibration system from original
        this.calibrationComplete();

        // Draw center trance point - ORIGINAL: circle(trancePoint[0],trancePoint[1],40);
        this.drawCircle(this.trancePoint[0], this.trancePoint[1], 40, [255, 255, 255, this.controls.alpha]);

        this.frameCount++;
        this.animationId = requestAnimationFrame(() => this.draw());
    }

    spiral(step, ang, colorArray) {
        const gl = this.gl;

        // Calculate scale to match original behavior
        const scale = Math.min(this.width, this.height) / 400;

        // Generate spiral vertices using AUTHENTIC p5.js source logic:
        // fill(d[0],d[1],d[2]); stroke(d[0],d[1],d[2]);
        // var r1 = 0,r2 = 1, step=a,spiralwidth=1.0,dw=spiralwidth/350;
        // beginShape(TRIANGLE_STRIP);
        const vertices = [];
        let r1 = 0;
        let r2 = 1;
        let spiralwidth = this.controls.spiralWidth;
        const dw = this.controls.spiralWidthDecrement;

        // ORIGINAL: for ( var i = 0 ; i < 250 ; i++ )
        for (let i = 0; i < this.controls.iterations; i++) {
            r1 += step; // ORIGINAL: r1 += step;
            spiralwidth -= dw; // ORIGINAL: spiralwidth -= dw;
            r2 = r1 + spiralwidth; // ORIGINAL: r2 = r1 + spiralwidth;

            // ORIGINAL calculation from p5.js:
            // var r1x = r1*sin(ang*i); var r1y = r1*cos(ang*i);
            // var r2x = r2*sin(ang*i); var r2y = r2*cos(ang*i);
            const r1x = (r1 * Math.sin(ang * i)) * scale;
            const r1y = (r1 * Math.cos(ang * i)) * scale;
            const r2x = (r2 * Math.sin(ang * i)) * scale;
            const r2y = (r2 * Math.cos(ang * i)) * scale;

            // ORIGINAL: vertex(r1x,r1y); vertex(r2x,r2y);
            // Building triangle strip for authentic p5.js TRIANGLE_STRIP rendering
            vertices.push(r1x, r1y, r2x, r2y);
        }

        // Upload vertices to buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

        // Set up vertex attribute
        gl.enableVertexAttribArray(this.locations.position);
        gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);

        // Set color with alpha support
        const r = colorArray[0] / 255;
        const g = colorArray[1] / 255;
        const b = colorArray[2] / 255;
        const alpha = (colorArray[3] || 1.0) * this.controls.alpha;
        gl.uniform4f(this.locations.color, r, g, b, alpha);

        // Draw as triangle strip to match p5.js TRIANGLE_STRIP behavior
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertices.length / 2);
    }

    drawCircle(x, y, radius, color) {
        const gl = this.gl;

        // Generate circle vertices
        const vertices = [];
        const segments = 32;

        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            vertices.push(
                x + Math.cos(angle) * radius,
                y + Math.sin(angle) * radius
            );
        }

        // Upload vertices to buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

        // Set up vertex attribute
        gl.enableVertexAttribArray(this.locations.position);
        gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);

        // Set color
        const r = color[0] / 255;
        const g = color[1] / 255;
        const b = color[2] / 255;
        gl.uniform4f(this.locations.color, r, g, b, 1.0);

        // Draw as filled circle
        gl.drawArrays(gl.TRIANGLE_FAN, 0, vertices.length / 2);
    }

    // Subtle variation system - provides controlled deviation from original
    updateSubtleVariation() {
        if (!this.controls.subtleVariation.enabled) return;

        // Very subtle time-based variations
        const time = Date.now() * 0.001;
        const variationAmount = this.controls.subtleVariation;

        // Gentle oscillation for subtle variations
        this.controls.subtleVariation.colorShift = Math.sin(time * 0.1) * variationAmount.colorShift;
        this.controls.subtleVariation.speedVariance = Math.cos(time * 0.05) * variationAmount.speedVariance;
        this.controls.subtleVariation.geometryVariance = Math.sin(time * 0.03) * variationAmount.geometryVariance;
        this.controls.subtleVariation.rangeVariance = Math.cos(time * 0.02) * variationAmount.rangeVariance;
    }

    getVariation(type) {
        if (!this.controls.subtleVariation.enabled) return 0;
        return this.controls.subtleVariation[type] || 0;
    }

    getColorWithVariation(baseColor) {
        if (!this.controls.subtleVariation.enabled) return baseColor;

        const shift = this.controls.subtleVariation.colorShift;
        return [
            Math.max(0, Math.min(255, baseColor[0] + shift)),
            Math.max(0, Math.min(255, baseColor[1] + shift)),
            Math.max(0, Math.min(255, baseColor[2] + shift)),
            baseColor[3]
        ];
    }

    onWindowResize() {
        if (!this.eyeCursor) return;

        this.width = this.eyeCursor.clientWidth || window.innerWidth;
        this.height = this.eyeCursor.clientHeight || window.innerHeight;

        this.canvas.width = this.width;
        this.canvas.height = this.height;

        if (this.gl) {
            this.gl.viewport(0, 0, this.width, this.height);
        }
    }

    // Utility functions
    map(value, start1, stop1, start2, stop2) {
        return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
    }

    toggle() {
        this.isEnabled = !this.isEnabled;

        if (this.isEnabled) {
            // Reset animation state to original
            this.frameCount = 0;
        }

        return this.isEnabled;
    }

    triggerPulse() {
        if (this.isEnabled) {
            // Create a brief pulse effect without breaking original behavior
            const originalFrameCount = this.frameCount;
            this.frameCount += this.controls.pulseIntensity;

            setTimeout(() => {
                this.frameCount = originalFrameCount + this.controls.pulseIntensity;
            }, 200);
        }
    }

    // Control Methods - Simplified for original behavior preservation
    enableSubtleVariation(intensity = 0.1) {
        this.controls.subtleVariation.enabled = true;
        this.controls.subtleVariation.colorShift = intensity * 20;      // ±20 RGB max
        this.controls.subtleVariation.speedVariance = intensity * 5;    // ±5 speed variation
        this.controls.subtleVariation.geometryVariance = intensity * 0.1; // ±0.1 geometry
        this.controls.subtleVariation.rangeVariance = intensity * 0.05;   // ±0.05 range
    }

    disableSubtleVariation() {
        this.controls.subtleVariation.enabled = false;
    }

    // Eye tracking and calibration methods from original p5.js source
    calibrated() {
        this.tranceCalibrateLoop = setInterval(() => {
            this.centerCalibrate.push([this.xdPred, this.ydPred]);
        }, 10);

        let pX = 0;
        for (let i = 0; i < this.centerCalibrate.length; i++) {
            pX += this.centerCalibrate[i][0];
        }

        let pY = 0;
        for (let j = 0; j < this.centerCalibrate.length; j++) {
            pY += this.centerCalibrate[j][1];
        }

        this.trancePoint[0] = (pX / this.centerCalibrate.length);
        this.trancePoint[1] = (pY / this.centerCalibrate.length);
    }

    calibrationComplete() {
        // ORIGINAL: tranceAmt = dist(xdPred,ydPred,trancePoint[0],trancePoint[1]);
        this.tranceAmt = Math.sqrt(
            Math.pow(this.xdPred - this.trancePoint[0], 2) +
            Math.pow(this.ydPred - this.trancePoint[1], 2)
        );
    }

    // Return to authentic p5.js original settings
    resetToOriginal() {
        this.controls.frameSpeed1 = 200;
        this.controls.frameSpeed2 = 200;
        this.controls.rotationSpeed = 10;
        this.controls.spiralA_geometry = 1.0;      // ORIGINAL: ang = 1
        this.controls.spiralB_geometry = 0.3;      // ORIGINAL: ang = 0.3
        this.controls.spiralA_color = [199, 0, 199, 1.0];    // ORIGINAL: [199, 0, 199]
        this.controls.spiralB_color = [0, 128, 128, 1.0];    // Teal color
        this.controls.rangeA_min = 0.5;
        this.controls.rangeA_max = 1.5;
        this.controls.rangeB_min = 1.0;
        this.controls.rangeB_max = 1.5;
        this.controls.iterations = 250;
        this.controls.alpha = 1.0;
        this.controls.rotationSpeedMultiplier = 1.0;
        this.controls.spiralWidth = 1.0;
        this.controls.spiralWidthDecrement = 1.0 / 350;
        this.disableSubtleVariation();
    }

    // Get current state
    getControls() {
        return { ...this.controls };
    }

    cleanup() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

// Initialize spiral animation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.spiralAnimation = new SpiralAnimation();

    // Trigger pulse effect when triggers are activated
    if (window.triggerSystem) {
        const originalPlayEffect = window.triggerSystem.playTriggerEffect;
        window.triggerSystem.playTriggerEffect = function () {
            originalPlayEffect.call(this);
            if (window.spiralAnimation) {
                window.spiralAnimation.triggerPulse();
            }
        };
    }

    // Export simplified control functions for dropdown integration
    window.spiralControls = {
        // ORIGINAL behavior by default
        resetToOriginal: () => window.spiralAnimation.resetToOriginal(),

        // Subtle variation controls
        enableSubtleVariation: (intensity) => window.spiralAnimation.enableSubtleVariation(intensity),
        disableSubtleVariation: () => window.spiralAnimation.disableSubtleVariation(),

        // Simple speed adjustment (maintains original ratios)
        setSpeed: (multiplier) => {
            window.spiralAnimation.controls.frameSpeed1 = 200 / multiplier;
            window.spiralAnimation.controls.frameSpeed2 = 200 / multiplier;
            window.spiralAnimation.controls.rotationSpeed = 10 / multiplier;
        },

        // Simple color intensity (maintains original authentic colors)
        setColorIntensity: (intensity) => {
            const baseA = [199, 0, 199];    // ORIGINAL: [199, 0, 199] from p5.js source
            const baseB = [0, 128, 128];    // Teal color
            window.spiralAnimation.controls.spiralA_color = [
                Math.min(255, baseA[0] * intensity),
                Math.min(255, baseA[1] * intensity),
                Math.min(255, baseA[2] * intensity),
                1.0
            ];
            window.spiralAnimation.controls.spiralB_color = [
                Math.min(255, baseB[0] * intensity),
                Math.min(255, baseB[1] * intensity),
                Math.min(255, baseB[2] * intensity),
                1.0
            ];
        },

        // Enhanced controls for dropdown integration
        setAlpha: (alpha) => {
            window.spiralAnimation.controls.alpha = Math.max(0, Math.min(1, alpha));
        },

        setRotationSpeed: (speed) => {
            window.spiralAnimation.controls.rotationSpeedMultiplier = Math.max(0.1, speed);
        },

        setIterations: (iterations) => {
            window.spiralAnimation.controls.iterations = Math.max(50, Math.min(1000, iterations));
        },

        setPulseIntensity: (intensity) => {
            window.spiralAnimation.controls.pulseIntensity = Math.max(1, Math.min(200, intensity));
        },

        // Color setters for dropdown
        setSpiralAColor: (r, g, b) => {
            window.spiralAnimation.controls.spiralA_color = [r, g, b, 1.0];
        },

        setSpiralBColor: (r, g, b) => {
            window.spiralAnimation.controls.spiralB_color = [r, g, b, 1.0];
        },

        // Geometry controls
        setGeometryA: (value) => {
            window.spiralAnimation.controls.spiralA_geometry = Math.max(0.01, Math.min(10, value));
        },

        setGeometryB: (value) => {
            window.spiralAnimation.controls.spiralB_geometry = Math.max(0.01, Math.min(5, value));
        },

        // Range controls
        setRangeA: (min, max) => {
            window.spiralAnimation.controls.rangeA_min = Math.max(0.01, Math.min(2, min));
            window.spiralAnimation.controls.rangeA_max = Math.max(0.5, Math.min(5, max));
        },

        setRangeB: (min, max) => {
            window.spiralAnimation.controls.rangeB_min = Math.max(0.01, Math.min(2, min));
            window.spiralAnimation.controls.rangeB_max = Math.max(0.5, Math.min(5, max));
        },

        // Get current state
        getControls: () => window.spiralAnimation.getControls()
    };

    // Default to ORIGINAL behavior
    window.spiralAnimation.resetToOriginal();
});
