// Rebuilt Psychedelic Spiral Implementation - WebGL Version
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
        this.trancePoint = [0, 0];

        // WebGL specific
        this.shaderProgram = null;
        this.vertexBuffer = null;
        this.locations = {};

        // Psychedelic Control Parameters (Template-based defaults)
        this.controls = {
            // Animation Speed Controls (Template uses frameCount/20 and frameCount/10)
            frameSpeed1: 20,    // frameCount divisor for spiral A
            frameSpeed2: 20,    // frameCount divisor for spiral B  
            rotationSpeed: 10,  // rotation divisor (template uses frameCount/10)

            // Spiral Geometry Controls (Template values: a,1 and b,0.3)
            spiralA_geometry: 1.0,
            spiralB_geometry: 0.3,

            // Color Controls (Template colors)
            spiralA_color: [199, 0, 199, 1.0],
            spiralB_color: [255, 130, 255, 1.0],

            // Range Controls (Template ranges: 0.5,1.5 and 1,1.5)
            spiralA_range_min: 0.5,
            spiralA_range_max: 1.5,
            spiralB_range_min: 1.0,
            spiralB_range_max: 1.5,

            // Visual Effects
            iterations: 150,
            pulseIntensity: 150,

            // Randomizer Settings
            randomizer: {
                enabled: true,
                interval: 30000, // 30 seconds
                lastChange: 0
            }
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

        // Clear background to black
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Use shader program
        gl.useProgram(this.shaderProgram);

        // Set resolution
        gl.uniform2f(this.locations.resolution, this.width, this.height);

        // Calculate animation parameters using TEMPLATE method
        const a = this.map(Math.sin(this.frameCount / this.controls.frameSpeed1), -1, 1, this.controls.spiralA_range_min, this.controls.spiralA_range_max);
        const b = this.map(Math.cos(this.frameCount / this.controls.frameSpeed2), -1, 1, this.controls.spiralB_range_min, this.controls.spiralB_range_max);

        // Set transform matrix for rotation and translation
        const rotation = this.frameCount / this.controls.rotationSpeed;
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

        // Check randomizer
        this.updateRandomizer();

        // Draw spirals using TEMPLATE approach (step, geometry, color)
        this.spiral(a, this.controls.spiralA_geometry, this.controls.spiralA_color);
        this.spiral(b, this.controls.spiralB_geometry, this.controls.spiralB_color);

        // Calibration complete placeholder
        this.calibrationComplete();

        // Draw trance point circle
        this.drawCircle(this.trancePoint[0], this.trancePoint[1], 40, [255, 255, 255]);

        this.frameCount++;
        this.animationId = requestAnimationFrame(() => this.draw());
    }

    spiral(step, ang, colorArray) {
        const gl = this.gl;

        // Generate spiral vertices using template calculation method
        const vertices = [];
        let r1 = 0;

        for (let i = 0; i < this.controls.iterations; i++) {
            r1 += step; // Simple step increment like template
            
            // Calculate spiral position using template formula
            const r1x = r1 * Math.sin(ang * i);
            const r1y = r1 * Math.cos(ang * i);

            vertices.push(r1x, r1y);
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
        const alpha = colorArray[3] || 1.0;
        gl.uniform4f(this.locations.color, r, g, b, alpha);

        // Draw as line strip like original template approach
        gl.drawArrays(gl.LINE_STRIP, 0, vertices.length / 2);
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

        // Draw as line loop for circle outline
        gl.drawArrays(gl.LINE_LOOP, 0, vertices.length / 2);
    }

    calibrationComplete() {
        // Placeholder for calibration logic
        // This can be expanded as needed
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
            // Reset animation state
            this.frameCount = 0;
        }

        return this.isEnabled;
    }

    triggerPulse() {
        if (this.isEnabled) {
            // Create a brief visual pulse effect
            const originalFrameCount = this.frameCount;
            this.frameCount += this.controls.pulseIntensity;

            setTimeout(() => {
                this.frameCount = originalFrameCount;
            }, 500);
        }
    }

    // Control Methods for Psychedelic Trigger Mania
    updateControl(category, property, value) {
        if (this.controls[category] && this.controls[category][property] !== undefined) {
            this.controls[category][property] = value;
        } else if (this.controls[property] !== undefined) {
            this.controls[property] = value;
        }

        // Dispatch control change event
        document.dispatchEvent(new CustomEvent('spiralControlChange', {
            detail: { category, property, value }
        }));
    }

    // Color Control Methods
    setSpiralAColor(r, g, b, a = 1.0) {
        this.controls.spiralA_color = [r, g, b, a];
    }

    setSpiralBColor(r, g, b, a = 1.0) {
        this.controls.spiralB_color = [r, g, b, a];
    }

    // Speed Control Methods
    setFrameSpeed(spiral, speed) {
        if (spiral === 'A') {
            this.controls.frameSpeed1 = speed;
        } else if (spiral === 'B') {
            this.controls.frameSpeed2 = speed;
        }
    }

    setRotationSpeed(speed) {
        this.controls.rotationSpeed = speed;
    }

    // Geometry Control Methods
    setSpiralGeometry(spiral, geometry) {
        if (spiral === 'A') {
            this.controls.spiralA_geometry = geometry;
        } else if (spiral === 'B') {
            this.controls.spiralB_geometry = geometry;
        }
    }

    // Range Control Methods
    setSpiralRange(spiral, min, max) {
        if (spiral === 'A') {
            this.controls.spiralA_range_min = min;
            this.controls.spiralA_range_max = max;
        } else if (spiral === 'B') {
            this.controls.spiralB_range_min = min;
            this.controls.spiralB_range_max = max;
        }
    }

    // Randomizer Methods
    enableRandomizer(interval = 5000) {
        this.controls.randomizer.enabled = true;
        this.controls.randomizer.interval = interval;
        this.controls.randomizer.lastChange = Date.now();
    }

    disableRandomizer() {
        this.controls.randomizer.enabled = false;
    }

    updateRandomizer() {
        if (!this.controls.randomizer.enabled) return;

        const now = Date.now();
        if (now - this.controls.randomizer.lastChange > this.controls.randomizer.interval) {
            this.randomizeParameters();
            this.controls.randomizer.lastChange = now;
        }
    }

    randomizeParameters() {
        // Randomize colors
        this.controls.spiralA_color = [
            Math.floor(Math.random() * 256),
            Math.floor(Math.random() * 256),
            Math.floor(Math.random() * 256),
            0.7 + Math.random() * 0.3 // Alpha between 0.7-1.0
        ];

        this.controls.spiralB_color = [
            Math.floor(Math.random() * 256),
            Math.floor(Math.random() * 256),
            Math.floor(Math.random() * 256),
            0.7 + Math.random() * 0.3
        ];

        // Randomize speeds
        this.controls.frameSpeed1 = 10 + Math.random() * 30; // 10-40
        this.controls.frameSpeed2 = 10 + Math.random() * 30;
        this.controls.rotationSpeed = 5 + Math.random() * 15; // 5-20

        // Randomize geometry
        this.controls.spiralA_geometry = 0.5 + Math.random() * 8; // 0.5-8.5
        this.controls.spiralB_geometry = 0.5 + Math.random() * 8;

        // Randomize ranges
        this.controls.spiralA_range_min = Math.random() * 2; // 0-2
        this.controls.spiralA_range_max = 1 + Math.random() * 3; // 1-4
        this.controls.spiralB_range_min = Math.random() * 2;
        this.controls.spiralB_range_max = 1 + Math.random() * 3;

        // Dispatch randomization event
        document.dispatchEvent(new CustomEvent('spiralRandomized', {
            detail: { controls: this.controls }
        }));
    }

    // Preset Methods
    loadPreset(presetName) {
        const presets = {
            'hypnotic': {
                frameSpeed1: 25, frameSpeed2: 30, rotationSpeed: 8,
                spiralA_geometry: 3.2, spiralB_geometry: 1.8,
                spiralA_color: [148, 0, 211, 0.9], spiralB_color: [75, 0, 130, 0.8],
                spiralA_range_min: 0.3, spiralA_range_max: 1.2,
                spiralB_range_min: 0.8, spiralB_range_max: 1.8
            },
            'intense': {
                frameSpeed1: 8, frameSpeed2: 12, rotationSpeed: 4,
                spiralA_geometry: 6.5, spiralB_geometry: 2.1,
                spiralA_color: [255, 20, 147, 1.0], spiralB_color: [255, 69, 0, 0.95],
                spiralA_range_min: 0.8, spiralA_range_max: 2.5,
                spiralB_range_min: 1.2, spiralB_range_max: 2.8
            },
            'peaceful': {
                frameSpeed1: 40, frameSpeed2: 35, rotationSpeed: 15,
                spiralA_geometry: 2.1, spiralB_geometry: 0.7,
                spiralA_color: [135, 206, 235, 0.7], spiralB_color: [176, 196, 222, 0.8],
                spiralA_range_min: 0.2, spiralA_range_max: 0.8,
                spiralB_range_min: 0.5, spiralB_range_max: 1.2
            },
            'chaos': {
                frameSpeed1: 3, frameSpeed2: 7, rotationSpeed: 2,
                spiralA_geometry: 9.2, spiralB_geometry: 4.8,
                spiralA_color: [255, 0, 0, 1.0], spiralB_color: [0, 255, 0, 1.0],
                spiralA_range_min: 1.5, spiralA_range_max: 3.5,
                spiralB_range_min: 2.0, spiralB_range_max: 4.0
            }
        };

        if (presets[presetName]) {
            Object.assign(this.controls, presets[presetName]);

            // Dispatch preset loaded event
            document.dispatchEvent(new CustomEvent('spiralPresetLoaded', {
                detail: { preset: presetName, controls: this.controls }
            }));
        }
    }

    // Get current state for UI updates
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

    // Export control functions globally for dropdown integration
    window.spiralControls = {
        // Speed Controls
        setSpeed: (speed) => {
            window.spiralAnimation.controls.frameSpeed1 = 20 / speed;
            window.spiralAnimation.controls.frameSpeed2 = 20 / speed;
            window.spiralAnimation.controls.rotationSpeed = 50 / speed;
        },

        // Color Scheme Controls  
        setColorScheme: (scheme) => {
            const schemes = {
                'pink': {
                    spiralA_color: [255, 20, 147, 0.9],
                    spiralB_color: [255, 105, 180, 0.8]
                },
                'purple': {
                    spiralA_color: [148, 0, 211, 0.9],
                    spiralB_color: [138, 43, 226, 0.8]
                },
                'blue': {
                    spiralA_color: [0, 100, 255, 0.9],
                    spiralB_color: [30, 144, 255, 0.8]
                },
                'rainbow': {
                    spiralA_color: [255, 0, 0, 0.9],
                    spiralB_color: [0, 255, 0, 0.8]
                }
            };
            if (schemes[scheme]) {
                Object.assign(window.spiralAnimation.controls, schemes[scheme]);
            }
        },

        // Geometry Controls
        setGeometry: (type) => {
            const geometries = {
                'tight': { spiralA_geometry: 8.0, spiralB_geometry: 2.5 },
                'normal': { spiralA_geometry: 5.7, spiralB_geometry: 0.6 },
                'wide': { spiralA_geometry: 2.0, spiralB_geometry: 0.3 }
            };
            if (geometries[type]) {
                Object.assign(window.spiralAnimation.controls, geometries[type]);
            }
        },

        // Alpha/Transparency Controls
        setAlpha: (alpha) => {
            window.spiralAnimation.controls.spiralA_color[3] = alpha;
            window.spiralAnimation.controls.spiralB_color[3] = alpha;
        },

        // Randomizer Controls
        enableRandomizer: (enabled) => {
            window.spiralAnimation.controls.randomizer.enabled = enabled;
        },

        // Preset Controls
        loadPreset: (preset) => window.spiralAnimation.loadPreset(preset),

        // Color Randomizer
        randomizeColors: () => window.spiralAnimation.randomizeParameters(),

        // Brainwash Mode
        activateBrainwashMode: () => {
            // Ultra intense settings
            window.spiralAnimation.controls.frameSpeed1 = 5;
            window.spiralAnimation.controls.frameSpeed2 = 7;
            window.spiralAnimation.controls.rotationSpeed = 3;
            window.spiralAnimation.controls.spiralA_color = [255, 0, 255, 1.0];
            window.spiralAnimation.controls.spiralB_color = [255, 255, 0, 1.0];
            window.spiralAnimation.controls.randomizer.enabled = true;
            window.spiralAnimation.controls.randomizer.interval = 2000; // 2 seconds
        },

        // Legacy methods for compatibility
        setSpiralAColor: (r, g, b, a) => window.spiralAnimation.setSpiralAColor(r, g, b, a),
        setSpiralBColor: (r, g, b, a) => window.spiralAnimation.setSpiralBColor(r, g, b, a),
        setFrameSpeed: (spiral, speed) => window.spiralAnimation.setFrameSpeed(spiral, speed),
        setRotationSpeed: (speed) => window.spiralAnimation.setRotationSpeed(speed),
        setSpiralGeometry: (spiral, geometry) => window.spiralAnimation.setSpiralGeometry(spiral, geometry),
        setSpiralRange: (spiral, min, max) => window.spiralAnimation.setSpiralRange(spiral, min, max),
        disableRandomizer: () => window.spiralAnimation.disableRandomizer(),
        randomizeParameters: () => window.spiralAnimation.randomizeParameters(),
        getControls: () => window.spiralAnimation.getControls()
    };
});
