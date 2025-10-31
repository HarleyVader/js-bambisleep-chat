import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    const env = loadEnv(mode, process.cwd(), '')

    const serverPort = parseInt(env.PORT) || 7878
    const vitePort = parseInt(env.VITE_PORT) || 5173

    console.log(`🚀 Vite Dev Server: http://localhost:${vitePort}`)
    console.log(`🔄 Proxying to Express: http://localhost:${serverPort}`)

    return {
        plugins: [react({
            // Fast Refresh configuration
            include: "**/*.{jsx,tsx}",
        })],

        // Set correct root for React app
        root: './src/client',
        publicDir: false, // We'll serve static files from Express

        server: {
            port: vitePort,
            host: '0.0.0.0',
            strictPort: true,
            // Prevent crashes by handling errors gracefully
            hmr: {
                port: vitePort + 1,
                host: 'localhost'
            },
            proxy: {
                // API routes to Express server
                '^/api/.*': {
                    target: `http://localhost:${serverPort}`,
                    changeOrigin: true,
                    secure: false,
                    timeout: 30000,
                    configure: (proxy, options) => {
                        proxy.on('error', (err, req, res) => {
                            console.log('Proxy error:', err.message)
                        })
                        proxy.on('proxyReq', (proxyReq, req, res) => {
                            console.log('Proxying:', req.method, req.url)
                        })
                    }
                },
                // Socket.IO to Express server
                '^/socket.io/.*': {
                    target: `http://localhost:${serverPort}`,
                    ws: true,
                    changeOrigin: true,
                    secure: false,
                    timeout: 30000,
                    configure: (proxy, options) => {
                        proxy.on('error', (err, req, res) => {
                            console.log('Socket.IO proxy error:', err.message)
                        })
                    }
                },
                // Serve static assets from public directory via Express
                '^/(css|js|docs)/.*': {
                    target: `http://localhost:${serverPort}`,
                    changeOrigin: true,
                    secure: false
                }
            }
        },

        build: {
            outDir: '../../dist/client',
            emptyOutDir: true,
            sourcemap: true,
            rollupOptions: {
                input: './src/client/index.html',
                output: {
                    manualChunks: {
                        vendor: ['react', 'react-dom'],
                        socket: ['socket.io-client']
                    }
                }
            }
        },

        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
                '@client': fileURLToPath(new URL('./src/client', import.meta.url)),
                '@server': fileURLToPath(new URL('./src/server', import.meta.url))
            }
        },

        // Optimize dependencies
        optimizeDeps: {
            include: ['react', 'react-dom', 'socket.io-client']
        },

        // Better error handling
        define: {
            __DEV__: mode === 'development',
        }
    }
})
