import fs from 'node:fs'

// Node tests load the app's ESM helpers without changing the uni-app package type.
function moduleUrl(url) {
  const source = fs.readFileSync(url, 'utf8').replace(/from\s+(['"])(\.\/[^'"]+)\1/g,
    (_, quote, path) => 'from ' + quote + moduleUrl(new URL(path, url)) + quote)
  return 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
}

export const loadPure = name => import(moduleUrl(new URL('../../data/' + name, import.meta.url)))
