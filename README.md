# Value Intelligence Suite — AI Business Case Tool

Website built from the Figma design at
https://www.figma.com/design/GrCD4g9W3EAsUIZWfnTcjQ/Value-Intelligence-Suite.

A React + Vite single-page application: a marketing landing page plus the
interactive business case tool (client profiling, benchmarking, use case value
drivers, NPV/ROI/TCO simulation).

## Requirements

- Node.js 20 or newer
- npm (a `package-lock.json` is committed for reproducible installs)

## Running the site

```bash
npm install     # install dependencies
npm run dev     # dev server with hot reload, http://localhost:5173
```

## Production build

```bash
npm run build   # emits static files to dist/
npm run preview # serve the built dist/ locally to verify
```

The build output in `dist/` is fully static and can be served by any web
server or static host.

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

## Deploying to GitHub Pages

`.github/workflows/deploy-pages.yml` builds and publishes the site on every
push to `main`, and can also be started manually from the Actions tab.

One-time setup in the repository: **Settings → Pages → Build and deployment →
Source: GitHub Actions**. The site is then served at
`https://<owner>.github.io/<repo>/`. Note that Pages for a *private*
repository requires a paid GitHub plan; on the free plan the repository has
to be public.

Two details make a project site work, both already wired up:

- **Sub-path** — a project site lives under `/<repo>/`, not at the domain
  root. The workflow passes `BASE_PATH` (from `actions/configure-pages`) into
  the build, which sets Vite's `base`; the router picks the same value up via
  `import.meta.env.BASE_URL` as its `basename`. With a custom domain
  `base_path` is empty and the site builds for the root instead — no change
  needed.
- **Deep links** — Pages has no rewrite rules, so `npm run build` also writes
  `dist/404.html` (see `scripts/spa-fallback.mjs`). Pages answers unknown
  paths like `/demo/benchmarking` with it, and react-router resolves the route
  client-side. The HTTP status of such a first request is 404 while the page
  renders normally — that is inherent to the 404.html approach, not a bug.

To reproduce a Pages build locally:

```bash
BASE_PATH=/Business-Case-Tool npm run build
npx vite preview --base /Business-Case-Tool/
```

## Deploying elsewhere

This is a client-side routed SPA, so the host must serve `index.html` for
every path — otherwise a direct hit on e.g. `/demo/benchmarking` returns 404.
`public/_redirects` covers Netlify-style hosts. Equivalents:

- **Vercel** — `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }` in `vercel.json`
- **nginx** — `try_files $uri $uri/ /index.html;`
- **Apache** — `FallbackResource /index.html`

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
  spa-fallback.mjs      writes dist/404.html after the build
```

State is held in React context and persisted to `localStorage`; there is no
backend to configure.

## Attributions

See [ATTRIBUTIONS.md](./ATTRIBUTIONS.md).
