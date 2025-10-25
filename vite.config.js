import { defineConfig, loadEnv } from 'vite'
import path from 'path'

export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    const env = loadEnv(mode, process.cwd(), '')

    const serverPort = parseInt(env.PORT) || 6969
    const vitePort = parseInt(env.VITE_PORT) || 5173

    return {
        root: 'public',
        server: {
            port: vitePort,
            host: true,
            proxy: {
                '/api': {
                    target: `http://localhost:${serverPort}`,
                    changeOrigin: true
                },
                '/socket.io': {
                    target: `http://localhost:${serverPort}`,
                    ws: true,
                    changeOrigin: true,
                    secure: false,
                    timeout: 60000,
                    proxyTimeout: 60000
                }
            }
        },
        build: {
            outDir: '../dist',
            emptyOutDir: true,
            rollupOptions: {
                input: {
                    main: 'public/index.html'
                }
            }
        }
    }
})
