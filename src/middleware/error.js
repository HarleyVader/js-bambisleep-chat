export default function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Something went wrong';
  
  res.status(status).render('error', {
    error: err,
    message: message, // Make sure message is always passed
    status: status
  });
}