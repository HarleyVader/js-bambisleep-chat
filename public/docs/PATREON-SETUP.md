# Patreon Integration - Environment Variables Guide

## Overview

BambiSleep Chat now supports Patreon membership tiers with feature-based access control. Configure your Patreon OAuth2 credentials to enable premium features for your patrons.

## Membership Tiers

### 🆓 Free Bambi (Default)

- **Features**: AIGF AI Chat only
- **Access**: All users by default

### 💕 Good Girl

- **Features**: AIGF, Text-to-Speech, Spiral Animations, Trigger System
- **Requirements**: Active Patreon membership at Good Girl tier

### 🎀 Pink Poodle

- **Features**: All Good Girl features + Collar, Brainwave Beats, Buttplug Integration
- **Requirements**: Active Patreon membership at Pink Poodle tier

### 👑 Airhead Barbie

- **Features**: All Pink Poodle features + Admin Functions
- **Requirements**: Active Patreon membership at Airhead Barbie tier (highest tier)

## Required Environment Variables

### Patreon OAuth2 Configuration

Add these variables to your `.env` file:

```bash
# Patreon Client Credentials (from https://www.patreon.com/portal/registration/register-clients)
PATREON_CLIENT_ID=your_client_id_here
PATREON_CLIENT_SECRET=your_client_secret_here

# OAuth Redirect URIs
PATREON_REDIRECT_URI_DEVELOPMENT=http://localhost:6969/patreon/oauth/redirect
PATREON_REDIRECT_URI_PRODUCTION=https://yourdomain.com/patreon/oauth/redirect

# Campaign Configuration
PATREON_CAMPAIGN_ID=your_campaign_id

# Creator Access (Optional - for fetching campaign members)
PATREON_CREATOR_ACCESS_TOKEN=your_creator_access_token
PATREON_CREATOR_REFRESH_TOKEN=your_creator_refresh_token

# Tier IDs (from your Patreon campaign tiers)
PATREON_TIER_GOOD_GIRL=tier_id_for_good_girl
PATREON_TIER_PINK_POODLE=tier_id_for_pink_poodle
PATREON_TIER_AIRHEAD_BARBIE=tier_id_for_airhead_barbie
```

## Setup Instructions

### 1. Create a Patreon OAuth Client

1. Go to https://www.patreon.com/portal/registration/register-clients
2. Click "Create Client"
3. Fill in client details:
   - **App Name**: BambiSleep Chat
   - **Description**: Real-time hypnosis chat with membership tiers
   - **App Icon**: Upload your logo (optional)
   - **Redirect URIs**: Add both development and production URIs
     - Development: `http://localhost:6969/patreon/oauth/redirect`
     - Production: `https://yourdomain.com/patreon/oauth/redirect`

4. Save your Client ID and Client Secret

### 2. Get Your Campaign ID

#### Method 1: Via API (Recommended)

```bash
curl -H "Authorization: Bearer YOUR_CREATOR_ACCESS_TOKEN" \
  "https://www.patreon.com/api/oauth2/v2/campaigns?fields[campaign]=created_at"
```

Look for the `id` field in the response.

#### Method 2: Via Browser

1. Go to your creator page (patreon.com/your_page_name)
2. Open browser dev tools (F12)
3. Search page source for `campaign_id` or check network requests

### 3. Get Tier IDs

1. Use the Patreon API to fetch your tiers:

```bash
curl -H "Authorization: Bearer YOUR_CREATOR_ACCESS_TOKEN" \
  "https://www.patreon.com/api/oauth2/v2/campaigns/YOUR_CAMPAIGN_ID?include=tiers&fields[tier]=title,amount_cents"
```

2. Match tier IDs to your membership levels:
   - Find the tier with your "Good Girl" title → `PATREON_TIER_GOOD_GIRL`
   - Find the tier with your "Pink Poodle" title → `PATREON_TIER_PINK_POODLE`
   - Find the tier with your "Airhead Barbie" title → `PATREON_TIER_AIRHEAD_BARBIE`

### 4. Get Creator Access Tokens (Optional)

Your Creator's Access Token is provided when you create the OAuth client. To get a refresh token:

1. Complete the OAuth flow once as the campaign creator
2. The tokens will be in the response from `/api/oauth2/token`
3. Store both access token and refresh token in your `.env`

## Testing

### Local Development

1. Set up your `.env` file with the variables above
2. Start the server: `npm start`
3. Navigate to `http://localhost:6969`
4. Click "💎 Unlock Premium Features" to test OAuth flow
5. Authorize with your Patreon account
6. You should be redirected back with your tier activated

### Verify Configuration

Check server logs on startup. You should see:

```
🔧 BambiSleep Chat Configuration
══════════════════════════════════════════════════
📍 Environment: DEVELOPMENT
🌐 Server Port: 6969
⚡ Vite Port: 5173

🤖 Services:
   LM Studio: ✅ http://localhost:7777
   Kokoro TTS: ✅ http://localhost:8880
   Default Voice: af_sky+af_bella
   Patreon: ✅ Configured
   Creator Access: ✅ Yes
```

## Feature Access Control

Features are automatically gated based on membership tier:

```javascript
// Client-side check
if (patreonClient.hasFeature("tts")) {
  // Enable TTS controls
}

// Server-side enforcement
socket.on("tts-request", (data) => {
  if (!patreonService.hasFeatureAccess(socket.id, "tts")) {
    socket.emit("feature-denied", {
      feature: "tts",
      message: "Text-to-speech requires Good Girl tier or higher",
    });
    return;
  }
  // Process TTS request...
});
```

## Troubleshooting

### "Patreon integration not configured"

- Check that `PATREON_CLIENT_ID` and `PATREON_CLIENT_SECRET` are set
- Verify `PATREON_REDIRECT_URI_DEVELOPMENT` matches your registered redirect URI

### "Invalid state" error during OAuth

- State tokens expire after 10 minutes
- Complete the OAuth flow within 10 minutes of clicking the login button
- Check that cookies are enabled in your browser

### Tier not detected after login

- Verify `PATREON_CAMPAIGN_ID` matches your actual campaign
- Check that `PATREON_TIER_*` IDs match your tier IDs exactly
- Ensure the user has an active pledge (not declined/paused)

### Features still locked after successful login

- Check browser console for errors
- Verify socket connection is established
- Clear browser cache and reload

## API Endpoints

### GET `/api/patreon/login-url`

Get the Patreon OAuth authorization URL.

**Query Parameters:**

- `socketId` (optional): Socket ID for session tracking

**Response:**

```json
{
  "authUrl": "https://www.patreon.com/oauth2/authorize?...",
  "configured": true
}
```

### GET `/patreon/oauth/redirect`

OAuth redirect handler (users are sent here after authorizing).

**Query Parameters:**

- `code`: Authorization code from Patreon
- `state`: State token for session validation

### GET `/api/patreon/tier`

Get user's current tier and features.

**Query Parameters:**

- `socketId`: Socket ID

**Response:**

```json
{
  "tier": "GOOD_GIRL",
  "features": ["aigf", "tts", "spiral", "triggers"],
  "fullName": "Bambi Smith",
  "configured": true
}
```

### GET `/api/patreon/stats` (Admin Only)

Get tier statistics across all connected users.

**Response:**

```json
{
  "total": 42,
  "byTier": {
    "FREE": 15,
    "GOOD_GIRL": 20,
    "PINK_POODLE": 5,
    "AIRHEAD_BARBIE": 2
  }
}
```

## Security Notes

1. **Never commit your `.env` file** to version control
2. Keep your `PATREON_CLIENT_SECRET` confidential
3. Use HTTPS in production for OAuth redirect URIs
4. Tokens are stored server-side only (never sent to client)
5. Feature access is enforced on both client and server

## Support

For Patreon API documentation, visit:

- https://docs.patreon.com/
- https://www.patreon.com/portal (Developer Portal)
- https://www.patreondevelopers.com/ (Community Forum)

For issues with this integration, check the server logs and browser console for detailed error messages.
