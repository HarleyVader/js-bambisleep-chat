const dotenv = require('dotenv');

dotenv.config();

const ultravoxConfig = {
    apiKey: process.env.ULTRAVOX_API_KEY,
    apiEndpoint: process.env.ULTRAVOX_API_ENDPOINT,
    websocketUrl: process.env.ULTRAVOX_WEBSOCKET_URL,
    timeout: process.env.ULTRAVOX_TIMEOUT
};

module.exports = { ultravoxConfig };
