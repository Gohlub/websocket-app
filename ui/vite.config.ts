import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// Vite configuration for Hyperware apps
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // IMPORTANT: Base path must be '/' for Hyperware apps
  base: '/',
  
  // Build output configuration
  build: {
    // Output to dist directory (kit build expects this)
    outDir: 'dist',
    
    // Clean the output directory before building
    emptyOutDir: true,
    
    // Generate source maps for debugging
    sourcemap: true,
  },
  
  // Development server configuration
  server: {
    // Use port 5173 for local development
    port: 5173,
    
    // Enable CORS for development
    cors: true,
  },
})