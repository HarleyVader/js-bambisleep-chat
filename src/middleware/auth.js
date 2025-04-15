/**
 * Authentication middleware
 * Handles user authentication and authorization
 */
const auth = (req, res, next) => {
  // Get username from cookie or route parameter
  const username = req.cookies.bambiname || req.params.username;
  
  if (!username) {
    // If no username is found, redirect to login
    return res.status(401).render('error', {
      message: 'Authentication required',
      error: { status: 401 },
      validConstantsCount: 5,
      title: 'Error - Authentication Required'
    });
  }
  
  // Add user object to the request
  req.user = {
    username: username,
    isAuthenticated: true,
    // For admins, you might check a special cookie or header
    isAdmin: req.cookies.bambiAdmin === 'true'
  };

  // Check if user has access to the requested resource
  // If they're accessing their own profile or are an admin, allow access
  if (req.params.username && req.params.username !== username && !req.user.isAdmin) {
    return res.status(403).render('error', {
      message: 'Access forbidden',
      error: { status: 403 },
      validConstantsCount: 5,
      title: 'Error - Access Forbidden'
    });
  }
  
  return next();
};

export default auth;