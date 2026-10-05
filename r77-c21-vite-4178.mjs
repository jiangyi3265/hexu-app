process.env.VITE_HEXU_API = 'http://127.0.0.1:8089'
process.argv = [process.argv[0], 'scripts/run.mjs', '-p', 'h5', '--host', '127.0.0.1', '--port', '4178']
await import('./scripts/run.mjs')
