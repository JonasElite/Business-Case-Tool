/**
 * Static server for the production build in dist/ — for hosting the site
 * locally, on your own machine or an internal server.
 *
 * Zero dependencies, runs on plain Node. It does what a static host would:
 * correct MIME types, gzip for text assets, long-lived caching for the hashed
 * files in assets/, and the SPA fallback that makes deep links such as
 * /demo/benchmarking work.
 *
 * Usage:
 *   npm start                      build, then serve on http://localhost:4173
 *   npm run serve                  serve an existing build
 *   npm run serve -- --port 8080   pick a port
 *   npm run serve -- --host        also listen on the local network
 *
 * Environment variables PORT, HOST and BASE_PATH work as well; the flags win.
 */
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

// ---------------------------------------------------------------- arguments

const argv = process.argv.slice(2)

function flag(name) {
  const i = argv.indexOf(`--${name}`)
  if (i === -1) return undefined
  const next = argv[i + 1]
  return next && !next.startsWith('--') ? next : true
}

const port = Number(flag('port') ?? process.env.PORT ?? 4173)
const hostFlag = flag('host')
// Default to loopback: reachable from this machine only. `--host` (or
// `--host 0.0.0.0`) opens the site up to everyone on the local network.
const host =
  typeof hostFlag === 'string'
    ? hostFlag
    : hostFlag === true
      ? '0.0.0.0'
      : (process.env.HOST ?? '127.0.0.1')

// Sub-path the build was made for, e.g. BASE_PATH=/tool for hosting behind a
// reverse proxy. Must match the BASE_PATH used at build time.
const rawBase = String(flag('base') ?? process.env.BASE_PATH ?? '/')
const base = rawBase === '/' ? '/' : `/${rawBase.replace(/^\/+|\/+$/g, '')}/`

// ------------------------------------------------------------------ serving

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

const COMPRESSIBLE = new Set([
  '.html', '.js', '.mjs', '.css', '.json', '.svg', '.csv', '.txt', '.map',
])

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error('No build found in dist/. Run `npm run build` first.')
  process.exit(1)
}

const indexHtml = join(ROOT, 'index.html')

function contentType(file) {
  return MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'
}

function send(req, res, file, status = 200) {
  const type = contentType(file)
  // Hashed filenames in assets/ never change content; everything else,
  // index.html above all, has to be revalidated so updates are picked up.
  const immutable = file.includes(`${sep}assets${sep}`)
  const headers = {
    'content-type': type,
    'cache-control': immutable
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  }

  const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')
  if (acceptsGzip && COMPRESSIBLE.has(extname(file).toLowerCase())) {
    const body = gzipSync(readFileSync(file))
    res.writeHead(status, {
      ...headers,
      'content-encoding': 'gzip',
      'content-length': body.length,
      vary: 'Accept-Encoding',
    })
    res.end(req.method === 'HEAD' ? undefined : body)
    return
  }

  headers['content-length'] = statSync(file).size
  res.writeHead(status, headers)
  if (req.method === 'HEAD') return res.end()
  createReadStream(file).pipe(res)
}

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end('Method Not Allowed')
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  } catch {
    res.writeHead(400).end('Bad Request')
    return
  }

  // When serving under a sub-path, send everything outside it to the app root.
  if (base !== '/') {
    if (pathname === base.slice(0, -1)) {
      res.writeHead(301, { location: base }).end()
      return
    }
    if (!pathname.startsWith(base)) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end(`Not found. The site is served at ${base}`)
      return
    }
    pathname = `/${pathname.slice(base.length)}`
  }

  // Resolve inside dist/ only — never let a request escape the build folder.
  const target = resolve(ROOT, `.${normalize(pathname)}`)
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    res.writeHead(403).end('Forbidden')
    return
  }

  if (existsSync(target) && statSync(target).isFile()) {
    send(req, res, target)
    return
  }

  const indexFile = join(target, 'index.html')
  if (existsSync(indexFile) && statSync(indexFile).isFile()) {
    send(req, res, indexFile)
    return
  }

  // A missing file with an extension is a genuine 404 — a missing route is
  // not, so it gets the app and react-router takes over.
  if (extname(pathname)) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('Not Found')
    return
  }

  send(req, res, indexHtml)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${port} is already in use. Pick another one, e.g. ` +
        `\`npm run serve -- --port ${port + 1}\`.`,
    )
    process.exit(1)
  }
  throw err
})

server.listen(port, host, () => {
  const shown = host === '0.0.0.0' || host === '::' ? 'localhost' : host
  console.log(`\n  Business Case Tool — serving dist/\n`)
  console.log(`  Local:    http://${shown}:${port}${base}`)

  if (host === '0.0.0.0' || host === '::') {
    for (const entries of Object.values(networkInterfaces())) {
      for (const net of entries ?? []) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`  Network:  http://${net.address}:${port}${base}`)
        }
      }
    }
    console.log('\n  Reachable by anyone on your local network.')
  }

  console.log('\n  Press Ctrl+C to stop.\n')
})
