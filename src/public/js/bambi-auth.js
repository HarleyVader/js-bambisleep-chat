document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on a protected page that requires BambiName
  const isProtectedRoute = 
    window.location.pathname.includes('/bambi/create') || 
    window.location.pathname.includes('/bambis/create') || 
    window.location.pathname.includes('/bambi/new') || 
    window.location.pathname.includes('/bambis/new') || 
    window.location.pathname.includes('/edit');
  
  if (isProtectedRoute) {
    // Get bambiname from cookies
    const bambiname = BambiSocket.getBambiNameFromCookies();
    
    // If bambiname isn't set, redirect to home with a message to set it
    if (!bambiname) {
      window.location.href = '/?error=You must set a BambiName to access this feature';
    }
  }
});