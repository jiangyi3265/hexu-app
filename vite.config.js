import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import backendProxy from './scripts/backend-proxy.mjs'
// 微信工具会再次转换 async 函数；小程序包保留变量名，避免二次提升后遮蔽模块引用。
const minify = process.env.UNI_PLATFORM === 'mp-weixin' ? false : 'esbuild'
export default defineConfig({ plugins: [uni(),backendProxy()], server: {host:'127.0.0.1', port:4177,proxy:{'/hexu':{target:'http://127.0.0.1:8088',changeOrigin:true}}}, build: {sourcemap:false,minify} })
