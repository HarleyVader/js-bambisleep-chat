// psychodelic-trigger-mania.js - Spiral animations using p5.js
class SpiralAnimation {
    constructor() {
        this.isEnabled = false;
        this.sketch = null;
        this.canvas = null;
        this.angle = 0;
        this.spiralSpeed = 0.02;
        this.colorPhase = 0;
        this.particles = [];
        this.maxParticles = 100;

        // Theme colors matching CSS variables
        this.themeColors = {
            primary: [180, 85, 17],      // #0c2a2a
            primaryAlt: [185, 85, 67],   // #15aab5
            secondary: [315, 100, 25],   // #40002f
            secondaryAlt: [323, 100, 80], // #cc0174
            tertiary: [323, 100, 80],    // #cc0174
            tertiaryAlt: [172, 98, 72],  // #02b893
            button: [326, 100, 87],      // #df0471
            nav: [180, 85, 15],          // #0a2626
            navAlt: [181, 92, 86]        // #17dbd8
        };

        this.init();
    } init() {
        // Wait for p5.js to load
        if (typeof p5 !== 'undefined') {
            this.createSketch();
        } else {
            setTimeout(() => this.init(), 100);
        }
    }

    createSketch() {
        const container = document.getElementById('spiral-container');

        this.sketch = (p) => {
            p.setup = () => {
                const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
                canvas.parent('spiral-container');
                p.colorMode(p.HSB, 360, 100, 100, 100);

                // Initialize particles
                for (let i = 0; i < this.maxParticles; i++) {
                    this.particles.push(this.createParticle(p));
                }
            };

            p.draw = () => {
                if (!this.isEnabled) {
                    p.clear();
                    return;
                }

                // Semi-transparent background for trail effect
                p.fill(0, 0, 0, 10);
                p.rect(0, 0, p.width, p.height);

                this.drawSpiral(p);
                this.updateParticles(p);
                this.angle += this.spiralSpeed;
                this.colorPhase += 0.5;
            };

            p.windowResized = () => {
                p.resizeCanvas(window.innerWidth, window.innerHeight);
            };
        };

        new p5(this.sketch);
    }

    drawSpiral(p) {
        p.push();
        p.translate(p.width / 2, p.height / 2);

        // Draw multiple spirals with different phases
        for (let spiral = 0; spiral < 3; spiral++) {
            p.push();
            p.rotate(this.angle + spiral * p.TWO_PI / 3);

            p.noFill();
            p.strokeWeight(2);

            // Draw spiral arms
            for (let arm = 0; arm < 6; arm++) {
                p.push();
                p.rotate(arm * p.TWO_PI / 6);

                p.beginShape();
                p.noFill();

                for (let i = 0; i < 200; i++) {
                    const radius = i * 2;
                    const spiralAngle = i * 0.3 + this.angle * 3;

                    const x = radius * p.cos(spiralAngle);
                    const y = radius * p.sin(spiralAngle);

                    // Use theme colors with cycling
                    const colorKeys = Object.keys(this.themeColors);
                    const colorIndex = (arm + Math.floor(i / 30)) % colorKeys.length;
                    const themeColor = this.themeColors[colorKeys[colorIndex]];

                    const hue = themeColor[0] + (this.colorPhase + i * 0.5) % 60;
                    const saturation = themeColor[1] + 20 * p.sin(this.angle * 2 + i * 0.1);
                    const brightness = themeColor[2] + 30 * p.sin(this.angle + i * 0.05);
                    const alpha = p.map(i, 0, 200, 80, 10);

                    p.stroke(hue, p.constrain(saturation, 0, 100), p.constrain(brightness, 0, 100), alpha);
                    p.vertex(x, y);
                }

                p.endShape();
                p.pop();
            }

            p.pop();
        }

        // Central pulsing circle with theme colors
        const centralSize = 30 + 20 * p.sin(this.angle * 4);
        const centralColor = this.themeColors.button;
        p.fill(centralColor[0], centralColor[1], centralColor[2], 70);
        p.noStroke();
        p.ellipse(0, 0, centralSize, centralSize);

        p.pop();
    }

    createParticle(p) {
        const colorKeys = Object.keys(this.themeColors);
        const randomColorKey = colorKeys[Math.floor(Math.random() * colorKeys.length)];
        const themeColor = this.themeColors[randomColorKey];

        return {
            x: p.random(p.width),
            y: p.random(p.height),
            vx: p.random(-1, 1),
            vy: p.random(-1, 1),
            size: p.random(2, 6),
            hue: themeColor[0] + p.random(-20, 20), // Slight variation from theme color
            saturation: themeColor[1],
            brightness: themeColor[2],
            life: p.random(100, 255),
            maxLife: p.random(100, 255)
        };
    }

    updateParticles(p) {
        // Attraction to center
        const centerX = p.width / 2;
        const centerY = p.height / 2;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];

            // Calculate attraction to center
            const dx = centerX - particle.x;
            const dy = centerY - particle.y;
            const distance = p.sqrt(dx * dx + dy * dy);

            if (distance > 0) {
                const force = 0.0005;
                particle.vx += (dx / distance) * force;
                particle.vy += (dy / distance) * force;
            }

            // Add spiral motion
            const spiralForce = 0.001;
            particle.vx += -dy * spiralForce;
            particle.vy += dx * spiralForce;

            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;

            // Damping
            particle.vx *= 0.995;
            particle.vy *= 0.995;

            // Update life
            particle.life -= 1;

            // Draw particle with theme colors
            const alpha = p.map(particle.life, 0, particle.maxLife, 0, 100);
            p.fill(particle.hue, particle.saturation, particle.brightness, alpha);
            p.noStroke();
            p.ellipse(particle.x, particle.y, particle.size, particle.size);

            // Remove dead particles
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Add new particles
        while (this.particles.length < this.maxParticles) {
            this.particles.push(this.createParticle(p));
        }
    }

    toggle() {
        this.isEnabled = !this.isEnabled;

        if (this.isEnabled) {
            // Reset animation state
            this.angle = 0;
            this.colorPhase = 0;
        }

        return this.isEnabled;
    }

    setSpeed(speed) {
        this.spiralSpeed = Math.max(0.001, Math.min(0.1, speed));
    }

    getSpeed() {
        return this.spiralSpeed;
    }

    triggerPulse() {
        if (this.isEnabled) {
            // Temporary speed boost
            const originalSpeed = this.spiralSpeed;
            this.spiralSpeed *= 3;

            setTimeout(() => {
                this.spiralSpeed = originalSpeed;
            }, 1000);

            // Add burst of particles
            if (this.sketch) {
                for (let i = 0; i < 20; i++) {
                    this.particles.push(this.createParticle({
                        random: (min, max) => {
                            if (max === undefined) return Math.random() * min;
                            return Math.random() * (max - min) + min;
                        },
                        width: window.innerWidth,
                        height: window.innerHeight
                    }));
                }
            }
        }
    }

    cleanup() {
        if (this.sketch && this.sketch.remove) {
            this.sketch.remove();
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
