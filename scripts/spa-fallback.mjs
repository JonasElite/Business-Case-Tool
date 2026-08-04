/**
 * Copies dist/index.html to dist/404.html.
 *
 * This app is a client-side routed SPA, so every route has to be answered with
 * index.html. Hosts like Netlify do that via a rewrite rule (public/_redirects),
 * but GitHub Pages has no rewrites — it only lets you supply a 404 page. Serving
 * the app from 404.html makes deep links such as /demo/benchmarking work there:
 * Pages returns the app (with a 404 status, which browsers still render) and
 * react-router then resolves the path.
 *
 * Harmless on hosts that do support rewrites — the extra file is simply unused.
 */
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const index = join(dist, 'index.html')

if (!existsSync(index)) {
  console.error('spa-fallback: dist/index.html not found — run the build first.')
  process.exit(1)
}

copyFileSync(index, join(dist, '404.html'))
console.log('spa-fallback: wrote dist/404.html')
