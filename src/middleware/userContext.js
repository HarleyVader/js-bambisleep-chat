export const userContextMiddleware = (req, res, next) => {
  // Extract username from cookie or session
  const username = req.session?.user?.username || 
                  decodeURIComponent(req.cookies['bambiname'] || '');
  
  // Attach to a shared context object
  req.bambiContext = {
    username,
    isAuthenticated: username && username !== 'anonBambi'
  };
  
  // Make available to views
  res.locals.bambiContext = req.bambiContext;
  
  next();
};