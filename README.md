# Value Intelligence Suite — AI Business Case Tool

Website built from the Figma design at
https://www.figma.com/design/GrCD4g9W3EAsUIZWfnTcjQ/Value-Intelligence-Suite.

A React + Vite single-page application: a marketing landing page plus the
interactive business case tool (client profiling, benchmarking, use case value
drivers, NPV/ROI/TCO simulation).

## Requirements

- Node.js 20 or newer
- npm (a `package-lock.json` is committed for reproducible installs)

## Development

```bash
npm install     # install dependencies
npm run dev     # dev server with hot reload, http://localhost:5173
```

To just run the finished site rather than work on it, see
[Hosting it locally](#hosting-it-locally).

## Hosting it locally

`npm start` builds the site and serves it — this is the way to run it on your
own machine or an internal server, with no cloud deployment involved:

```bash
npm install
npm start                        # http://localhost:4173
```

Once a build exists, `npm run serve` starts the server without rebuilding.
After changing the code, run `npm run build` again (or just `npm start`).

```bash
npm run serve                      # serve the existing build
npm run serve -- --port 8080       # different port
npm run serve -- --host            # also reachable on the local network
```

`--host` binds to all interfaces and prints the network URL, so colleagues on
the same network can open the tool. Without it the server listens on localhost
only and nobody else can reach it. There is no authentication built in, so use
`--host` only on a network you trust.

The server (`scripts/serve.mjs`) has no dependencies beyond Node and behaves
like a static host: correct MIME types, gzip for text assets, long-lived
caching for the hashed files in `assets/`, and the SPA fallback that makes
deep links work. To run it behind a reverse proxy on a sub-path, build and
serve with the same `BASE_PATH`:

```bash
BASE_PATH=/tool npm run build
BASE_PATH=/tool npm run serve      # http://localhost:4173/tool/
```

Alternatively `npm run preview` starts Vite's own preview server — fine for a
quick look, but it is a development tool and not meant for hosting.

## Production build

```bash
npm run build   # emits static files to dist/
```

The output in `dist/` is fully static and can also be handed to any existing
web server (see [Deploying elsewhere](#deploying-elsewhere)).

## Pages

| Route                    | Content                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| `/`                      | Landing page (hero, feature strip, how it works, call to action) |
| `/demo`                  | Tool in demo mode — client profile setup                         |
| `/demo/benchmarking`     | Subprocess summary and benchmark comparison                      |
| `/demo/business-case`    | AI / ERP / TOM use cases with business case simulation           |
| `/project`               | Same tool in project mode                                        |
| `/project/benchmarking`  | Subprocess summary and benchmark comparison                      |
| `/project/business-case` | AI / ERP / TOM use cases with business case simulation           |
| `/aipip`                 | AI Powered Invoice Processing overview                           |
| `/aipip/simulator`       | AIPIP business case simulator                                    |

## Deploying elsewhere

If you serve `dist/` with a web server of your own instead of `npm run serve`,
remember this is a client-side routed SPA: the host must answer every path
with `index.html`, otherwise a direct hit on e.g. `/demo/benchmarking` gives a
404. `public/_redirects` covers Netlify-style hosts. Equivalents:

- **nginx** — `try_files $uri $uri/ /index.html;`
- **Apache** — `FallbackResource /index.html`
- **Vercel** — `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }` in `vercel.json`
- **Hosts with no rewrites** (e.g. GitHub Pages) — `npm run build` also writes
  `dist/404.html` via `scripts/spa-fallback.mjs`, which such hosts serve for
  unknown paths so react-router can resolve them. If the site is not at the
  domain root, build with `BASE_PATH=/<sub-path>`.

## Project structure

```
src/
  main.tsx              app entry, mounts <App /> and loads global styles
  styles/index.css      Tailwind v4 setup, shadcn design tokens, base typography
  app/
    routes.tsx          route definitions (react-router)
    pages/              one file per page
    components/         layout, wizard and modal components
    components/ui/      shadcn/ui component library
    context/            shared app state
    data/, utils/       mock data, formatting and formula helpers
  imports/              images exported from Figma
scripts/
  serve.mjs             dependency-free static server for local hosting
  spa-fallback.mjs      writes dist/404.html after the build
```

State is held in React context and persisted to `localStorage`; there is no
backend to configure.

## Attributions

See [ATTRIBUTIONS.md](./ATTRIBUTIONS.md).
