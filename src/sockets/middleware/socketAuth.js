import jwt from 'jsonwebtoken';

export const socketAuth = (socket, next) => {
  // Get bambiname from cookies
  const cookies = socket.request.headers.cookie;
  if (cookies) {
    const bambinameCookie = cookies.split(';').find(c => c.trim().startsWith('bambiname='));
    if (bambinameCookie) {
      const bambiname = decodeURIComponent(bambinameCookie.split('=')[1].trim());
      if (bambiname) {
        // Attach user info to socket
        socket.user = { bambiname };
        socket.bambiname = bambiname;
        return next();
      }
    }
  }
  
  // Allow connection even without authentication
  // Users will be treated as anonymous until they set a BambiName
  socket.user = { bambiname: null };
  socket.bambiname = null;
  next();
};