/**
 * Environmental Tests - Real Environment Validation
 * Tests actual system requirements, dependencies, and configuration
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");

class EnvironmentTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: [],
    };
  }

  log(message, type = "info") {
    const timestamp = new Date().toISOString();
    const prefix = {
      pass: "✅",
      fail: "❌",
      warn: "⚠️",
      info: "ℹ️",
    }[type];

    console.log(`[${timestamp}] ${prefix} ${message}`);

    this.results.tests.push({
      timestamp,
      message,
      type,
    });

    if (type === "pass") this.results.passed++;
    if (type === "fail") this.results.failed++;
    if (type === "warn") this.results.warnings++;
  }

  async testNodeVersion() {
    this.log("Testing Node.js version requirements...", "info");

    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

    if (majorVersion >= 18) {
      this.log(`Node.js ${nodeVersion} meets requirement (>=18)`, "pass");
      return true;
    } else {
      this.log(`Node.js ${nodeVersion} below requirement (>=18)`, "fail");
      return false;
    }
  }

  async testSystemResources() {
    this.log("Testing system resources...", "info");

    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryGB = totalMemory / 1024 ** 3;
    const freeGB = freeMemory / 1024 ** 3;

    this.log(`Total Memory: ${memoryGB.toFixed(2)} GB`, "info");
    this.log(`Free Memory: ${freeGB.toFixed(2)} GB`, "info");

    if (freeGB < 0.5) {
      this.log("Low memory warning: < 0.5GB free", "warn");
    } else if (freeGB >= 1) {
      this.log("Sufficient memory available", "pass");
    } else {
      this.log("Memory borderline: 0.5-1GB free", "warn");
    }

    // Test CPU cores
    const cpus = os.cpus();
    this.log(`CPU Cores: ${cpus.length}`, "info");

    if (cpus.length >= 2) {
      this.log("Sufficient CPU cores for concurrent development", "pass");
      return true;
    } else {
      this.log("Single core detected - may impact performance", "warn");
      return false;
    }
  }

  async testFileSystem() {
    this.log("Testing file system access...", "info");

    const criticalPaths = [
      "public/js/aigf-core.js",
      "server.js",
      "workers/tts-express.js",
      "workers/lmstudio.js",
      "workers/triggers.json",
      "public/css/layers.css",
    ];

    let allFilesExist = true;

    for (const filePath of criticalPaths) {
      const fullPath = path.join(process.cwd(), filePath);
      if (fs.existsSync(fullPath)) {
        this.log(`✓ ${filePath} exists`, "pass");
      } else {
        this.log(`✗ Missing critical file: ${filePath}`, "fail");
        allFilesExist = false;
      }
    }

    // Test write permissions
    const testFile = path.join(process.cwd(), "test-write-permissions.tmp");
    try {
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);
      this.log("Write permissions confirmed", "pass");
    } catch (error) {
      this.log(`Write permission error: ${error.message}`, "fail");
      allFilesExist = false;
    }

    return allFilesExist;
  }

  async testEnvironmentVariables() {
    this.log("Testing environment variables...", "info");

    const requiredEnvVars = [
      { name: "NODE_ENV", required: false, default: "development" },
    ];

    const optionalEnvVars = [
      "TTS_EXPRESS_HOST_DEVELOPMENT",
      "TTS_EXPRESS_HOST_PRODUCTION",
      "TTS_EXPRESS_PORT",
      "TTS_EXPRESS_DEFAULT_VOICE",
      "LMS_HOST_DEVELOPMENT",
      "LMS_HOST_PRODUCTION",
      "LMS_PORT",
    ];

    // Test .env file existence
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      this.log(".env file found", "pass");
    } else {
      this.log(".env file not found - using defaults", "warn");
    }

    // Test required variables
    for (const envVar of requiredEnvVars) {
      const value = process.env[envVar.name];
      if (value) {
        this.log(`${envVar.name}=${value}`, "pass");
      } else if (envVar.required) {
        this.log(`Missing required env var: ${envVar.name}`, "fail");
      } else {
        this.log(`${envVar.name} using default: ${envVar.default}`, "info");
      }
    }

    // Test optional variables
    let optionalFound = 0;
    for (const envVar of optionalEnvVars) {
      if (process.env[envVar]) {
        this.log(`${envVar} configured`, "pass");
        optionalFound++;
      }
    }

    this.log(
      `Optional env vars configured: ${optionalFound}/${optionalEnvVars.length}`,
      "info"
    );
    return true;
  }

  async testNetworkPorts() {
    this.log("Testing network port availability...", "info");

    const ports = [
      { port: parseInt(process.env.PORT), name: "Backend Server" },
      { port: parseInt(process.env.TTS_EXPRESS_PORT), name: "TTS Express" },
      { port: parseInt(process.env.LMS_PORT), name: "LM Studio" },
    ];

    const net = require("net");

    for (const portInfo of ports) {
      try {
        await new Promise((resolve, reject) => {
          const server = net.createServer();

          server.listen(portInfo.port, () => {
            server.close(() => {
              this.log(
                `Port ${portInfo.port} (${portInfo.name}) available`,
                "pass"
              );
              resolve();
            });
          });

          server.on("error", (err) => {
            if (err.code === "EADDRINUSE") {
              this.log(
                `Port ${portInfo.port} (${portInfo.name}) in use`,
                "warn"
              );
            } else {
              this.log(`Port ${portInfo.port} error: ${err.message}`, "fail");
            }
            resolve();
          });

          // Timeout after 1 second
          setTimeout(() => {
            server.close(() => {
              this.log(`Port ${portInfo.port} test timeout`, "warn");
              resolve();
            });
          }, 1000);
        });
      } catch (error) {
        this.log(
          `Port test error for ${portInfo.port}: ${error.message}`,
          "fail"
        );
      }
    }

    return true;
  }

  async testDependencies() {
    this.log("Testing npm dependencies...", "info");

    const packageJsonPath = path.join(process.cwd(), "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      this.log("package.json not found", "fail");
      return false;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const nodeModulesPath = path.join(process.cwd(), "node_modules");

    if (!fs.existsSync(nodeModulesPath)) {
      this.log("node_modules not found - run npm install", "fail");
      return false;
    }

    // Check critical dependencies
    const criticalDeps = [
      "express",
      "socket.io",
      "@lmstudio/sdk",
      "dotenv",
      "axios",
    ];

    let allDepsOk = true;

    for (const dep of criticalDeps) {
      const depPath = path.join(nodeModulesPath, dep);
      if (fs.existsSync(depPath)) {
        this.log(`✓ ${dep} installed`, "pass");
      } else {
        this.log(`✗ Missing dependency: ${dep}`, "fail");
        allDepsOk = false;
      }
    }

    return allDepsOk;
  }

  async runAllTests() {
    this.log("=== Starting Environmental Tests ===", "info");

    const tests = [
      this.testNodeVersion(),
      this.testSystemResources(),
      this.testFileSystem(),
      this.testEnvironmentVariables(),
      this.testNetworkPorts(),
      this.testDependencies(),
    ];

    await Promise.all(tests);

    this.log("=== Environmental Test Summary ===", "info");
    this.log(`Passed: ${this.results.passed}`, "pass");
    this.log(
      `Failed: ${this.results.failed}`,
      this.results.failed > 0 ? "fail" : "info"
    );
    this.log(
      `Warnings: ${this.results.warnings}`,
      this.results.warnings > 0 ? "warn" : "info"
    );

    const success = this.results.failed === 0;
    this.log(
      `Overall: ${success ? "ENVIRONMENT OK" : "ENVIRONMENT ISSUES DETECTED"}`,
      success ? "pass" : "fail"
    );

    return {
      success,
      results: this.results,
    };
  }
}

// Export for use in other test files
module.exports = { EnvironmentTester };

// Run if called directly
if (require.main === module) {
  (async () => {
    const tester = new EnvironmentTester();
    const result = await tester.runAllTests();
    process.exit(result.success ? 0 : 1);
  })();
}
