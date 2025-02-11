const { patterns } = require('./bambisleepChalk');

module.exports = (err, req, res, next) => {
  console.error(patterns.server.error('Error:', err));
  res.status(500).send('Internal Server Error');
};