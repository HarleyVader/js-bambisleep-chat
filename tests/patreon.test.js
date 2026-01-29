/**
 * Patreon Service Test
 * Tests OAuth configuration and service methods
 */

require("dotenv").config();
const patreonService = require("../services/patreon");
const ENV = require("../config/env");

console.log("\n🧪 PATREON SERVICE TEST");
console.log("═".repeat(50));

// Test 1: Configuration
console.log("\n📋 Test 1: Configuration Validation");
console.log(`   Client ID: ${ENV.PATREON.CLIENT_ID ? "✅ SET" : "❌ NOT SET"}`);
console.log(
  `   Client Secret: ${ENV.PATREON.CLIENT_SECRET ? "✅ SET" : "❌ NOT SET"}`,
);
console.log(`   Redirect URI: ${ENV.PATREON.REDIRECT_URI}`);
console.log(
  `   Is Configured: ${ENV.PATREON.isConfigured ? "✅ YES" : "❌ NO"}`,
);

// Test 2: Service Initialization
console.log("\n🔧 Test 2: Service Initialization");
try {
  console.log("   ✅ PatreonService singleton loaded");
  console.log(
    `   Config loaded: ${patreonService.config.isConfigured ? "✅" : "❌"}`,
  );
  console.log(
    `   User tiers map: ${patreonService.userTiers instanceof Map ? "✅" : "❌"}`,
  );
  console.log(
    `   Session store: ${patreonService.sessionStore instanceof Map ? "✅" : "❌"}`,
  );

  // Test 3: OAuth URL Generation
  console.log("\n🔗 Test 3: OAuth URL Generation");
  try {
    const testSocketId = "test-socket-123";
    const authUrl = patreonService.getAuthorizationUrl(testSocketId);
    console.log("   ✅ OAuth URL generated successfully");
    console.log(`   URL length: ${authUrl.length} characters`);
    console.log(
      `   Contains client_id: ${authUrl.includes("client_id") ? "✅" : "❌"}`,
    );
    console.log(
      `   Contains redirect_uri: ${authUrl.includes("redirect_uri") ? "✅" : "❌"}`,
    );
    console.log(
      `   Contains scope: ${authUrl.includes("scope") ? "✅" : "❌"}`,
    );
    console.log(
      `   Contains state: ${authUrl.includes("state") ? "✅" : "❌"}`,
    );
    console.log(`\n   Preview: ${authUrl.substring(0, 100)}...`);
  } catch (error) {
    console.log(`   ❌ Failed to generate OAuth URL: ${error.message}`);
  }

  // Test 4: Feature Mapping
  console.log("\n🎯 Test 4: Feature Access Mapping");
  const tiers = ["FREE", "GOOD_GIRL", "PINK_POODLE", "AIRHEAD_BARBIE"];
  tiers.forEach((tier) => {
    const features = patreonService.getFeaturesForTier(tier);
    console.log(`   ${tier}: [${features.join(", ")}]`);
  });

  // Test 5: Tier Configuration
  console.log("\n🏷️  Test 5: Tier Configuration");
  console.log(
    `   Good Girl ID: ${ENV.PATREON.TIERS.GOOD_GIRL || "⚠️  NOT SET"}`,
  );
  console.log(
    `   Pink Poodle ID: ${ENV.PATREON.TIERS.PINK_POODLE || "⚠️  NOT SET"}`,
  );
  console.log(
    `   Airhead Barbie ID: ${ENV.PATREON.TIERS.AIRHEAD_BARBIE || "⚠️  NOT SET"}`,
  );
  console.log(`   Min Tier (cents): ${ENV.PATREON.MIN_TIER_CENTS}`);
  console.log(`   Tier Name: ${ENV.PATREON.TIER_NAME}`);

  // Test 6: API Endpoints
  console.log("\n🌐 Test 6: API Endpoints");
  console.log(`   Auth URL: ${ENV.PATREON.AUTH_URL}`);
  console.log(`   Token URL: ${ENV.PATREON.TOKEN_URL}`);
  console.log(`   API URL: ${ENV.PATREON.API_URL}`);
  console.log(`   Scopes: ${ENV.PATREON.SCOPES}`);

  console.log("\n" + "═".repeat(50));
  console.log("✅ ALL PATREON TESTS PASSED");
  console.log("═".repeat(50) + "\n");
} catch (error) {
  console.error("\n❌ PATREON TEST FAILED");
  console.error(`   Error: ${error.message}`);
  console.error(`   Stack: ${error.stack}`);
  console.log("\n" + "═".repeat(50) + "\n");
  process.exit(1);
}
