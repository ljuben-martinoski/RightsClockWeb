// Renders LEGAL_DATA.md into legal-data.html.
//
// WHY this is a file and not a <script> block in the page, where it lived
// until now: the Content-Security-Policy in `_headers` is `script-src 'self'`.
// Keeping an inline script would have meant either 'unsafe-inline' — which
// re-permits exactly the injected script the policy exists to stop — or a
// sha256 hash in `_headers` that silently invalidates the moment anyone edits a
// character in here. An external file needs neither. The code below is
// unchanged from the block it replaces.
//
// Same discipline as the freshness date in script.js: the HTML already ships
// something true and useful — a link to the raw document — and this code only
// ever *upgrades* it. Every failure path (script blocked, 404, offline, empty
// body) leaves that link standing, because a blank page is worse than a plain
// one. The paths below are root-absolute, so opening the page straight from
// disk shows the fallback; serve it over HTTP to see it render.

const DOC_URL = "/LEGAL_DATA.md";

// marked emits a bare <table>. Giving each one its own scroll box keeps a
// wide table from pushing the whole page sideways on a phone.
function wrapTables(container) {
  for (const table of container.querySelectorAll("table")) {
    const wrap = document.createElement("div");
    wrap.className = "doc-table-wrap";
    table.replaceWith(wrap);
    wrap.append(table);
  }
}

async function renderLegalDoc() {
  const container = document.getElementById("legal-doc");
  const parser = window.marked;
  if (!container || !parser || typeof parser.parse !== "function") return;

  container.setAttribute("aria-busy", "true");

  try {
    const response = await fetch(DOC_URL, {
      headers: { Accept: "text/markdown, text/plain" },
    });

    // Same origin, same repo, so a non-ok here means the file moved or the
    // deploy is incomplete — either way there is nothing better to show than
    // the link already on screen.
    if (!response.ok) return;

    const html = parser.parse(await response.text());

    // An empty render would replace a working link with nothing at all.
    if (typeof html !== "string" || html.trim() === "") return;

    // innerHTML here, and deliberately the opposite of the rule script.js
    // follows for the demo. There the strings come from an API response; this
    // input is a file committed to this repo and served from this origin, so
    // it is our own markup by definition. Rendering markdown *is* producing
    // HTML — a sanitizer would only be guarding us against ourselves.
    container.innerHTML = html;
    wrapTables(container);
  } catch {
    // Deliberately empty: see the note at the top — the fallback link stays.
  } finally {
    container.removeAttribute("aria-busy");
  }
}

document.addEventListener("DOMContentLoaded", renderLegalDoc);
