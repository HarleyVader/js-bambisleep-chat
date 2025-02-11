const axios = require('axios');
const bambisleepChalk = require('../models/bambisleepChalk');

let doxxerinator;

doxxerinator = async function(req, res, next, data) {
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const port = req.headers['x-forwarded-port'] || req.connection.remotePort;

  const domainName = `${protocol}://${host}:${port}`;
  const namecheapIp = (await axios.get('https://ip.web-hosting.com/')).data;
  const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  const isValidIp = ipv4Regex.test(namecheapIp);
  const isForwardedIp = ipv4Regex.test(clientIp);

  if (isValidIp && isForwardedIp) {
    console.log(bambisleepChalk.success('Bambi is doxxed!'));
    return { namecheapIp, clientIp, protocol, host, port, fullyDoxxed: true };
  } else {
    console.log(bambisleepChalk.error('Bambi is not doxxed!'));
    return { namecheapIp, clientIp, protocol, host, port, fullyDoxxed: false };
  }
};

module.exports = {
  doxxerinator
};