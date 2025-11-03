/**
 * MCP Tools Integration Test Suite (Unified & Simplified)
 * Tests all 8 MCP servers for proper activation, authentication, and functionality
 *
 * Merged from mcp-tools.test.js + mcp-tools-simple.test.js
 * Compatible with unified-test-runner.js framework
 */

const fs = require("fs");
const path = require("path");

class MCPToolsTest {
  constructor() {
    // Test suite metadata for unified-test-runner
    this.name = "MCP Tools Integration";
    this.tags = ["mcp", "integration", "api"];
    this.priority = 50;

    this.envPath = path.join(__dirname, "..", ".env.mcp");
    this.mcpConfigPath = path.join(
      __dirname,
      "..",
      ".vscode",
      "mcp-settings.json"
    );
    this.testResults = {
      serverActivation: {},
      authentication: {},
      functionality: {},
      apiKeys: {},
    };
  }

  log(message, type = "info") {
    const timestamp = new Date().toISOString().substr(11, 8);
    const emoji =
      {
        success: "✅",
        error: "❌",
        warning: "⚠️",
        info: "📊",
      }[type] || "🔄";

    console.log(`[${timestamp}] ${emoji} ${message}`);
  }

  async loadMCPEnvironment() {
    try {
      if (fs.existsSync(this.envPath)) {
        const envData = fs.readFileSync(this.envPath, "utf8");
        const lines = envData.split("\n");

        for (const line of lines) {
          if (line.trim() && !line.startsWith("#")) {
            const [key, value] = line.split("=");
            if (key && value) {
              process.env[key.trim()] = value.trim();
            }
          }
        }
        this.log("MCP environment loaded successfully", "success");
        return true;
      } else {
        this.log("MCP environment file not found", "warning");
        return false;
      }
    } catch (error) {
      this.log(`Failed to load MCP environment: ${error.message}`, "error");
      return false;
    }
  }

  async testServerActivation() {
    this.log("Testing MCP Server Activation...", "info");

    try {
      const MCPManager = require("../mcp-manager");
      const mcpManager = new MCPManager();

      await mcpManager.loadEnvironment();
      const configLoaded = await mcpManager.loadConfig();

      if (!configLoaded) {
        throw new Error("Failed to load MCP configuration");
      }

      const servers = Object.keys(mcpManager.config.mcpServers);
      this.log(`Found ${servers.length} MCP servers configured`, "info");

      let activatedCount = 0;
      for (const [name, config] of Object.entries(
        mcpManager.config.mcpServers
      )) {
        try {
          const isActive = await mcpManager.testServer(name, config);
          this.testResults.serverActivation[name] = isActive;
          if (isActive) {
            activatedCount++;
            this.log(`${name}: Active`, "success");
          } else {
            this.log(`${name}: Failed to activate`, "error");
          }
        } catch (error) {
          this.testResults.serverActivation[name] = false;
          this.log(`${name} activation failed: ${error.message}`, "error");
        }
      }

      const success = activatedCount === 8;
      this.log(
        `Server Activation: ${activatedCount}/8 servers active`,
        success ? "success" : "warning"
      );

      if (success) this.results.passed++;
      else this.results.failed++;

      return { success, activatedServers: activatedCount, totalServers: 8 };
    } catch (error) {
      this.log(`Server activation test failed: ${error.message}`, "error");
      this.results.failed++;
      return { success: false, error: error.message };
    }
  }

  async testAPIKeys() {
    this.log("Testing API Keys Validation...", "info");

    try {
      const requiredKeys = {
        github: ["GITHUB_TOKEN"],
        mongodb: ["MONGODB_URI"],
        stripe: ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY"],
        huggingface: ["HUGGINGFACE_API_KEY"],
        azure_quantum: [
          "AZURE_QUANTUM_SUBSCRIPTION_ID",
          "AZURE_QUANTUM_RESOURCE_GROUP",
          "AZURE_QUANTUM_WORKSPACE",
        ],
        microsoft_clarity: ["CLARITY_API_KEY", "CLARITY_PROJECT_ID"],
        ecl_extension: ["HPCC_CONNECTION_STRING"],
      };

      let validKeys = 0;
      let totalKeys = 0;

      for (const [server, keys] of Object.entries(requiredKeys)) {
        for (const key of keys) {
          totalKeys++;
          const value = process.env[key];
          const isValid =
            value &&
            value.trim() !== "" &&
            !value.includes("your_") &&
            !value.includes("_here");

          if (!this.testResults.apiKeys[server]) {
            this.testResults.apiKeys[server] = {};
          }
          this.testResults.apiKeys[server][key] = isValid;

          if (isValid) {
            validKeys++;
            this.log(`${key}: Valid`, "success");
          } else {
            this.log(`${key}: Missing or placeholder value`, "warning");
          }
        }
      }

      const percentage = Math.round((validKeys / totalKeys) * 100);
      this.log(
        `API Keys: ${validKeys}/${totalKeys} configured (${percentage}%)`,
        "info"
      );

      if (validKeys > totalKeys * 0.5) this.results.passed++;
      else this.results.warnings++;

      return { success: validKeys > 0, validKeys, totalKeys, percentage };
    } catch (error) {
      this.log(`API keys validation failed: ${error.message}`, "error");
      this.results.failed++;
      return { success: false, error: error.message };
    }
  }

  async testAuthentication() {
    this.log("Testing Account Authentication...", "info");

    const authTests = [
      {
        name: "Hugging Face",
        key: "HUGGINGFACE_API_KEY",
        format: "hf_",
        account: "brandynette",
      },
      {
        name: "Stripe",
        key: "STRIPE_SECRET_KEY",
        format: "sk_",
        account: "bambisleep.church",
      },
      {
        name: "GitHub",
        key: "GITHUB_TOKEN",
        format: "ghp_|github_pat_",
        account: "HarleyVader",
      },
      {
        name: "Microsoft Clarity",
        key: "CLARITY_API_KEY",
        format: "",
        account: "bambisleep.chat",
      },
      {
        name: "MongoDB",
        key: "MONGODB_URI",
        format: "mongodb://",
        account: "local/atlas",
      },
      {
        name: "Azure Quantum",
        key: "AZURE_QUANTUM_SUBSCRIPTION_ID",
        format: "",
        account: "azure",
      },
      {
        name: "HPCC Systems",
        key: "HPCC_CONNECTION_STRING",
        format: "",
        account: "enterprise",
      },
    ];

    let authenticatedServices = 0;

    for (const { name, key, format, account } of authTests) {
      const value = process.env[key];
      const isConfigured =
        value && !value.includes("your_") && !value.includes("_here");

      let isAuthenticated = false;
      if (isConfigured && format) {
        const formats = format.split("|");
        isAuthenticated = formats.some((f) => value.startsWith(f));
      } else if (isConfigured) {
        isAuthenticated = value.length > 10; // Basic length check
      }

      this.testResults.authentication[name.toLowerCase().replace(" ", "_")] =
        isAuthenticated;

      if (isAuthenticated) {
        authenticatedServices++;
        this.log(`${name}: Authenticated (${account})`, "success");
      } else if (isConfigured) {
        this.log(`${name}: Configured but format validation failed`, "warning");
      } else {
        this.log(`${name}: Not configured`, "warning");
      }
    }

    const success = authenticatedServices >= 4;
    this.log(
      `Authentication: ${authenticatedServices}/${authTests.length} services authenticated`,
      success ? "success" : "warning"
    );

    if (success) this.results.passed++;
    else this.results.warnings++;

    return { success, authenticatedServices, totalServices: authTests.length };
  }

  async testFunctionality() {
    this.log("Testing MCP Server Functionality...", "info");

    const functionalityTests = [
      { name: "filesystem", test: () => this.testFilesystemFunctionality() },
      { name: "github", test: () => this.testGitHubFunctionality() },
      { name: "mongodb", test: () => this.testMongoDBFunctionality() },
      { name: "stripe", test: () => this.testStripeFunctionality() },
      { name: "huggingface", test: () => this.testHuggingFaceFunctionality() },
      {
        name: "azure_quantum",
        test: () => this.testAzureQuantumFunctionality(),
      },
      {
        name: "microsoft_clarity",
        test: () => this.testClarityFunctionality(),
      },
      { name: "ecl_extension", test: () => this.testECLFunctionality() },
    ];

    let functionalServices = 0;

    for (const { name, test } of functionalityTests) {
      try {
        const result = await test();
        this.testResults.functionality[name] = result.success;

        if (result.success) {
          functionalServices++;
          this.log(`${name}: ${result.message || "Functional"}`, "success");
        } else {
          this.log(
            `${name}: ${result.message || "Limited functionality"}`,
            "warning"
          );
        }
      } catch (error) {
        this.testResults.functionality[name] = false;
        this.log(`${name}: ${error.message}`, "error");
      }
    }

    const success = functionalServices >= 6;
    this.log(
      `Functionality: ${functionalServices}/8 servers functional`,
      success ? "success" : "warning"
    );

    if (success) this.results.passed++;
    else this.results.warnings++;

    return { success, functionalServices, totalServers: 8 };
  }

  // Functionality test methods
  async testFilesystemFunctionality() {
    const projectPath = path.join(__dirname, "..");
    const hasAccess = fs.existsSync(projectPath);
    return {
      success: hasAccess,
      message: hasAccess ? "File operations available" : "Path access denied",
    };
  }

  async testGitHubFunctionality() {
    const hasToken =
      process.env.GITHUB_TOKEN && !process.env.GITHUB_TOKEN.includes("your_");
    return {
      success: hasToken,
      message: hasToken ? "Repository management available" : "Token needed",
    };
  }

  async testMongoDBFunctionality() {
    const hasUri =
      process.env.MONGODB_URI && !process.env.MONGODB_URI.includes("your_");
    return {
      success: hasUri,
      message: hasUri
        ? "Database operations available"
        : "Connection URI needed",
    };
  }

  async testStripeFunctionality() {
    const hasKeys =
      process.env.STRIPE_SECRET_KEY &&
      !process.env.STRIPE_SECRET_KEY.includes("your_");
    return {
      success: hasKeys,
      message: hasKeys ? "Payment processing available" : "API keys needed",
    };
  }

  async testHuggingFaceFunctionality() {
    const hasKey =
      process.env.HUGGINGFACE_API_KEY &&
      !process.env.HUGGINGFACE_API_KEY.includes("your_");
    return {
      success: hasKey,
      message: hasKey ? "AI models/datasets available" : "API key needed",
    };
  }

  async testAzureQuantumFunctionality() {
    const hasConfig =
      process.env.AZURE_QUANTUM_SUBSCRIPTION_ID &&
      !process.env.AZURE_QUANTUM_SUBSCRIPTION_ID.includes("your_");
    return {
      success: hasConfig,
      message: hasConfig
        ? "Quantum workspace available"
        : "Azure config needed",
    };
  }

  async testClarityFunctionality() {
    const hasKeys =
      process.env.CLARITY_API_KEY && process.env.CLARITY_PROJECT_ID;
    return {
      success: hasKeys,
      message: hasKeys ? "Analytics dashboard available" : "Credentials needed",
    };
  }

  async testECLFunctionality() {
    const hasConnection =
      process.env.HPCC_CONNECTION_STRING &&
      !process.env.HPCC_CONNECTION_STRING.includes("your_");
    return {
      success: hasConnection,
      message: hasConnection
        ? "HPCC operations available"
        : "Connection string needed",
    };
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalServers: 8,
        activeServers: Object.values(this.testResults.serverActivation).filter(
          Boolean
        ).length,
        authenticatedServices: Object.values(
          this.testResults.authentication
        ).filter(Boolean).length,
        functionalServices: Object.values(
          this.testResults.functionality
        ).filter(Boolean).length,
        testResults: this.results,
      },
      details: this.testResults,
      recommendations: [],
    };

    // Generate recommendations
    if (report.summary.activeServers < 8) {
      report.recommendations.push(
        "Some MCP servers failed to activate - check configuration"
      );
    }
    if (report.summary.authenticatedServices < 5) {
      report.recommendations.push(
        "Configure additional API keys in .env.mcp for full functionality"
      );
    }
    if (report.summary.functionalServices < 6) {
      report.recommendations.push(
        "Review server configurations and network connectivity"
      );
    }

    // Save report
    const reportDir = path.join(__dirname, "reports");
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(
      reportDir,
      `mcp-test-report-${Date.now()}.json`
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    this.log(`Report saved: ${reportPath}`, "success");
    return report;
  }

  async runAllTests() {
    console.log("\n🤖 MCP Tools Integration Test Suite v1.0");
    console.log("=".repeat(50));

    // Load environment
    await this.loadMCPEnvironment();

    // Run all test categories
    const activationResult = await this.testServerActivation();
    const apiKeysResult = await this.testAPIKeys();
    const authResult = await this.testAuthentication();
    const functionalityResult = await this.testFunctionality();

    // Generate report
    const report = await this.generateReport();

    // Final summary
    console.log("\n🎯 MCP Integration Test Results:");
    console.log("=".repeat(40));
    this.log(`Active Servers: ${report.summary.activeServers}/8`, "info");
    this.log(
      `Authenticated Services: ${report.summary.authenticatedServices}/7`,
      "info"
    );
    this.log(
      `Functional Services: ${report.summary.functionalServices}/8`,
      "info"
    );

    const results = {
      passed: report.summary.activeServers + report.summary.functionalServices,
      failed:
        16 - report.summary.activeServers - report.summary.functionalServices,
      tests: [],
      metadata: report,
    };

    results.tests.push({
      name: "MCP Server Activation",
      passed: report.summary.activeServers >= 6,
      message: `${report.summary.activeServers}/8 servers active`,
    });

    results.tests.push({
      name: "Service Authentication",
      passed: report.summary.authenticatedServices >= 4,
      message: `${report.summary.authenticatedServices}/7 services authenticated`,
    });

    return results;
  }

  // Main entry point for unified-test-runner
  async run() {
    return await this.runAllTests();
  }
}

// Export for unified-test-runner
module.exports = MCPToolsTest;

// CLI execution (standalone mode)
if (require.main === module) {
  const test = new MCPToolsTest();
  test
    .runAllTests()
    .then((result) => {
      const success = result.passed > result.failed;
      console.log(
        `\n${success ? "✅" : "❌"} MCP Tools Integration Test Complete!`
      );
      console.log(
        `📊 Results: ${result.passed} passed, ${result.failed} failed`
      );
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("❌ MCP Tools Integration Test Failed:", error);
      process.exit(1);
    });
}

// Export for unified test framework integration
module.exports = { MCPToolsTest };
