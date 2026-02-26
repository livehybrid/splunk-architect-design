# Splunk HLA Designer (MVP)

Web-based architecture designer for creating and managing Splunk High Level Architecture diagrams inspired by Splunk Validated Architectures.

## What this MVP supports

- Load baseline topologies: `S1`, `D1`, `C3`, `M3`, and `CLOUD`
- Add custom components with:
  - Name
  - Layer assignment
  - Site assignment
  - Scale factor
- Toggle visibility of architecture layers and default connection overlays
- Apply machine specs from AWS, Azure, or custom definitions
- Set OS and Splunk version per component
- Validate component OS/Splunk compatibility against local JSON schema-backed matrix
- Export the current diagram canvas as PDF

## Compatibility Matrix

- Schema: `src/data/splunk-os-compatibility.schema.json`
- Data: `src/data/splunk-os-compatibility.json`

Update the matrix as Splunk support guidance evolves.

## Iconography

- Placeholder icon behavior is built into node rendering.
- Add official icon assets in `public/icons/` and wire mappings in the node component as needed.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Hosting (e.g. GitHub Pages)

The app is a static SPA and can be hosted on **GitHub Pages**, Netlify, Vercel, or any static host.

### GitHub Pages (this repo)

1. In the repo: **Settings → Pages → Build and deployment → Source**: choose **GitHub Actions**.
2. Push to `main` (or run the workflow manually). The workflow in `.github/workflows/deploy-pages.yml` builds the app and deploys it.
3. The site will be at: `https://<your-username>.github.io/<repo-name>/`.

If your repo is `splunk-architect-design`, the URL is `https://<your-username>.github.io/splunk-architect-design/`.

### Build for a different base URL

For a **user/org site** (e.g. `https://username.github.io/` with the app at root), build with no base path:

```bash
npm run build
```

For a **project site** (e.g. `https://username.github.io/repo-name/`), the workflow sets `BASE_PATH=/<repo-name>/` automatically. To build locally with the same base:

```bash
BASE_PATH=/splunk-architect-design/ npm run build
```
