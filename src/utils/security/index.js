// Security Utilities
// Implements helmet configuration, CORS policies, and input validation
// Provides DNS rebinding protection and secure communication protocols

import crypto from 'crypto';

// Helmet security configuration
export const helmetConfig = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            mediaSrc: ["'self'", "blob:"],
            connectSrc: ["'self'", "ws:", "wss:", "http://localhost:1234", "http://127.0.0.1:1234"]
        }
    },
    dnsPrefetchControl: false,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: 'no-referrer' },
    xssFilter: true
};

// CORS configuration
export const corsConfig = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];

        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    exposedHeaders: ['Mcp-Session-Id'],
    allowedHeaders: ['Content-Type', 'mcp-session-id', 'Authorization'],
    credentials: true
};

// Input validation utilities
export class InputValidator {
    static sanitizeString(input, maxLength = 1000) {
        if (typeof input !== 'string') {
            throw new Error('Input must be a string');
        }

        return input
            .slice(0, maxLength)
            .replace(/[<>\"']/g, '') // Remove potential XSS characters
            .trim();
    }

    static validateTriggerName(triggerName) {
        const validTriggers = [
            'BAMBI SLEEP',
            'GOOD GIRL',
            'BAMBI RESET',
            'BIMBO DOLL',
            'BAMBI FREEZE'
        ];

        if (!validTriggers.includes(triggerName)) {
            throw new Error(`Invalid trigger name: ${triggerName}`);
        }

        return true;
    }

    static validateIntensity(intensity) {
        const num = Number(intensity);
        if (isNaN(num) || num < 1 || num > 10) {
            throw new Error('Intensity must be a number between 1 and 10');
        }
        return num;
    }

    static validateDuration(duration) {
        const num = Number(duration);
        if (isNaN(num) || num < 1 || num > 3600) {
            throw new Error('Duration must be a number between 1 and 3600 seconds');
        }
        return num;
    }
}

// DNS rebinding protection
export function validateHost(hostname) {
    const allowedHosts = process.env.MCP_ALLOWED_HOSTS?.split(',') || ['127.0.0.1', 'localhost'];

    if (!allowedHosts.includes(hostname)) {
        throw new Error(`Host not allowed: ${hostname}`);
    }

    return true;
}

// Session security
export function generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
}

export function generateSecureToken() {
    return crypto.randomBytes(64).toString('base64url');
}

// Rate limiting utilities
export class RateLimiter {
    constructor(maxRequests = 100, windowMs = 60000) {
        this.requests = new Map();
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }

    isAllowed(identifier) {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // Clean old entries
        for (const [key, timestamps] of this.requests.entries()) {
            const filtered = timestamps.filter(time => time > windowStart);
            if (filtered.length === 0) {
                this.requests.delete(key);
            } else {
                this.requests.set(key, filtered);
            }
        }

        // Check current requests
        const userRequests = this.requests.get(identifier) || [];

        if (userRequests.length >= this.maxRequests) {
            return false;
        }

        // Add current request
        userRequests.push(now);
        this.requests.set(identifier, userRequests);

        return true;
    }
}

export default { helmetConfig, corsConfig, InputValidator, validateHost, generateSessionId, generateSecureToken, RateLimiter };
