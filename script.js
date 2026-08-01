// Live freshness upgrade for the trust section.
//
// WHY the fallback matters: this line sits in the section whose entire claim is
// "we keep this correct". A spinner stuck forever, an "unavailable" string, or a
// blank date would actively disprove that claim — a broken freshness widget is
// worse than no widget at all. So the HTML ships a hardcoded, true date, and this
// script only ever *upgrades* it. Every failure path (offline, DNS, CORS, 503,
// malformed JSON, missing field) silently leaves the hardcoded text alone, and
// the page reads as intended whether or not the API is reachable.

const READY_URL = "https://api.rightsclock.eu/v1/ready";

async function upgradeFreshnessDate() {
  const el = document.getElementById("freshness-date");
  if (!el) return;

  try {
    const response = await fetch(READY_URL, {
      headers: { Accept: "application/json" },
    });

    // /v1/ready answers 503 {"status":"not_ready"} when the rulesets fail to
    // load — there's no date in that body, so there's nothing to upgrade to.
    if (!response.ok) return;

    const data = await response.json();
    const reviewed = data.oldest_last_reviewed;
    if (typeof reviewed !== "string" || reviewed === "") return;

    el.textContent = `Legal data last reviewed: ${reviewed} (verified live)`;
  } catch {
    // Deliberately empty: see the note at the top of this file.
  }
}

document.addEventListener("DOMContentLoaded", upgradeFreshnessDate);
