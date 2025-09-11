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

        // Calculate animation parameters exactly like template
        const a = this.map(Math.sin(this.frameCount/20), -1, 1, 0.5, 1.5);
        const b = this.map(Math.cos(this.frameCount/20), -1, 1, 1, 1.5);
        
        // Set transform matrix for rotation and translation
        const rotation = this.frameCount / 10;
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

        // Draw spirals exactly like template
        this.spiral(a, 1, [199, 0, 199]);
        this.spiral(b, 0.3, [255, 130, 255]);
        
        // Calibration complete placeholder
        this.calibrationComplete();
        
        // Draw trance point circle
        this.drawCircle(this.trancePoint[0], this.trancePoint[1], 40, [255, 255, 255]);
        
        this.frameCount++;
        this.animationId = requestAnimationFrame(() => this.draw());
    }

    spiral(a, x, d) {
        const gl = this.gl;
        
        // Generate spiral vertices as a line strip
        const vertices = [];
        let r1 = 0;
        const step = a;

        for (let i = 0; i < 250; i++) {
            r1 += step;
            const ang = x;

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

        // Set color
        const r = d[0] / 255;
        const g = d[1] / 255;
        const b = d[2] / 255;
        gl.uniform4f(this.locations.color, r, g, b, 1.0);

        // Draw as line strip for thin lines
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
            this.frameCount += 50; // Jump forward in animation
            
            setTimeout(() => {
                this.frameCount = originalFrameCount;
            }, 500);
        }
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
});
