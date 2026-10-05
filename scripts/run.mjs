import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loadEnv } from 'vite'
import { releaseApiOrigin } from './release-api.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const args=process.argv.slice(2)
const release=args.includes('--release')
const uniArgs=args.filter(arg=>arg!=='--release')
const publicApi=release ? releaseApiOrigin(process.env.VITE_HEXU_API||loadEnv('production',root,'VITE_').VITE_HEXU_API) : ''
const child=spawn(process.execPath,[path.join(root,'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js'),...uniArgs],{cwd:root,env:{...process.env,...(release?{VITE_HEXU_API:publicApi}:{}),UNI_INPUT_DIR:root,UNI_OUTPUT_DIR:path.join(root,'dist',uniArgs.includes('build')?'build':'dev',uniArgs.includes('mp-weixin')?'mp-weixin':'h5')},stdio:'inherit'})
child.on('exit',code=>process.exit(code||0))
