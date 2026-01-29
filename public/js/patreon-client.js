/**
 * Patreon Client Integration
 * Handles client-side membership tier management and feature gating
 */

export class PatreonClient {
  constructor(socket) {
    this.socket = socket;
    this.tier = "FREE";
    this.features = ["chat"]; // Default: Free tier (matches server FEATURES.FREE)
    this.fullName = "Guest";
    this.avatarUrl = null;
    this.thumbUrl = null;
    this.patreonConfigured = false;

    this.setupSocketListeners();
  }

  /**
   * Setup socket event listeners
   */
  setupSocketListeners() {
    // Receive membership tier on connect
    this.socket.on("membership-tier", (data) => {
      this.tier = data.tier;
      this.features = data.features;
      this.fullName = data.fullName;
      this.avatarUrl = data.avatarUrl;
      this.thumbUrl = data.thumbUrl;
      this.patreonConfigured = data.patreonConfigured;

      console.log(`💎 Membership tier: ${this.tier}`);
      console.log(`✨ Available features:`, this.features);
      if (this.avatarUrl) {
        console.log(`🖼️ Avatar loaded`);
      }

      this.updateUI();
    });

    // Handle successful authentication
    this.socket.on("patreon-authenticated", (data) => {
      this.tier = data.tier;
      this.features = data.features;
      this.fullName = data.fullName;
      this.avatarUrl = data.avatarUrl;
      this.thumbUrl = data.thumbUrl;

      console.log(`✅ ${data.message}`);
      this.showTierNotification(data.message);
      this.updateUI();
    });

    // Handle feature denial
    this.socket.on("feature-denied", (data) => {
      this.showFeatureDenied(data.feature, data.tier, data.message);
    });
  }

  /**
   * Check if user has access to a feature
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  hasFeature(feature) {
    return this.features.includes(feature);
  }

  /**
   * Get Patreon login URL and redirect
   */
  async loginWithPatreon() {
    try {
      const response = await fetch(
        `/api/patreon/login-url?socketId=${this.socket.id}`,
      );
      const data = await response.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else if (data.error) {
        console.warn("Patreon not configured:", data.error);
        this.showPatreonNotConfigured();
      }
    } catch (error) {
      console.error("Failed to get Patreon login URL:", error);
    }
  }

  /**
   * Update UI based on membership tier
   */
  updateUI() {
    // Update tier display with avatar
    this.updateTierDisplay();

    // Disable features not available in current tier
    this.updateFeatureButtons();

    // Show/hide Patreon login button
    this.updatePatreonLoginButton();
  }

  /**
   * Update tier display with avatar
   */
  updateTierDisplay() {
    let tierContainer = document.getElementById("patreon-tier-container");

    // Create container if it doesn't exist
    if (!tierContainer) {
      tierContainer = document.createElement("div");
      tierContainer.id = "patreon-tier-container";
      tierContainer.className = "patreon-tier-container";

      // Insert before docs-link-container
      const docsContainer = document.querySelector(".docs-link-container");
      if (docsContainer) {
        docsContainer.parentNode.insertBefore(tierContainer, docsContainer);
      }
    }

    // Build tier display HTML
    const avatarHTML = this.avatarUrl
      ? `<img src="${this.avatarUrl}" alt="${this.fullName}" class="patreon-avatar" onerror="this.style.display='none'">`
      : `<div class="patreon-avatar-placeholder">${this.getAvatarPlaceholder()}</div>`;

    const tierClass = `tier-${this.tier.toLowerCase().replace("_", "-")}`;

    tierContainer.innerHTML = `
      <div class="patreon-user-info">
        ${avatarHTML}
        <div class="patreon-user-details">
          <span class="patreon-username">${this.fullName}</span>
          <span id="tier-display" class="tier-badge ${tierClass}">${this.getTierDisplayName()}</span>
        </div>
      </div>
    `;

    // Only show if authenticated (not FREE tier) or has avatar
    tierContainer.style.display =
      this.tier !== "FREE" || this.avatarUrl ? "block" : "none";
  }

  /**
   * Get avatar placeholder based on tier
   * @returns {string}
   */
  getAvatarPlaceholder() {
    const placeholders = {
      FREE: "✨",
      GOOD_GIRL: "💕",
      PINK_POODLE: "🎀",
      AIRHEAD_BARBIE: "👑",
    };
    return placeholders[this.tier] || "🌀";
  }

  /**
   * Get display name for tier
   * @returns {string}
   */
  getTierDisplayName() {
    const tierNames = {
      FREE: "✨ Free Bambi",
      GOOD_GIRL: "💕 Good Girl",
      PINK_POODLE: "🎀 Pink Poodle",
      AIRHEAD_BARBIE: "👑 Airhead Barbie",
    };
    return tierNames[this.tier] || this.tier;
  }

  /**
   * Get tier color
   * @returns {string}
   */
  getTierColor() {
    const colors = {
      FREE: "#888888",
      GOOD_GIRL: "#FF69B4",
      PINK_POODLE: "#FF1493",
      AIRHEAD_BARBIE: "#FFD700",
    };
    return colors[this.tier] || "#888888";
  }

  /**
   * Update feature buttons based on tier
   */
  updateFeatureButtons() {
    const featureMap = {
      tts: "#toggle-tts",
      triggers: "#toggle-triggers",
      spiral: "#toggle-spiral",
      collar: "#toggle-collar",
      brainwave: "#toggle-brainwave",
      buttplug: "#toggle-buttplug",
    };

    for (const [feature, selector] of Object.entries(featureMap)) {
      const button = document.querySelector(selector);
      if (button) {
        const hasAccess = this.hasFeature(feature);

        if (!hasAccess) {
          button.classList.add("locked");
          button.disabled = true;
          button.title = `Requires ${this.getRequiredTierForFeature(feature)}`;

          // Add lock icon
          if (!button.querySelector(".lock-icon")) {
            const lockIcon = document.createElement("span");
            lockIcon.className = "lock-icon";
            lockIcon.textContent = "🔒";
            button.appendChild(lockIcon);
          }
        } else {
          button.classList.remove("locked");
          button.disabled = false;
          button.title = "";

          // Remove lock icon
          const lockIcon = button.querySelector(".lock-icon");
          if (lockIcon) {
            lockIcon.remove();
          }
        }
      }
    }
  }

  /**
   * Get required tier for a feature
   * @param {string} feature - Feature name
   * @returns {string}
   */
  getRequiredTierForFeature(feature) {
    const requirements = {
      aigf: "Free",
      tts: "Good Girl tier",
      triggers: "Good Girl tier",
      spiral: "Good Girl tier",
      collar: "Pink Poodle tier",
      brainwave: "Pink Poodle tier",
      buttplug: "Pink Poodle tier",
      admin: "Airhead Barbie tier",
    };
    return requirements[feature] || "Premium tier";
  }

  /**
   * Update Patreon login button visibility
   */
  updatePatreonLoginButton() {
    let loginBtn = document.getElementById("patreon-login-btn");

    // Create button if it doesn't exist and Patreon is configured
    if (!loginBtn && this.patreonConfigured && this.tier === "FREE") {
      loginBtn = document.createElement("button");
      loginBtn.id = "patreon-login-btn";
      loginBtn.className = "patreon-login-btn";
      loginBtn.innerHTML = "💎 Unlock Premium Features";
      loginBtn.addEventListener("click", () => this.loginWithPatreon());

      // Add to chat container or appropriate location
      const docsContainer = document.querySelector(".docs-link-container");
      if (docsContainer) {
        docsContainer.appendChild(loginBtn);
      }
    }

    // Update button visibility
    if (loginBtn) {
      loginBtn.style.display =
        this.tier === "FREE" && this.patreonConfigured
          ? "inline-block"
          : "none";
    }
  }

  /**
   * Show tier upgrade notification
   * @param {string} message - Notification message
   */
  showTierNotification(message) {
    const notification = document.createElement("div");
    notification.className = "tier-notification";
    notification.innerHTML = `
            <div class="tier-notification-content" style="background: ${this.getTierColor()}">
                <span class="tier-icon">💎</span>
                <span class="tier-message">${message}</span>
            </div>
        `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add("show");
    }, 100);

    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 500);
    }, 5000);
  }

  /**
   * Show feature denied message
   * @param {string} feature - Feature name
   * @param {string} currentTier - Current tier
   * @param {string} message - Denial message
   */
  showFeatureDenied(feature, currentTier, message) {
    const notification = document.createElement("div");
    notification.className = "feature-denied-notification";
    notification.innerHTML = `
            <div class="denied-content">
                <span class="denied-icon">🔒</span>
                <div class="denied-text">
                    <strong>Feature Locked</strong>
                    <p>${message}</p>
                    ${this.patreonConfigured ? '<button class="upgrade-btn" onclick="window.patreonClient.loginWithPatreon()">Upgrade Now</button>' : ""}
                </div>
            </div>
        `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add("show");
    }, 100);

    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 500);
    }, 4000);
  }

  /**
   * Show Patreon not configured message
   */
  showPatreonNotConfigured() {
    alert("Patreon integration is not configured on this server.");
  }

  /**
   * Check URL for Patreon auth result
   */
  checkAuthResult() {
    const params = new URLSearchParams(window.location.search);
    
    // Check for success (auth_success=true&tier=...)
    const authSuccess = params.get("auth_success");
    const tier = params.get("tier");
    
    // Check for error (auth_error=...)
    const authError = params.get("auth_error");

    if (authSuccess === "true" && tier) {
      this.showTierNotification(
        `✨ Successfully authenticated! You are now ${tier.replace(/_/g, " ")}!`,
      );

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authError) {
      console.error("Patreon auth error:", authError);
      alert(`Patreon authentication failed: ${decodeURIComponent(authError)}`);

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
}

// Make globally accessible
window.PatreonClient = PatreonClient;
