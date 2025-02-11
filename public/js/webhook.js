const webhookURL = 'https://discord.com/api/webhooks/1312844386144616571/D2pR3e8tpkpxo_kT6TgyHZSe_aacHkwqYyHXKYQlKT6OqviQomehckA9jsZWojIOalh_';
function sendMessageToDiscord(message) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', webhookURL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    const payload = JSON.stringify({
        content: message,
        username: 'BS',
    });
    xhr.send(payload);
}