import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const child=spawn(process.execPath,[path.join(root,'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js'),...process.argv.slice(2)],{cwd:root,env:{...process.env,UNI_INPUT_DIR:root,UNI_OUTPUT_DIR:path.join(root,'dist',process.argv.includes('build')?'build':'dev',process.argv.includes('mp-weixin')?'mp-weixin':'h5')},stdio:'inherit'})
child.on('exit',code=>process.exit(code||0))
