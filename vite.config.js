import { defineConfig } from 'vite'

export default defineConfig({
  root: 'public',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:6969',
      '/socket.io': {
        target: 'http://localhost:6969',
        ws: true
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
