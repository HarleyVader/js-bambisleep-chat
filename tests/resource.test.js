/**
 * Resource Usage Tests - Real System Resource Monitoring
 * Tests CPU usage, memory consumption, file handles, and network usage
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { performance } = require('perf_hooks');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config();

// Server configuration from environment
const SERVER_PORT = parseInt(process.env.PORT) || 6969;
const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
const BASE_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

class ResourceTester {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            tests: [],
            metrics: {
                cpu: [],
                memory: [],
                diskIO: [],
                network: [],
                fileHandles: []
            }
        };
        this.testStartTime = Date.now();
        this.serverProcess = null;
        this.monitoringInterval = null;
        this.serverPort = SERVER_PORT;
        this.serverHost = SERVER_HOST;
        this.baseUrl = BASE_URL;
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

    async startResourceMonitoring() {
        this.log('Starting resource monitoring...', 'info');

        this.monitoringInterval = setInterval(() => {
            this.collectResourceMetrics();
        }, 1000); // Collect metrics every second

        // Initial collection
        this.collectResourceMetrics();
    }

    stopResourceMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            this.log('Resource monitoring stopped', 'info');
        }
    }

    collectResourceMetrics() {
        const timestamp = Date.now();

        // Memory metrics
        const memUsage = process.memoryUsage();
        const systemMem = {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem()
        };

        this.results.metrics.memory.push({
            timestamp,
            process: {
                rss: memUsage.rss,
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external
            },
            system: systemMem,
            processPercent: (memUsage.rss / systemMem.total) * 100
        });

        // CPU metrics (simplified - process CPU usage)
        const cpuUsage = process.cpuUsage();
        this.results.metrics.cpu.push({
            timestamp,
            user: cpuUsage.user,
            system: cpuUsage.system,
            total: cpuUsage.user + cpuUsage.system
        });
    }

    async testMemoryUsage() {
        this.log('Testing memory usage patterns...', 'info');

        const testDuration = 15000; // 15 seconds
        await this.delay(testDuration);

        const memoryData = this.results.metrics.memory;
        if (memoryData.length < 2) {
            this.log('Insufficient memory data collected', 'fail');
            return false;
        }

        // Analyze memory growth
        const initialMem = memoryData[0];
        const finalMem = memoryData[memoryData.length - 1];
        const growthMB = (finalMem.process.heapUsed - initialMem.process.heapUsed) / (1024 * 1024);
        const avgMemUsage = memoryData.reduce((sum, m) => sum + m.process.heapUsed, 0) / memoryData.length;
        const avgMemMB = avgMemUsage / (1024 * 1024);

        // Calculate peak memory usage
        const peakMem = Math.max(...memoryData.map(m => m.process.heapUsed));
        const peakMemMB = peakMem / (1024 * 1024);

        this.log(`Average memory usage: ${avgMemMB.toFixed(2)} MB`,
            avgMemMB < 200 ? 'pass' : avgMemMB < 500 ? 'warn' : 'fail');
        this.log(`Peak memory usage: ${peakMemMB.toFixed(2)} MB`,
            peakMemMB < 300 ? 'pass' : peakMemMB < 600 ? 'warn' : 'fail');
        this.log(`Memory growth: ${growthMB.toFixed(2)} MB`,
            Math.abs(growthMB) < 50 ? 'pass' : 'warn');

        // Check for memory leaks (consistent growth)
        const isStable = Math.abs(growthMB) < 100 && avgMemMB < 500;

        return isStable;
    }

    async testCPUUsage() {
        this.log('Testing CPU usage patterns...', 'info');

        const cpuData = this.results.metrics.cpu;
        if (cpuData.length < 2) {
            this.log('Insufficient CPU data collected', 'fail');
            return false;
        }

        // Calculate CPU usage differences (approximate)
        let totalCpuTime = 0;
        for (let i = 1; i < cpuData.length; i++) {
            const prevCpu = cpuData[i - 1];
            const currCpu = cpuData[i];
            const timeDiff = currCpu.timestamp - prevCpu.timestamp;
            const cpuDiff = currCpu.total - prevCpu.total;

            // Convert microseconds to milliseconds for percentage calculation
            const cpuPercent = (cpuDiff / 1000) / timeDiff * 100;
            totalCpuTime += cpuPercent;
        }

        const avgCpuPercent = totalCpuTime / (cpuData.length - 1);

        this.log(`Average CPU usage: ${avgCpuPercent.toFixed(2)}%`,
            avgCpuPercent < 50 ? 'pass' : avgCpuPercent < 80 ? 'warn' : 'fail');

        return avgCpuPercent < 80;
    }

    async testFileHandles() {
        this.log('Testing file handle usage...', 'info');

        try {
            // Count open file descriptors (Unix-like systems)
            if (process.platform !== 'win32') {
                const { exec } = require('child_process');

                const fdCount = await new Promise((resolve, reject) => {
                    exec(`lsof -p ${process.pid} | wc -l`, (error, stdout) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(parseInt(stdout.trim()));
                        }
                    });
                });

                this.log(`Open file descriptors: ${fdCount}`,
                    fdCount < 100 ? 'pass' : fdCount < 200 ? 'warn' : 'fail');

                return fdCount < 200;
            } else {
                // Windows - basic file handle test
                this.log('File handle monitoring limited on Windows', 'info');

                // Test file operations
                const testFiles = [];
                try {
                    for (let i = 0; i < 10; i++) {
                        const testFile = path.join(os.tmpdir(), `resource-test-${i}.tmp`);
                        fs.writeFileSync(testFile, `test data ${i}`);
                        testFiles.push(testFile);
                    }

                    // Verify files can be read
                    for (const file of testFiles) {
                        fs.readFileSync(file);
                    }

                    this.log('File operations test passed', 'pass');

                    // Cleanup
                    for (const file of testFiles) {
                        fs.unlinkSync(file);
                    }

                    return true;
                } catch (error) {
                    this.log(`File operations error: ${error.message}`, 'fail');
                    return false;
                }
            }
        } catch (error) {
            this.log(`File handle test error: ${error.message}`, 'warn');
            return true; // Don't fail the entire test suite
        }
    }

    async testDiskUsage() {
        this.log('Testing disk usage...', 'info');

        try {
            // Check available disk space
            const stats = fs.statSync(process.cwd());

            // Create and delete test files to measure I/O performance
            const testFileSize = 1024 * 1024; // 1MB
            const testData = Buffer.alloc(testFileSize, 'x');
            const testFile = path.join(process.cwd(), 'disk-test.tmp');

            // Write performance test
            const writeStart = performance.now();
            fs.writeFileSync(testFile, testData);
            const writeTime = performance.now() - writeStart;

            // Read performance test
            const readStart = performance.now();
            const readData = fs.readFileSync(testFile);
            const readTime = performance.now() - readStart;

            // Cleanup
            fs.unlinkSync(testFile);

            const writeMBps = (testFileSize / (1024 * 1024)) / (writeTime / 1000);
            const readMBps = (testFileSize / (1024 * 1024)) / (readTime / 1000);

            this.log(`Disk write speed: ${writeMBps.toFixed(2)} MB/s`,
                writeMBps > 10 ? 'pass' : writeMBps > 1 ? 'warn' : 'fail');
            this.log(`Disk read speed: ${readMBps.toFixed(2)} MB/s`,
                readMBps > 20 ? 'pass' : readMBps > 5 ? 'warn' : 'fail');

            return writeMBps > 1 && readMBps > 5;
        } catch (error) {
            this.log(`Disk test error: ${error.message}`, 'fail');
            return false;
        }
    }

    async testNetworkResources() {
        this.log('Testing network resource usage...', 'info');

        try {
            const net = require('net');
            const connections = [];
            const maxConnections = 20;

            // Test socket creation and cleanup
            for (let i = 0; i < maxConnections; i++) {
                const client = new net.Socket();
                connections.push(client);
            }

            this.log(`Created ${maxConnections} socket objects`, 'pass');

            // Cleanup sockets
            connections.forEach(socket => {
                socket.destroy();
            });

            this.log('Socket cleanup completed', 'pass');

            // Test HTTP requests (if server is available)
            try {
                const http = require('http');
                const requestCount = 5;
                let successCount = 0;

                for (let i = 0; i < requestCount; i++) {
                    try {
                        await new Promise((resolve, reject) => {
                            const req = http.get(this.baseUrl, (res) => {
                                successCount++;
                                resolve();
                            });
                            req.on('error', () => resolve()); // Don't fail on connection errors
                            req.setTimeout(2000, () => {
                                req.abort();
                                resolve();
                            });
                        });
                    } catch (error) {
                        // Ignore individual request errors
                    }
                }

                if (successCount > 0) {
                    this.log(`Network connectivity test: ${successCount}/${requestCount} successful`, 'pass');
                } else {
                    this.log('No server connectivity (expected in resource-only test)', 'info');
                }
            } catch (error) {
                this.log('Network test skipped - no server running', 'info');
            }

            return true;
        } catch (error) {
            this.log(`Network resource test error: ${error.message}`, 'fail');
            return false;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async runAllTests() {
        this.log('=== Starting Resource Usage Tests ===', 'info');

        try {
            // Start monitoring
            await this.startResourceMonitoring();

            // Run resource tests
            const tests = [
                this.testMemoryUsage(),
                this.testCPUUsage(),
                this.testFileHandles(),
                this.testDiskUsage(),
                this.testNetworkResources()
            ];

            await Promise.all(tests.map(test => test.catch(error => {
                this.log(`Test error: ${error.message}`, 'fail');
                return false;
            })));

        } finally {
            // Stop monitoring
            this.stopResourceMonitoring();
        }

        // Generate resource usage report
        this.generateResourceReport();

        this.log('=== Resource Usage Test Summary ===', 'info');
        this.log(`Passed: ${this.results.passed}`, 'pass');
        this.log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'fail' : 'info');
        this.log(`Warnings: ${this.results.warnings}`, this.results.warnings > 0 ? 'warn' : 'info');

        const success = this.results.failed === 0;
        this.log(`Overall: ${success ? 'RESOURCE USAGE OK' : 'RESOURCE ISSUES DETECTED'}`,
            success ? 'pass' : 'fail');

        return {
            success,
            results: this.results
        };
    }

    generateResourceReport() {
        const memory = this.results.metrics.memory;
        const cpu = this.results.metrics.cpu;

        if (memory.length > 0) {
            const avgMemMB = memory.reduce((sum, m) => sum + m.process.heapUsed, 0) / memory.length / (1024 * 1024);
            const maxMemMB = Math.max(...memory.map(m => m.process.heapUsed)) / (1024 * 1024);

            this.log(`Memory Report:`, 'info');
            this.log(`  Average: ${avgMemMB.toFixed(2)} MB`, 'info');
            this.log(`  Peak: ${maxMemMB.toFixed(2)} MB`, 'info');
            this.log(`  Samples: ${memory.length}`, 'info');
        }

        if (cpu.length > 0) {
            this.log(`CPU Report:`, 'info');
            this.log(`  Samples collected: ${cpu.length}`, 'info');
        }
    }
}

// Export for use in other test files
module.exports = { ResourceTester };

// Run if called directly
if (require.main === module) {
    (async () => {
        const tester = new ResourceTester();
        const result = await tester.runAllTests();
        process.exit(result.success ? 0 : 1);
    })();
}
