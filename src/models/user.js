/**
 * Simple adapter module that redirects user.js imports to Bambi.js
 */
import { User as Bambi, getUser, updateUser } from './Bambi.js';

// Re-export the Bambi model as User for backward compatibility
export const User = Bambi;

// Re-export the helper functions
export { getUser, updateUser };

// Default export for simplicity
export default Bambi;