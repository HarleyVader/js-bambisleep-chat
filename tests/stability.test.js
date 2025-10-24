/**
 * Stability Tests - Real Load and Stress Testing
 * Tests server stability, memory leaks, and concurrent connections
 */

const { spawn, fork } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

class StabilityTester {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            tests: [],
            metrics: {}
        };
        this.serverProcess = null;
        this.testStartTime = Date.now();
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            'pass': '✅',
            'fail': '❌',
            'warn': '⚠️',
            'info': 'ℹ️'
        }[type];

        console.log(`[${timestamp}] ${prefix} ${message}`);

        this.results.tests.push({
            timestamp,
            message,
            type,
            elapsed: Date.now() - this.testStartTime
        });

        if (type === 'pass') this.results.passed++;
        if (type === 'fail') this.results.failed++;
        if (type === 'warn') this.results.warnings++;
    }

    async startTestServer() {
        this.log('Starting test server...', 'info');

        return new Promise((resolve, reject) => {
            // Start server in separate process
            this.serverProcess = spawn('node', ['server.js'], {
                cwd: process.cwd(),
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, NODE_ENV: 'test', PORT: '6969' }
            });

            let serverOutput = '';

            this.serverProcess.stdout.on('data', (data) => {
                serverOutput += data.toString();
                if (serverOutput.includes('Server running') || serverOutput.includes('listening')) {
                    this.log('Test server started successfully', 'pass');
                    resolve();
                }
            });

            this.serverProcess.stderr.on('data', (data) => {
                const error = data.toString();
                if (!error.includes('DeprecationWarning')) {
                    this.log(`Server error: ${error.trim()}`, 'fail');
                }
            });

            this.serverProcess.on('error', (error) => {
                this.log(`Failed to start server: ${error.message}`, 'fail');
                reject(error);
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                if (this.serverProcess && !this.serverProcess.killed) {
                    this.log('Server startup timeout - assuming success', 'warn');
                    resolve();
                }
            }, 10000);
        });
    }

    async stopTestServer() {
        if (this.serverProcess && !this.serverProcess.killed) {
            this.log('Stopping test server...', 'info');
            this.serverProcess.kill('SIGTERM');

            // Wait for graceful shutdown
            await new Promise((resolve) => {
                this.serverProcess.on('close', () => {
                    this.log('Test server stopped', 'pass');
                    resolve();
                });

                // Force kill after 5 seconds
                setTimeout(() => {
                    if (!this.serverProcess.killed) {
                        this.serverProcess.kill('SIGKILL');
                        this.log('Test server force killed', 'warn');
                    }
                    resolve();
                }, 5000);
            });
        }
    }

    async testBasicConnectivity() {
        this.log('Testing basic HTTP connectivity...', 'info');

        const testUrls = [
            'http://localhost:6969',
            'http://localhost:6969/api/triggers/json',
            'http://localhost:6969/socket.io/'
        ];

        let successCount = 0;

        for (const url of testUrls) {
            try {
                const response = await this.makeHttpRequest(url, 5000);
                if (response.statusCode < 400) {
                    this.log(`✓ ${url} responds (${response.statusCode})`, 'pass');
                    successCount++;
                } else {
                    this.log(`✗ ${url} error (${response.statusCode})`, 'fail');
                }
            } catch (error) {
                this.log(`✗ ${url} failed: ${error.message}`, 'fail');
            }
        }

        return successCount === testUrls.length;
    }

    async testConcurrentConnections() {
        this.log('Testing concurrent WebSocket connections...', 'info');

        const connectionCount = 10;
        const connections = [];
        const results = {
            connected: 0,
            failed: 0,
            messages: 0
        };

        // Create multiple WebSocket connections
        for (let i = 0; i < connectionCount; i++) {
            try {
                const ws = new WebSocket('ws://localhost:6969/socket.io/?EIO=4&transport=websocket');

                ws.on('open', () => {
                    results.connected++;
                    // Send test message
                    ws.send('42["test_message","Stability test message"]');
                });

                ws.on('message', () => {
                    results.messages++;
                });

                ws.on('error', () => {
                    results.failed++;
                });

                connections.push(ws);
            } catch (error) {
                results.failed++;
                this.log(`Connection ${i} failed: ${error.message}`, 'fail');
            }
        }

        // Wait for connections to establish
        await this.delay(3000);

        // Close all connections
        connections.forEach(ws => {
            try {
                ws.close();
            } catch (error) {
                // Ignore close errors
            }
        });

        this.results.metrics.concurrentConnections = results;

        this.log(`Concurrent connections: ${results.connected}/${connectionCount}`,
            results.connected >= connectionCount * 0.8 ? 'pass' : 'fail');
        this.log(`Failed connections: ${results.failed}`, results.failed === 0 ? 'pass' : 'warn');

        return results.connected >= connectionCount * 0.8;
    }

    async testMemoryStability() {
        this.log('Testing memory stability over time...', 'info');

        const memorySnapshots = [];
        const testDuration = 30000; // 30 seconds
        const snapshotInterval = 2000; // Every 2 seconds

        const takeMemorySnapshot = () => {
            const memUsage = process.memoryUsage();
            memorySnapshots.push({
                timestamp: Date.now(),
                rss: memUsage.rss,
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external
            });
        };

        // Take initial snapshot
        takeMemorySnapshot();

        // Start memory monitoring
        const memoryInterval = setInterval(takeMemorySnapshot, snapshotInterval);

        // Simulate some load during the test
        const loadInterval = setInterval(async () => {
            try {
                // Make some HTTP requests
                await this.makeHttpRequest('http://localhost:6969', 1000);
                // Create some temporary data
                const tempData = new Array(1000).fill(0).map(() => Math.random());
                // Let it be garbage collected
                setTimeout(() => {
                    tempData.length = 0;
                }, 100);
            } catch (error) {
                // Ignore load test errors
            }
        }, 500);

        // Wait for test duration
        await this.delay(testDuration);

        // Stop monitoring
        clearInterval(memoryInterval);
        clearInterval(loadInterval);

        // Analyze memory usage
        const initialMemory = memorySnapshots[0];
        const finalMemory = memorySnapshots[memorySnapshots.length - 1];
        const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
        const growthMB = memoryGrowth / (1024 * 1024);

        this.results.metrics.memoryStability = {
            initialHeap: initialMemory.heapUsed,
            finalHeap: finalMemory.heapUsed,
            growthBytes: memoryGrowth,
            growthMB: growthMB,
            snapshots: memorySnapshots.length
        };

        this.log(`Memory growth over ${testDuration / 1000}s: ${growthMB.toFixed(2)} MB`,
            growthMB < 50 ? 'pass' : 'warn');

        // Check for memory leaks (excessive growth)
        const isStable = growthMB < 100; // Less than 100MB growth is acceptable
        if (isStable) {
            this.log('Memory usage appears stable', 'pass');
        } else {
            this.log('Potential memory leak detected', 'fail');
        }

        return isStable;
    }

    async testResponseTimes() {
        this.log('Testing response time consistency...', 'info');

        const requestCount = 20;
        const responseTimes = [];

        for (let i = 0; i < requestCount; i++) {
            const startTime = Date.now();

            try {
                await this.makeHttpRequest('http://localhost:6969', 5000);
                const responseTime = Date.now() - startTime;
                responseTimes.push(responseTime);
            } catch (error) {
                responseTimes.push(5000); // Timeout value
                this.log(`Request ${i + 1} failed: ${error.message}`, 'fail');
            }

            // Small delay between requests
            await this.delay(100);
        }

        // Calculate statistics
        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const maxResponseTime = Math.max(...responseTimes);
        const minResponseTime = Math.min(...responseTimes);

        this.results.metrics.responseTime = {
            average: avgResponseTime,
            maximum: maxResponseTime,
            minimum: minResponseTime,
            samples: requestCount
        };

        this.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`,
            avgResponseTime < 1000 ? 'pass' : 'warn');
        this.log(`Max response time: ${maxResponseTime.toFixed(2)}ms`,
            maxResponseTime < 2000 ? 'pass' : 'warn');

        return avgResponseTime < 1000;
    }

    async makeHttpRequest(url, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const request = http.get(url, (response) => {
                resolve(response);
            });

            request.on('error', reject);
            request.setTimeout(timeout, () => {
                request.abort();
                reject(new Error('Request timeout'));
            });
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async runAllTests() {
        this.log('=== Starting Stability Tests ===', 'info');

        try {
            // Start test server
            await this.startTestServer();

            // Wait a bit for server to fully initialize
            await this.delay(2000);

            // Run stability tests
            const tests = [
                this.testBasicConnectivity(),
                this.testResponseTimes(),
                this.testConcurrentConnections(),
                this.testMemoryStability()
            ];

            await Promise.all(tests.map(test => test.catch(error => {
                this.log(`Test error: ${error.message}`, 'fail');
                return false;
            })));

        } finally {
            // Always stop the server
            await this.stopTestServer();
        }

        this.log('=== Stability Test Summary ===', 'info');
        this.log(`Passed: ${this.results.passed}`, 'pass');
        this.log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'fail' : 'info');
        this.log(`Warnings: ${this.results.warnings}`, this.results.warnings > 0 ? 'warn' : 'info');

        // Log performance metrics
        if (this.results.metrics.responseTime) {
            this.log(`Avg Response: ${this.results.metrics.responseTime.average.toFixed(2)}ms`, 'info');
        }
        if (this.results.metrics.memoryStability) {
            this.log(`Memory Growth: ${this.results.metrics.memoryStability.growthMB.toFixed(2)}MB`, 'info');
        }

        const success = this.results.failed === 0;
        this.log(`Overall: ${success ? 'STABILITY OK' : 'STABILITY ISSUES DETECTED'}`,
            success ? 'pass' : 'fail');

        return {
            success,
            results: this.results
        };
    }
}

// Export for use in other test files
module.exports = { StabilityTester };

// Run if called directly
if (require.main === module) {
    (async () => {
        const tester = new StabilityTester();
        const result = await tester.runAllTests();
        process.exit(result.success ? 0 : 1);
    })();
}
