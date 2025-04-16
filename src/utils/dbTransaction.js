// Just re-export from the main db.js file
export { withDbConnection, getModel } from '../config/db.js';

// For backwards compatibility
export default { withDbConnection, getModel };