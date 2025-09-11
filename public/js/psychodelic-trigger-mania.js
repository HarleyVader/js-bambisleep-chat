// Clean Psychedelic Spiral Implementation - WebGL Version
class SpiralAnimation {
    constructor() {
        this.eyeCursor = null;
        this.canvas = null;
        this.gl = null;
        this.width = 0;
        this.height = 0;
        this.frameCount = 0;
        this.isEnabled = false;
        
        // Control parameters - simplified (matching template)
        this.spiral1Width = 5.0;
        this.spiral2Width = 3.0;
        this.spiral1Speed = 20;
        this.spiral2Speed = 15;
        this.spiral1Color = [0, 128, 128]; // Teal
        this.spiral2Color = [255, 20, 147]; // Barbie Pink
        this.opacityLevel = 1.0;
        
        // Performance settings - minimal approach
        this.ITERATIONS = 400;
        
        // WebGL specific
        this.shaderProgram = null;
        this.vertexBuffer = null;
        this.animationId = null;
        
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
        if (!this.gl || !this.isEnabled) {
            this.animationId = requestAnimationFrame(() => this.draw());
            return;
        }

        const gl = this.gl;
        
        // Clear canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Use shader program
        gl.useProgram(this.shaderProgram);
        
        // Set resolution
        gl.uniform2f(this.locations.resolution, this.width, this.height);
        
        // Simple wave patterns (matching template)
        const a = this.map(Math.sin(this.frameCount / this.spiral1Speed), -1, 1, 0.5, 1.5);
        const b = this.map(Math.cos(this.frameCount / this.spiral2Speed), -1, 1, 1, 1.5);
        
        // Set transform matrix for rotation and translation
        const rotation = this.frameCount / 5;
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
        
        // Draw spirals
        this.spiral(a, 1, this.spiral1Color, this.spiral1Width);
        this.spiral(b, 0.3, this.spiral2Color, this.spiral2Width);
        
        this.frameCount++;
        this.animationId = requestAnimationFrame(() => this.draw());
    }

    spiral(step, ang, colorArray, baseWidth) {
        const gl = this.gl;
        
        // Prepare vertices
        const vertices = [];
        let r1 = 0;
        let r2 = 2;
        let spiralWidth = baseWidth;
        const dw = spiralWidth / (this.ITERATIONS * 0.8);
        
        for (let i = 0; i < this.ITERATIONS; i++) {
            r1 += step;
            spiralWidth -= dw;
            r2 = r1 + spiralWidth;
            
            const r1x = r1 * Math.sin(ang * i);
            const r1y = r1 * Math.cos(ang * i);
            const r2x = r2 * Math.sin(ang * i);
            const r2y = r2 * Math.cos(ang * i);
            
            vertices.push(r1x, r1y, r2x, r2y);
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
        const a = this.opacityLevel;
        gl.uniform4f(this.locations.color, r, g, b, a);
        
        // Draw triangle strip
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertices.length / 2);
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

    // Simple parameter update functions (matching template)
    updateSpiralParams(w1, w2, s1, s2) {
        this.spiral1Width = w1 || this.spiral1Width;
        this.spiral2Width = w2 || this.spiral2Width;
        this.spiral1Speed = s1 || this.spiral1Speed;
        this.spiral2Speed = s2 || this.spiral2Speed;
    }

    updateSpiralColors(c1, c2) {
        if (c1) this.spiral1Color = c1;
        if (c2) this.spiral2Color = c2;
    }

    updateSpiralOpacity(opacity) {
        this.opacityLevel = Math.max(0.1, Math.min(1.0, opacity || 1.0));
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
            // Temporary speed boost
            const originalSpeed1 = this.spiral1Speed;
            const originalSpeed2 = this.spiral2Speed;
            this.spiral1Speed *= 0.3; // Faster (lower divisor)
            this.spiral2Speed *= 0.3;
            
            setTimeout(() => {
                this.spiral1Speed = originalSpeed1;
                this.spiral2Speed = originalSpeed2;
            }, 1000);
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
    
    // Export functions globally (matching template)
    window.updateSpiralParams = (w1, w2, s1, s2) => window.spiralAnimation.updateSpiralParams(w1, w2, s1, s2);
    window.updateSpiralColors = (c1, c2) => window.spiralAnimation.updateSpiralColors(c1, c2);
    window.updateSpiralOpacity = (opacity) => window.spiralAnimation.updateSpiralOpacity(opacity);
    
    // Trigger pulse effect when triggers are activated
    if (window.triggerSystem) {
        const originalPlayEffect = window.triggerSystem.playTriggerEffect;
        window.triggerSystem.playTriggerEffect = function() {
            originalPlayEffect.call(this);
            if (window.spiralAnimation) {
                window.spiralAnimation.triggerPulse();
            }
        };
    }
});
