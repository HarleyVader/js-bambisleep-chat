// ORIGINAL Psychedelic Spiral Implementation - Restored with Controlled Variability
// Based on the original p5.js template with minimal, subtle variations

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

        // ORIGINAL SPIRAL PARAMETERS - Exact replication of template behavior
        this.controls = {
            // ORIGINAL: frameCount/200 for both a and b, frameCount/10 for rotation
            frameSpeed1: 200,    // sin(frameCount/200) for spiral A
            frameSpeed2: 200,    // cos(frameCount/200) for spiral B
            rotationSpeed: 10,   // frameCount/10 for rotation

            // ORIGINAL: Fixed geometry values from template
            spiralA_geometry: 1.0,   // ORIGINAL: 1
            spiralB_geometry: 0.3,   // ORIGINAL: 0.3

            // ORIGINAL: Exact colors from template - Updated to match dropdown defaults
            spiralA_color: [223, 4, 113, 1.0],    // #df0471 - Hot pink (dropdown default)
            spiralB_color: [0, 255, 255, 1.0],    // #00ffff - Cyan (dropdown default)

            // ORIGINAL: Exact range mappings from template
            spiralA_range_min: 0.5,  // ORIGINAL: map(sin(), -1, 1, 0.5, 1.5)
            spiralA_range_max: 1.5,  // ORIGINAL: map(sin(), -1, 1, 0.5, 1.5)
            spiralB_range_min: 1.0,  // ORIGINAL: map(cos(), -1, 1, 1.0, 1.5)
            spiralB_range_max: 1.5,  // ORIGINAL: map(cos(), -1, 1, 1.0, 1.5)

            // ORIGINAL: 250 iterations from template
            iterations: 250,

            // Subtle variation system - DISABLED by default for pure original behavior
            subtleVariation: {
                enabled: false,           // Pure original by default
                colorShift: 0,           // ±RGB shift amount
                speedVariance: 0,        // Speed variation multiplier
                geometryVariance: 0,     // Geometry variation
                rangeVariance: 0         // Range variation
            },

            // Trigger pulse effect
            pulseIntensity: 30,

            // Randomizer DISABLED - keeping original behavior
            randomizer: {
                enabled: false,
                interval: 300000,
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

        // Clear background to black - ORIGINAL behavior
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Use shader program
        gl.useProgram(this.shaderProgram);

        // Set resolution
        gl.uniform2f(this.locations.resolution, this.width, this.height);

        // ORIGINAL CALCULATION - Exact replication of template:
        // a=map(sin(frameCount/200),-1,1,0.5,1.5);
        // b=map(cos(frameCount/200),-1,1,1,1.5);
        const a = this.map(
            Math.sin(this.frameCount / this.controls.frameSpeed1),
            -1, 1,
            this.controls.spiralA_range_min + this.getVariation('rangeVariance'),
            this.controls.spiralA_range_max + this.getVariation('rangeVariance')
        );
        const b = this.map(
            Math.cos(this.frameCount / this.controls.frameSpeed2),
            -1, 1,
            this.controls.spiralB_range_min + this.getVariation('rangeVariance'),
            this.controls.spiralB_range_max + this.getVariation('rangeVariance')
        );

        // ORIGINAL ROTATION: rotate(frameCount/10);
        const rotation = this.frameCount / (this.controls.rotationSpeed + this.getVariation('speedVariance'));
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

        // Draw spirals - ORIGINAL approach with exact geometry and colors
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

        // Draw center circle - ORIGINAL: circle(trancePoint[0],trancePoint[1],40);
        this.drawCircle(0, 0, 20, [255, 255, 255]);

        this.frameCount++;
        this.animationId = requestAnimationFrame(() => this.draw());
    }

    spiral(step, ang, colorArray) {
        const gl = this.gl;

        // Calculate scale to match original behavior
        const scale = Math.min(this.width, this.height) / 400;

        // Generate spiral vertices using ORIGINAL template logic
        const vertices = [];
        let r1 = 0;

        // ORIGINAL: for ( var i = 0 ; i < 250 ; i++ )
        for (let i = 0; i < this.controls.iterations; i++) {
            r1 += step; // ORIGINAL: r1 += step;

            // ORIGINAL calculation: r1*sin(ang*i), r1*cos(ang*i)
            const r1x = (r1 * Math.sin(ang * i)) * scale;
            const r1y = (r1 * Math.cos(ang * i)) * scale;

            vertices.push(r1x, r1y);
        }

        // Upload vertices to buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

        // Set up vertex attribute
        gl.enableVertexAttribArray(this.locations.position);
        gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);

        // Set color
        const r = colorArray[0] / 255;
        const g = colorArray[1] / 255;
        const b = colorArray[2] / 255;
        const alpha = colorArray[3] || 1.0;
        gl.uniform4f(this.locations.color, r, g, b, alpha);

        // Draw as line strip
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

    // Return to pure original settings
    resetToOriginal() {
        this.controls.frameSpeed1 = 200;
        this.controls.frameSpeed2 = 200;
        this.controls.rotationSpeed = 10;
        this.controls.spiralA_geometry = 1.0;
        this.controls.spiralB_geometry = 0.3;
        this.controls.spiralA_color = [223, 4, 113, 1.0];  // #df0471 - Hot pink
        this.controls.spiralB_color = [0, 255, 255, 1.0];  // #00ffff - Cyan
        this.controls.spiralA_range_min = 0.5;
        this.controls.spiralA_range_max = 1.5;
        this.controls.spiralB_range_min = 1.0;
        this.controls.spiralB_range_max = 1.5;
        this.controls.iterations = 250;
        this.disableSubtleVariation();
        this.controls.randomizer.enabled = false;
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

        // Simple color intensity (maintains original hue)
        setColorIntensity: (intensity) => {
            const baseA = [223, 4, 113];    // #df0471 - Hot pink
            const baseB = [0, 255, 255];    // #00ffff - Cyan
            window.spiralAnimation.controls.spiralA_color = [
                baseA[0] * intensity, baseA[1] * intensity, baseA[2] * intensity, 1.0
            ];
            window.spiralAnimation.controls.spiralB_color = [
                baseB[0] * intensity, baseB[1] * intensity, baseB[2] * intensity, 1.0
            ];
        },

        // Get current state
        getControls: () => window.spiralAnimation.getControls()
    };

    // Default to ORIGINAL behavior
    window.spiralAnimation.resetToOriginal();
});
