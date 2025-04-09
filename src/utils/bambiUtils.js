import { Logger } from './logger.js';

const logger = new Logger('BambiUtils');

// Common utility for getting username from cookies
export function getBambiNameFromCookies(req) {
  if (req.cookies && req.cookies.bambiname) {
    return decodeURIComponent(req.cookies.bambiname);
  }
  return null;
}

// Other common utilities for Bambi profiles
export function formatBambiResponse(bambi) {
  // Remove sensitive fields, standardize response format
  return {
    username: bambi.username,
    displayName: bambi.displayName || bambi.username,
    avatar: bambi.avatar || '/gif/default-avatar.gif',
    about: bambi.about,
    description: bambi.description,
    lastActive: bambi.updatedAt,
    // Add other fields as needed
  };
}

// Standardize error logging
export function logError(context, error) {
  logger.error(`[${context}] ${error.message}`, {
    stack: error.stack,
    time: new Date().toISOString()
  });
}