/**
 * Patreon Endpoints Integration Test
 * Tests all Patreon API endpoints with the server running
 */

const axios = require("axios");

const BASE_URL = "http://localhost:6969";
const TEST_SOCKET_ID = "test-socket-12345";

async function testPatreonEndpoints() {
  console.log("\n🧪 PATREON ENDPOINTS INTEGRATION TEST");
  console.log("═".repeat(50));
  console.log("⚠️  Make sure server is running: npm start");
  console.log("═".repeat(50));

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Stats endpoint
  console.log("\n📊 Test 1: GET /api/patreon/stats");
  try {
    const response = await axios.get(`${BASE_URL}/api/patreon/stats`);
    console.log("   Status:", response.status);
    console.log("   Data:", JSON.stringify(response.data, null, 2));
    if (response.status === 200 && response.data.total !== undefined) {
      console.log("   ✅ PASSED");
      passedTests++;
    } else {
      console.log("   ❌ FAILED: Unexpected response format");
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    if (error.code === "ECONNREFUSED") {
      console.log("   🛑 Server not running! Start with: npm start");
      process.exit(1);
    }
    failedTests++;
  }

  // Test 2: Status endpoint (no auth)
  console.log("\n🔐 Test 2: GET /api/patreon/status?socket_id=test");
  try {
    const response = await axios.get(
      `${BASE_URL}/api/patreon/status?socket_id=${TEST_SOCKET_ID}`,
    );
    console.log("   Status:", response.status);
    console.log("   Data:", JSON.stringify(response.data, null, 2));
    if (response.status === 200 && response.data.tier === "FREE") {
      console.log("   ✅ PASSED (unauthenticated user defaults to FREE)");
      passedTests++;
    } else {
      console.log("   ❌ FAILED: Unexpected tier");
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failedTests++;
  }

  // Test 3: Feature check - chat (available to all)
  console.log("\n💬 Test 3: GET /api/patreon/check/chat");
  try {
    const response = await axios.get(
      `${BASE_URL}/api/patreon/check/chat?socket_id=${TEST_SOCKET_ID}`,
    );
    console.log("   Status:", response.status);
    console.log("   Data:", JSON.stringify(response.data, null, 2));
    if (response.status === 200 && response.data.hasAccess === true) {
      console.log("   ✅ PASSED (chat available to FREE tier)");
      passedTests++;
    } else {
      console.log("   ❌ FAILED: Chat should be available");
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failedTests++;
  }

  // Test 4: Feature check - tts (requires GOOD_GIRL)
  console.log("\n🎤 Test 4: GET /api/patreon/check/tts");
  try {
    const response = await axios.get(
      `${BASE_URL}/api/patreon/check/tts?socket_id=${TEST_SOCKET_ID}`,
    );
    console.log("   Status:", response.status);
    console.log("   Data:", JSON.stringify(response.data, null, 2));
    if (response.status === 200 && response.data.hasAccess === false) {
      console.log("   ✅ PASSED (tts blocked for FREE tier)");
      passedTests++;
    } else {
      console.log("   ❌ FAILED: TTS should be blocked for FREE tier");
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failedTests++;
  }

  // Test 5: Feature check - collar (requires PINK_POODLE)
  console.log("\n🔗 Test 5: GET /api/patreon/check/collar");
  try {
    const response = await axios.get(
      `${BASE_URL}/api/patreon/check/collar?socket_id=${TEST_SOCKET_ID}`,
    );
    console.log("   Status:", response.status);
    console.log("   Data:", JSON.stringify(response.data, null, 2));
    if (response.status === 200 && response.data.hasAccess === false) {
      console.log("   ✅ PASSED (collar blocked for FREE tier)");
      passedTests++;
    } else {
      console.log("   ❌ FAILED: Collar should be blocked for FREE tier");
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failedTests++;
  }

  // Test 6: Feature check - admin (requires AIRHEAD_BARBIE)
  console.log("\n👑 Test 6: GET /api/patreon/check/admin");
  try {
    const response = await axios.get(
      `${BASE_URL}/api/patreon/check/admin?socket_id=${TEST_SOCKET_ID}`,
    );
    console.log("   Status:", response.status);
    console.log("   Data:", JSON.stringify(response.data, null, 2));
    if (response.status === 200 && response.data.hasAccess === false) {
      console.log("   ✅ PASSED (admin blocked for FREE tier)");
      passedTests++;
    } else {
      console.log("   ❌ FAILED: Admin should be blocked for FREE tier");
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failedTests++;
  }

  // Test 7: OAuth initiation (should redirect)
  console.log("\n🔗 Test 7: GET /auth/patreon (OAuth redirect)");
  try {
    const response = await axios.get(
      `${BASE_URL}/auth/patreon?socket_id=${TEST_SOCKET_ID}`,
      {
        maxRedirects: 0,
        validateStatus: (status) => status === 302,
      },
    );
    if (
      response.status === 302 &&
      response.headers.location.includes("patreon.com")
    ) {
      console.log("   Status:", response.status);
      console.log(
        "   Redirect URL:",
        response.headers.location.substring(0, 100) + "...",
      );
      console.log("   ✅ PASSED (redirects to Patreon OAuth)");
      passedTests++;
    } else {
      console.log("   ❌ FAILED: Should redirect to Patreon");
      failedTests++;
    }
  } catch (error) {
    if (
      error.response?.status === 302 &&
      error.response.headers.location?.includes("patreon.com")
    ) {
      console.log("   Status: 302");
      console.log(
        "   Redirect URL:",
        error.response.headers.location.substring(0, 100) + "...",
      );
      console.log("   ✅ PASSED (redirects to Patreon OAuth)");
      passedTests++;
    } else {
      console.log(`   ❌ FAILED: ${error.message}`);
      failedTests++;
    }
  }

  // Summary
  console.log("\n" + "═".repeat(50));
  console.log("📊 TEST SUMMARY");
  console.log("═".repeat(50));
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(
    `📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`,
  );
  console.log("═".repeat(50) + "\n");

  if (failedTests === 0) {
    console.log("🎉 ALL PATREON ENDPOINTS WORKING!\n");
    process.exit(0);
  } else {
    console.log("⚠️  SOME TESTS FAILED - CHECK LOGS ABOVE\n");
    process.exit(1);
  }
}

// Run tests
testPatreonEndpoints().catch((error) => {
  console.error("\n💥 FATAL ERROR:", error.message);
  process.exit(1);
});
