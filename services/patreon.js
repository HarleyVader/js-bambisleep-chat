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
    this.usersByPatreonId = new Map(); // patreonUserId → tier info (persistent)
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
        include: "memberships,memberships.campaign,memberships.currently_entitled_tiers",
        "fields[user]": "email,full_name,first_name,image_url,thumb_url",
        "fields[member]":
          "patron_status,currently_entitled_amount_cents,lifetime_support_cents,campaign_lifetime_support_cents",
        "fields[tier]": "title,amount_cents",
        "fields[campaign]": "vanity,creation_name",
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
    // Check if user has any memberships
    const memberships =
      identityData.included?.filter((item) => item.type === "member") || [];

    // Get all tiers from the response
    const allTiers = identityData.included?.filter((item) => item.type === "tier") || [];
    
    // Get all campaigns from the response  
    const allCampaigns = identityData.included?.filter((item) => item.type === "campaign") || [];

    console.log(`📊 Found ${memberships.length} membership(s), ${allTiers.length} tier(s), ${allCampaigns.length} campaign(s)`);
    
    if (memberships.length === 0) {
      console.log("❌ No memberships found - returning FREE");
      return "FREE";
    }

    // Find active patron memberships
    const activePatronships = memberships.filter(
      (m) => m.attributes?.patron_status === "active_patron"
    );
    
    console.log(`✅ Found ${activePatronships.length} active patron membership(s)`);

    // Log active memberships with their campaigns and tiers
    activePatronships.forEach((m, i) => {
      const campaignId = m.relationships?.campaign?.data?.id;
      const campaign = allCampaigns.find((c) => c.id === campaignId);
      const tierRels = m.relationships?.currently_entitled_tiers?.data || [];
      const tierNames = tierRels.map((tr) => {
        const tier = allTiers.find((t) => t.id === tr.id);
        return tier ? `${tier.attributes?.title} ($${(tier.attributes?.amount_cents || 0) / 100})` : tr.id;
      });
      const amountCents = m.attributes?.currently_entitled_amount_cents || 0;
      console.log(`📋 Active ${i + 1}: campaign="${campaign?.attributes?.creation_name || campaignId}", amount=$${amountCents / 100}, tiers=[${tierNames.join(", ")}]`);
    });

    // If we have a specific CAMPAIGN_ID configured, look for that first
    if (this.config.CAMPAIGN_ID) {
      console.log(`🎯 Looking for specific campaign ID: "${this.config.CAMPAIGN_ID}"`);
      const ourMembership = activePatronships.find((member) => {
        const campaignRel = member.relationships?.campaign?.data;
        return campaignRel?.id === this.config.CAMPAIGN_ID;
      });

      if (ourMembership) {
        return this.determineTierFromMembership(ourMembership, allTiers);
      }
      console.log("⚠️ No membership found for configured campaign ID");
    }

    // Fallback: Check if user is an active patron of ANY campaign with paid tiers
    // This allows the app to work without specific tier IDs configured
    console.log("🔄 Checking active memberships for any paid tier...");
    
    // Sort by amount_cents descending to get highest tier first
    const sortedActivePatronships = [...activePatronships].sort((a, b) => {
      const amountA = a.attributes?.currently_entitled_amount_cents || 0;
      const amountB = b.attributes?.currently_entitled_amount_cents || 0;
      return amountB - amountA;
    });

    for (const membership of sortedActivePatronships) {
      const result = this.determineTierFromMembership(membership, allTiers);
      if (result !== "FREE") {
        return result;
      }
    }

    // User is active patron but only of free tiers
    if (activePatronships.length > 0) {
      console.log("ℹ️ User is active patron but only has free tier memberships");
      return "GOOD_GIRL"; // Give basic premium for being a patron at all
    }

    return "FREE";
  }

  /**
   * Determine tier from a specific membership
   * @param {object} membership - Membership object
   * @param {Array} allTiers - All tier objects from response
   * @returns {string} Tier name
   */
  determineTierFromMembership(membership, allTiers) {
    const entitledTierRels = membership.relationships?.currently_entitled_tiers?.data || [];
    const amountCents = membership.attributes?.currently_entitled_amount_cents || 0;
    
    // Get the actual tier objects
    const entitledTiers = entitledTierRels.map((rel) => 
      allTiers.find((t) => t.id === rel.id)
    ).filter(Boolean);

    // Check for specific tier IDs first (if configured)
    for (const tier of entitledTiers) {
      if (tier.id === this.config.TIERS.AIRHEAD_BARBIE) {
        console.log(`👑 Found AIRHEAD_BARBIE tier by ID`);
        return "AIRHEAD_BARBIE";
      }
    }

    for (const tier of entitledTiers) {
      if (tier.id === this.config.TIERS.PINK_POODLE) {
        console.log(`🎀 Found PINK_POODLE tier by ID`);
        return "PINK_POODLE";
      }
    }

    for (const tier of entitledTiers) {
      if (tier.id === this.config.TIERS.GOOD_GIRL) {
        console.log(`💕 Found GOOD_GIRL tier by ID`);
        return "GOOD_GIRL";
      }
    }

    // Fallback: Determine tier by amount (if no specific IDs configured)
    // $10+ = AIRHEAD_BARBIE, $5+ = PINK_POODLE, $1+ = GOOD_GIRL
    if (amountCents >= 1000) {
      console.log(`👑 AIRHEAD_BARBIE tier by amount: $${amountCents / 100}`);
      return "AIRHEAD_BARBIE";
    } else if (amountCents >= 500) {
      console.log(`🎀 PINK_POODLE tier by amount: $${amountCents / 100}`);
      return "PINK_POODLE";
    } else if (amountCents >= 100) {
      console.log(`💕 GOOD_GIRL tier by amount: $${amountCents / 100}`);
      return "GOOD_GIRL";
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
    const tierData = {
      tier: tierInfo.tier,
      features: this.getFeaturesForTier(tierInfo.tier),
      userId: tierInfo.userId,
      email: tierInfo.email,
      fullName: tierInfo.fullName,
      avatarUrl: tierInfo.avatarUrl || null,
      thumbUrl: tierInfo.thumbUrl || null,
      updatedAt: new Date().toISOString(),
    };

    // Store by socket ID for real-time events
    this.userTiers.set(socketId, tierData);

    // Also store by Patreon user ID for persistence across reconnections
    if (tierInfo.userId) {
      this.usersByPatreonId.set(tierInfo.userId, tierData);
      console.log(`💾 Tier persisted for Patreon user ID: ${tierInfo.userId}`);
    }

    console.log(`💎 User tier set: ${socketId} → ${tierInfo.tier}`);
    if (tierInfo.avatarUrl) {
      console.log(`🖼️ Avatar URL stored for ${socketId}`);
    }
  }

  /**
   * Get user tier information by socket ID
   * @param {string} socketId - User's socket ID
   * @returns {object} Tier information
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
   * Get user tier information by Patreon user ID (persistent)
   * @param {string} patreonUserId - Patreon user ID
   * @returns {object|null} Tier information or null if not found
   */
  getTierByPatreonId(patreonUserId) {
    return this.usersByPatreonId.get(patreonUserId) || null;
  }

  /**
   * Link a socket to an existing Patreon user (for reconnections)
   * @param {string} socketId - New socket ID
   * @param {string} patreonUserId - Patreon user ID from cookie
   * @returns {object|null} Tier info if found, null otherwise
   */
  linkSocketToPatreonUser(socketId, patreonUserId) {
    const tierData = this.usersByPatreonId.get(patreonUserId);
    if (tierData) {
      this.userTiers.set(socketId, tierData);
      console.log(`🔗 Socket ${socketId} linked to Patreon user ${patreonUserId} (${tierData.tier})`);
      return tierData;
    }
    return null;
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
