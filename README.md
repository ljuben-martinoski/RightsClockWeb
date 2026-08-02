# RightsClock — website

The marketing site and interactive demo for **RightsClock**, a REST API that returns
statutory EU consumer rights (right of withdrawal, legal guarantee) and the exact deadline
dates that follow from them, for Germany, Austria and the Netherlands.

Live at **https://rightsclock.eu**.

This repo is the website only. The API is a **separate service**, deployed independently at
`https://api.rightsclock.eu` — none of its code lives here.

## What's in the box

| Path | What it is |
|---|---|
| `index.html` | Landing page: hero with a real request/response, live demo form, trust section, pricing stub |
| `legal-data.html` | Shell page that fetches and renders `LEGAL_DATA.md` at runtime |
| `LEGAL_DATA.md` | The data-governance document — the single copy of that content |
| `style.css` | All styling for both pages |
| `script.js` | Freshness date upgrade + the interactive demo |
| `vendor/marked.min.js` | Vendored [marked](https://github.com/markedjs/marked) v18.0.7, used only by `legal-data.html` |

## Running it locally

There is no build step, no `npm install`, no bundler, no framework. `index.html` works
opened straight from disk.

`legal-data.html` uses root-absolute paths (`/LEGAL_DATA.md`, `/vendor/marked.min.js`), so
from `file://` it shows its fallback link instead of the rendered document. To see it
render, serve the directory over HTTP:

```sh
python -m http.server 8000
# then open http://localhost:8000/
```

## How it talks to the API

Two calls, both anonymous, both from the browser:

- **`GET /v1/ready`** — `script.js` reads `oldest_last_reviewed` and upgrades the "Legal
  data last reviewed" line in the trust section.
- **`POST /v1/rights`** — the demo form. Sends `buyer_country`, `channel`,
  `contract_type: "goods"`, `purchase_date`, and `delivery_date` when given.

CORS already allows this origin for GET and POST. `/v1/rights` is rate-limited to
**10 requests/hour/IP** anonymously, so go easy when testing against the live service
(the demo surfaces a dedicated message on `429`).

## Conventions worth knowing before editing

These aren't style preferences — each one is load-bearing:

- **Degrade, never break.** Both pages ship something true and complete in the HTML, and
  JavaScript only *upgrades* it. The hardcoded review date in `index.html` and the raw-file
  link in `legal-data.html` are the shipped defaults, not placeholders; every failure path
  (offline, DNS, CORS, 503, malformed JSON) deliberately leaves them alone.
- **API strings reach the DOM via `textContent`, always.** Legal citations are full of `§`,
  quotes and punctuation — hand-built HTML is an escaping bug waiting to happen. The one
  `innerHTML` in the repo renders `LEGAL_DATA.md`, which is our own committed markup.
- **Render the response, don't assume it.** Fields arrive as `null` *or* are omitted; a
  right can legitimately apply with no computable deadline (the NL lifespan-based
  guarantee). Those are answers, not failures.
- **Out-of-scope inputs are a feature.** The API declines rather than inferring an answer
  from a neighbouring country's rules, and the demo presents that as designed behaviour.
- **Dates are handled in UTC.** The API returns time-zone-less calendar dates; parsing and
  formatting both in UTC stops a deadline sliding a day for visitors west of Greenwich.
- **No CDN, no external requests.** A third-party request would have to be declared in the
  Datenschutzerklärung and would tie the page's reliability to someone else's uptime. That
  is why marked is vendored.
- **The hero request/response is real**, taken from the API's pinned OpenAPI example. The
  response is excerpted, never edited — the omitted right is disclosed by the link under it.

## Deployment

`main` auto-deploys to production via Cloudflare Pages. Pushing to `main` publishes the
live site.

## Known gaps

- Impressum, Datenschutzerklärung and Terms are `href="#"` — drafts pending the UG
  formation, not to be linked publicly until reviewed.
- The pricing section is a stub ("free while in preview"); full tiers come later.

---

**Legal information, not legal advice.** © 2026 RightsClock
