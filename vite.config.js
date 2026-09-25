import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import backendProxy from './scripts/backend-proxy.mjs'
export default defineConfig({ plugins: [uni(),backendProxy()], server: {host:'127.0.0.1', port:4177,proxy:{'/hexu':{target:'http://127.0.0.1:8088',changeOrigin:true}}}, build: {sourcemap:false} })
