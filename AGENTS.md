# Repository Guidelines

## Project Structure & Module Organization

This is a static, dependency-free emergency response app:

- `index.html` contains the frontend: HTML, CSS, and vanilla JavaScript.
- `services/sheets.js` is the single frontend data service for Google Apps Script.
- `apps-script/codigo.gs` is the Google Apps Script backend for Google Sheets reads/writes, matching, registration, history, routes, contributions, invoice traceability, family search, and record integrity.
- `locales/` contains UI translations.
- `vercel.json` defines security headers and CSP.
- `robots.txt` and `sitemap.xml` are root SEO files.

There is no `package.json`, bundler, framework, CDN, or build step. Do not add one unless direction changes.

## Build, Test, and Development Commands

- Open locally over HTTP: `python3 -m http.server 8000`, then visit `http://127.0.0.1:8000/`.
- Check the Apps Script endpoint: `curl -sL "<APPS_SCRIPT_URL>"` should return JSON with `lugares`.
- Deploy: push to the production branch connected to Vercel. Vercel serves the static files with no build.

## Coding Style & Naming Conventions

Use 2-space indentation in HTML, CSS, JavaScript, and Apps Script. Keep UI copy in Spanish. Preserve comment banners inside `index.html`.

All external or Sheet-derived values rendered through template literals and `innerHTML` must pass through `escaparHTML` / `e()`. Keep `normalizar()` synchronized between `index.html` and `apps-script/codigo.gs`; matching depends on identical normalization.

Form field IDs for the Agregar tab use the `ag-` prefix to avoid collisions with filters.

## Testing Guidelines

There is no automated test runner or coverage target. Verify manually in a browser at mobile and desktop widths. Test tab switching, filters, donation matching, family search, token tracking, add form submission, driver routes, and contributions.

When changing Apps Script, verify `doGet` with `curl` and test write flows from the browser.

## Security & Configuration Tips

Never hardcode private API keys in `index.html`; it is public code. Public invoice tokens may appear in URLs but must not expose donor references, phones, emails, coordinates, internal centers, deposits, bank details, or operational data. If an external endpoint is added, update `vercel.json` CSP. When updating Apps Script, deploy a new version under the existing deployment instead of creating a new `/exec` URL.
