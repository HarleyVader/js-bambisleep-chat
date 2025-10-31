#!/usr/bin/env node

/**
 * MCP Server Manager for BambiSleep Chat
 * Initializes and manages Model Context Protocol servers
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class MCPManager {
    constructor() {
        this.configPath = path.join(__dirname, '..', '..', '.vscode', 'mcp-settings.json');
        this.envPath = path.join(__dirname, '..', '..', '.env.mcp');
        this.servers = new Map();
    }

    async loadConfig() {
        try {
            const configData = fs.readFileSync(this.configPath, 'utf8');
            this.config = JSON.parse(configData);
            console.log('✅ MCP configuration loaded successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to load MCP configuration:', error.message);
            return false;
        }
    }

    async loadEnvironment() {
        if (fs.existsSync(this.envPath)) {
            const envData = fs.readFileSync(this.envPath, 'utf8');
            const lines = envData.split('\n');

            for (const line of lines) {
                if (line.trim() && !line.startsWith('#')) {
                    const [key, value] = line.split('=');
                    if (key && value) {
                        process.env[key.trim()] = value.trim();
                    }
                }
            }
            console.log('✅ MCP environment variables loaded');
        } else {
            console.log('⚠️  No .env.mcp file found - using system environment variables');
        }
    }

    async testServer(serverName, serverConfig) {
        return new Promise((resolve) => {
            console.log(`🔄 Testing MCP server: ${serverName}`);

            const childProcess = spawn(serverConfig.command, serverConfig.args, {
                env: { ...process.env, ...serverConfig.env },
                stdio: 'pipe'
            });

            let output = '';

            childProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            childProcess.stderr.on('data', (data) => {
                output += data.toString();
            });

            const timeout = setTimeout(() => {
                childProcess.kill();
                console.log(`✅ ${serverName}: Server responsive`);
                resolve(true);
            }, 2000);

            childProcess.on('close', (code) => {
                clearTimeout(timeout);
                if (code === 0 || output.includes('available')) {
                    console.log(`✅ ${serverName}: Ready`);
                    resolve(true);
                } else {
                    console.log(`⚠️  ${serverName}: May need configuration`);
                    resolve(false);
                }
            });

            childProcess.on('error', (error) => {
                clearTimeout(timeout);
                console.log(`⚠️  ${serverName}: ${error.message}`);
                resolve(false);
            });
        });
    }

    async startAll() {
        console.log('🚀 Starting MCP Server Manager...\n');

        await this.loadEnvironment();

        if (!(await this.loadConfig())) {
            return false;
        }

        console.log('📋 Available MCP Servers:');
        for (const [name, config] of Object.entries(this.config.mcpServers)) {
            console.log(`   • ${name}: ${config.description || 'MCP Server'}`);
        }
        console.log('');

        let successCount = 0;
        const totalServers = Object.keys(this.config.mcpServers).length;

        for (const [name, config] of Object.entries(this.config.mcpServers)) {
            const success = await this.testServer(name, config);
            if (success) successCount++;
        }

        console.log(`\n📊 MCP Server Status: ${successCount}/${totalServers} servers ready`);

        if (successCount === totalServers) {
            console.log('🎉 All MCP servers are configured and ready!');
        } else {
            console.log('⚠️  Some servers may need additional configuration.');
            console.log('💡 Check .env.mcp file for required API keys and settings.');
        }

        return true;
    }

    async status() {
        console.log('📊 MCP Server Status Check...\n');

        if (!(await this.loadConfig())) {
            return false;
        }

        console.log('Available MCP Tools:');
        console.log('━'.repeat(50));

        const toolCategories = {
            'github_releases': '🐙 GitHub: Repository releases, tags, team management',
            'filesystem': '📁 Files: Project file operations and search',
            'mongodb': '🍃 Database: MongoDB operations and queries',
            'stripe': '💳 Payments: Subscription and payment management',
            'huggingface': '🤗 AI: Models, datasets, and ML resources',
            'azure_quantum': '⚛️  Quantum: Azure Quantum computing',
            'microsoft_clarity': '📊 Analytics: Web analytics and insights',
            'ecl_extension': '🏭 Enterprise: HPCC Systems integration'
        };

        for (const [name, description] of Object.entries(toolCategories)) {
            const isConfigured = this.config.mcpServers[name] ? '✅' : '❌';
            console.log(`${isConfigured} ${description}`);
        }

        console.log('\n💡 To configure servers, edit .env.mcp with your API keys');
        return true;
    }
}

// CLI interface
async function main() {
    const manager = new MCPManager();
    const args = process.argv.slice(2);

    switch (args[0]) {
        case 'start':
            await manager.startAll();
            break;
        case 'status':
            await manager.status();
            break;
        default:
            console.log('🔧 MCP Server Manager Commands:');
            console.log('   node mcp-manager.js start   - Start and test all servers');
            console.log('   node mcp-manager.js status  - Show server status');
            break;
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = MCPManager;