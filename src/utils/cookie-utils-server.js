/**
 * Server-side cookie utilities
 * This module provides cookie handling functions for the server environment
 */

// Parse cookies from request header
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  
  return cookieHeader
    .split(';')
    .map(cookie => cookie.trim().split('='))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
}

// Serialize cookie with options for HTTP headers
function serializeCookie(name, value, options = {}) {
  let cookieStr = `${name}=${value}`;
  
  if (options.path) cookieStr += `; path=${options.path}`;
  if (options.domain) cookieStr += `; domain=${options.domain}`;
  if (options.maxAge) cookieStr += `; max-age=${options.maxAge}`;
  if (options.expires) cookieStr += `; expires=${options.expires.toUTCString()}`;
  if (options.httpOnly) cookieStr += '; httpOnly';
  if (options.secure) cookieStr += '; secure';
  if (options.sameSite) cookieStr += `; sameSite=${options.sameSite}`;
  
  return cookieStr;
}

// Get cookie by name from request
function getCookie(req, name) {
  if (!req.cookies) return null;
  return req.cookies[name] || null;
}

// Set cookie with expiration
function setCookie(res, name, value, days = 7) {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  
  res.cookie(name, value, {
    expires: date,
    path: '/'
  });
  
  return res;
}

// Delete cookie
function deleteCookie(res, name) {
  res.clearCookie(name, { path: '/' });
  return res;
}

// Get all cookies from request as object
function getAllCookies(req) {
  return req.cookies || {};
}

// Get username from cookies or default to anonBambi
function getBambiNameFromCookies(req) {
  try {
    return getCookie(req, 'bambiname') || 'anonBambi';
  } catch (error) {
    return 'anonBambi';
  }
}

// Set bambi name in cookies
function setBambiName(res, name, days = 7) {
  if (!name || typeof name !== 'string') return false;
  
  const username = name.trim();
  if (!username) return false;
  
  setCookie(res, 'bambiname', username, days);
  return true;
}

// Check if user owns profile based on cookie
function isProfileOwner(req, profileUsername) {
  const cookieUsername = getBambiNameFromCookies(req);
  return cookieUsername === profileUsername;
}

// Export all functions
export {
  parseCookies,
  serializeCookie,
  getCookie,
  setCookie,
  deleteCookie,
  getAllCookies,
  getBambiNameFromCookies,
  setBambiName,
  isProfileOwner
};