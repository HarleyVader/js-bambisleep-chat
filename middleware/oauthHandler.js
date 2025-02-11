const qs = require('querystring');
const axios = require('axios');

module.exports.handleLogin = (req, res, config) => {
  const loginUrl = `https://www.patreon.com/oauth2/authorize?` +
    `response_type=code&` +
    `client_id=${config.clientId}&` +
    `redirect_uri=${encodeURIComponent(config.redirectUri)}&` +
    `scope=campaigns.members`;
  
  res.writeHead(302, { Location: loginUrl });
  res.end();
};

module.exports.handleCallback = async (req, res, config) => {
  const urlParts = req.url.split('?');
  const query = qs.parse(urlParts[1]);

  console.log('Received code:', query.code);
  console.log('Received state:', query.state);

  if (!query.code) {
    return res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Missing code parameter');
  }

  try {
    const tokenResponse = await axios.post('https://www.patreon.com/api/oauth2/token', qs.stringify({
      code: query.code,
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    console.log('Token response:', tokenResponse.data);

    const { access_token, refresh_token } = tokenResponse.data;

    // Store the tokens securely in the session
    req.session.accessToken = access_token;
    req.session.refreshToken = refresh_token;

    console.log('Access Token:', access_token);
    console.log('Refresh Token:', refresh_token);

    // Redirect to /profile if successful
    console.log('Redirecting to /profile');
    if (res.headersSent) {
      console.error('Headers already sent.');
      return;
    }
    res.writeHead(302, { Location: '/profile' });
    res.end();
  } catch (error) {
    console.error('Error during OAuth2 callback:', error);
    if (res.headersSent) {
      console.error('Headers already sent.');
      return;
    }
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
};