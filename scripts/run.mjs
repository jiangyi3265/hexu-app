import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loadEnv } from 'vite'
import { releaseApiOrigin } from './release-api.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const args=process.argv.slice(2)
const release=args.includes('--release')
const uniArgs=args.filter(arg=>arg!=='--release')
const localMp=uniArgs.includes('mp-weixin')&&!release
const publicApi=release ? releaseApiOrigin(process.env.VITE_HEXU_API||loadEnv('production',root,'VITE_').VITE_HEXU_API) : ''
const apiOverride=release?publicApi:localMp?(process.env.VITE_HEXU_API||'http://127.0.0.1:8088'):''
const env={...process.env,...(apiOverride?{VITE_HEXU_API:apiOverride}:{}),UNI_INPUT_DIR:root,UNI_OUTPUT_DIR:path.join(root,'dist',uniArgs.includes('build')?'build':'dev',uniArgs.includes('mp-weixin')?'mp-weixin':'h5')}
const child=spawn(process.execPath,[path.join(root,'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js'),...uniArgs],{cwd:root,env,stdio:'inherit'})
child.on('exit',code=>process.exit(code||0))
