/**
 * Patreon Service - OAuth2 and Membership Management
 * Handles authentication, tier verification, and feature access control
 */

const axios = require("axios");
const ENV = require("../config/env");

class PatreonService {
  constructor() {
    this.config = ENV.PATREON;
    this.userTiers = new Map(); // socketId → tier info
    this.sessionStore = new Map(); // state → session data
  }

  /**
   * Generate OAuth authorization URL
   * @param {string} socketId - Socket ID to track user session
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(socketId) {
    if (!this.config.isConfigured) {
      throw new Error("Patreon is not configured");
    }

    const state = this.generateState(socketId);
    return this.config.getAuthUrl(state);
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth redirect
   * @returns {Promise<object>} Token response with access_token and refresh_token
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post(
        this.config.TOKEN_URL,
        new URLSearchParams({
          code,
          grant_type: "authorization_code",
          client_id: this.config.CLIENT_ID,
          client_secret: this.config.CLIENT_SECRET,
          redirect_uri: this.config.REDIRECT_URI,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error(
        "❌ Failed to exchange code for token:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<object>} New token response
   */
  async refreshAccessToken(refreshToken) {
    try {
      const response = await axios.post(
        this.config.TOKEN_URL,
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: this.config.CLIENT_ID,
          client_secret: this.config.CLIENT_SECRET,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error(
        "❌ Failed to refresh token:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Fetch user identity and membership information
   * @param {string} accessToken - User's access token
   * @returns {Promise<object>} User data with memberships
   */
  async getUserIdentity(accessToken) {
    try {
      const url = `${this.config.API_URL}/identity`;
      const params = new URLSearchParams({
        include: "memberships,memberships.currently_entitled_tiers",
        "fields[user]": "email,full_name,first_name,image_url,thumb_url",
        "fields[member]":
          "patron_status,currently_entitled_amount_cents,lifetime_support_cents",
        "fields[tier]": "title,amount_cents",
      });

      const response = await axios.get(`${url}?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error(
        "❌ Failed to fetch user identity:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Determine user's membership tier
   * @param {object} identityData - User identity data from Patreon API
   * @returns {string} Tier name (FREE, GOOD_GIRL, PINK_POODLE, AIRHEAD_BARBIE)
   */
  determineMembershipTier(identityData) {
    // Debug: Log full identity data structure
    console.log("🔍 Patreon Identity Data:", JSON.stringify(identityData, null, 2));
    
    // Check if user has any memberships
    const memberships =
      identityData.included?.filter((item) => item.type === "member") || [];

    console.log(`📊 Found ${memberships.length} membership(s)`);
    
    if (memberships.length === 0) {
      console.log("❌ No memberships found - returning FREE");
      return "FREE";
    }

    // Log all memberships for debugging
    memberships.forEach((m, i) => {
      const campaignId = m.relationships?.campaign?.data?.id;
      const status = m.attributes?.patron_status;
      const tiers = m.relationships?.currently_entitled_tiers?.data || [];
      console.log(`📋 Membership ${i + 1}: campaign=${campaignId}, status=${status}, tiers=${JSON.stringify(tiers)}`);
    });
    
    console.log(`🎯 Looking for campaign ID: "${this.config.CAMPAIGN_ID}"`);

    // Find membership to our campaign
    const ourMembership = memberships.find((member) => {
      const campaignRel = member.relationships?.campaign?.data;
      return campaignRel?.id === this.config.CAMPAIGN_ID;
    });

    if (
      !ourMembership ||
      ourMembership.attributes?.patron_status !== "active_patron"
    ) {
      return "FREE";
    }

    // Get entitled tiers
    const entitledTierRels =
      ourMembership.relationships?.currently_entitled_tiers?.data || [];
    const entitledTiers =
      identityData.included?.filter(
        (item) =>
          item.type === "tier" &&
          entitledTierRels.some((rel) => rel.id === item.id),
      ) || [];

    // Check tier hierarchy (highest tier wins)
    for (const tier of entitledTiers) {
      if (tier.id === this.config.TIERS.AIRHEAD_BARBIE) {
        return "AIRHEAD_BARBIE";
      }
    }

    for (const tier of entitledTiers) {
      if (tier.id === this.config.TIERS.PINK_POODLE) {
        return "PINK_POODLE";
      }
    }

    for (const tier of entitledTiers) {
      if (tier.id === this.config.TIERS.GOOD_GIRL) {
        return "GOOD_GIRL";
      }
    }

    return "FREE";
  }

  /**
   * Get features allowed for a tier
   * @param {string} tier - Tier name
   * @returns {Array<string>} Array of allowed features
   */
  getFeaturesForTier(tier) {
    return this.config.FEATURES[tier] || this.config.FEATURES.FREE;
  }

  /**
   * Check if user has access to a specific feature
   * @param {string} socketId - User's socket ID
   * @param {string} feature - Feature name (e.g., 'tts', 'collar', 'admin')
   * @returns {boolean} True if user has access
   */
  hasFeatureAccess(socketId, feature) {
    const userTier = this.userTiers.get(socketId);

    if (!userTier) {
      // If not authenticated, only allow FREE tier features
      return this.config.FEATURES.FREE.includes(feature);
    }

    const allowedFeatures = this.getFeaturesForTier(userTier.tier);
    return allowedFeatures.includes(feature);
  }

  /**
   * Store user tier information
   * @param {string} socketId - User's socket ID
   * @param {object} tierInfo - Tier information
   */
  setUserTier(socketId, tierInfo) {
    this.userTiers.set(socketId, {
      tier: tierInfo.tier,
      features: this.getFeaturesForTier(tierInfo.tier),
      userId: tierInfo.userId,
      email: tierInfo.email,
      fullName: tierInfo.fullName,
      avatarUrl: tierInfo.avatarUrl || null,
      thumbUrl: tierInfo.thumbUrl || null,
      updatedAt: new Date().toISOString(),
    });

    console.log(`💎 User tier set: ${socketId} → ${tierInfo.tier}`);
    if (tierInfo.avatarUrl) {
      console.log(`🖼️ Avatar URL stored for ${socketId}`);
    }
  }

  /**
   * Get user tier information
   * @param {string} socketId - User's socket ID
   * @returns {object|null} Tier information or null
   */
  getUserTier(socketId) {
    return (
      this.userTiers.get(socketId) || {
        tier: "FREE",
        features: this.config.FEATURES.FREE,
        userId: null,
        email: null,
        fullName: "Guest",
        avatarUrl: null,
        thumbUrl: null,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  /**
   * Remove user tier information (on disconnect)
   * @param {string} socketId - User's socket ID
   */
  removeUserTier(socketId) {
    this.userTiers.delete(socketId);
    console.log(`🗑️ User tier removed: ${socketId}`);
  }

  /**
   * Generate state token for OAuth
   * @param {string} socketId - Socket ID to associate with session
   * @returns {string} State token
   */
  generateState(socketId) {
    const state = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.sessionStore.set(state, {
      socketId,
      createdAt: Date.now(),
    });

    // Clean up old sessions (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [key, value] of this.sessionStore.entries()) {
      if (value.createdAt < tenMinutesAgo) {
        this.sessionStore.delete(key);
      }
    }

    return state;
  }

  /**
   * Validate and retrieve state information
   * @param {string} state - State token
   * @returns {object|null} Session data or null
   */
  validateState(state) {
    const session = this.sessionStore.get(state);
    if (session) {
      this.sessionStore.delete(state); // One-time use
      return session;
    }
    return null;
  }

  /**
   * Get campaign members (requires creator access token)
   * @returns {Promise<Array>} Array of members
   */
  async getCampaignMembers() {
    if (!this.config.hasCreatorAccess) {
      throw new Error("Creator access token not configured");
    }

    try {
      const url = `${this.config.API_URL}/campaigns/${this.config.CAMPAIGN_ID}/members`;
      const params = new URLSearchParams({
        include: "currently_entitled_tiers,user",
        "fields[member]":
          "patron_status,currently_entitled_amount_cents,lifetime_support_cents,full_name",
        "fields[tier]": "title,amount_cents",
        "fields[user]": "full_name",
      });

      const response = await axios.get(`${url}?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${this.config.CREATOR_ACCESS_TOKEN}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error(
        "❌ Failed to fetch campaign members:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Get tier statistics
   * @returns {object} Statistics object
   */
  getTierStatistics() {
    const stats = {
      total: this.userTiers.size,
      byTier: {
        FREE: 0,
        GOOD_GIRL: 0,
        PINK_POODLE: 0,
        AIRHEAD_BARBIE: 0,
      },
    };

    for (const tierInfo of this.userTiers.values()) {
      stats.byTier[tierInfo.tier]++;
    }

    return stats;
  }

  /**
   * Check if Patreon is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    return this.config.isConfigured;
  }
}

// Export singleton instance
module.exports = new PatreonService();
