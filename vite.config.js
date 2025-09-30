import { defineConfig } from 'vite'

export default defineConfig({
    root: 'public',
    server: {
        port: 5173,
        host: true,
        proxy: {
            '/api': {
                target: 'http://localhost:6969',
                changeOrigin: true
            },
            '/socket.io': {
                target: 'http://localhost:6969',
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
})
