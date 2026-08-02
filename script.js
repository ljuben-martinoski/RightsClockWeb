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

// --- interactive demo -------------------------------------------------------
//
// Posts the form to the public /v1/rights endpoint anonymously (no API key) and
// renders whatever comes back. Two rules govern everything below:
//
//   1. The response is rendered, never assumed. Fields arrive as null OR are
//      omitted entirely depending on the case, and a right can legitimately
//      apply with no computable deadline (NL's lifespan-based guarantee). Those
//      are answers, not failures, and the card has to say so.
//   2. Every string from the API reaches the DOM through textContent. Legal
//      source lines are full of §, punctuation and quotes; building HTML from
//      them by hand is an escaping bug waiting to happen.

const RIGHTS_URL = "https://api.rightsclock.eu/v1/rights";
const SUBMIT_LABEL = "Show my deadlines";

const RIGHT_TYPE_LABELS = {
  withdrawal: "Right of withdrawal",
  legal_guarantee: "Legal guarantee",
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  // The API's dates are calendar dates with no time zone. Parsing and
  // formatting both in UTC keeps a deadline from sliding a day either way for
  // a visitor west of Greenwich.
  timeZone: "UTC",
});

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// The API expresses "not applicable" as null on some responses and by dropping
// the key on others. Both mean the same thing, and neither may ever be printed.
function present(value) {
  return value !== null && value !== undefined && value !== "";
}

function humaniseRightType(value) {
  if (!present(value)) return "Right";
  if (RIGHT_TYPE_LABELS[value]) return RIGHT_TYPE_LABELS[value];
  // A right_type added to the dataset after this page shipped still gets a
  // readable heading — sentence case, to match the mapped labels above —
  // instead of leaking a raw enum value at the visitor.
  const words = String(value).replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatDate(value) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!parts) return String(value); // unrecognised shape: show it verbatim
  const date = new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])));
  if (Number.isNaN(date.getTime())) return String(value);
  return DATE_FORMAT.format(date);
}

function dateElement(className, value) {
  const node = el("time", className, formatDate(value));
  node.setAttribute("datetime", String(value));
  return node;
}

function pluralise(count, unit) {
  return `${count} ${unit}${Number(count) === 1 ? "" : "s"}`;
}

function durationLabel(right) {
  if (present(right.duration_days)) return pluralise(right.duration_days, "day");
  if (present(right.duration_years)) return pluralise(right.duration_years, "year");
  return "";
}

function buildRightCard(right) {
  const card = el("article", "right-card");
  const applies = right.applies === true;

  const head = el("div", "right-card-head");
  head.append(el("h3", "right-card-title", humaniseRightType(right.right_type)));
  head.append(
    el(
      "span",
      `badge ${applies ? "badge-applies" : "badge-excluded"}`,
      applies ? "Applies" : "Does not apply"
    )
  );
  card.append(head);

  // A right that doesn't apply has no dates and no duration by definition; the
  // whole answer is the reason, which the API puts in `explanation`.
  if (applies) {
    const block = el("div", "right-deadline");

    if (present(right.deadline_date)) {
      block.append(el("span", "right-deadline-label", "Deadline"));
      block.append(dateElement("right-deadline-date", right.deadline_date));

      const duration = durationLabel(right);
      const from = present(right.start_date) ? formatDate(right.start_date) : "";
      if (duration && from) {
        block.append(el("p", "right-window", `${duration} from ${from}`));
      } else if (duration) {
        block.append(el("p", "right-window", duration));
      } else if (from) {
        block.append(el("p", "right-window", `Runs from ${from}`));
      }
    } else {
      // Real and correct, not a gap in the data: the right applies, but the law
      // ties it to the product's expected lifespan, so there is no date to give.
      block.append(el("span", "right-deadline-label", "Deadline"));
      block.append(el("span", "right-deadline-date is-open", "No fixed deadline"));
      if (present(right.start_date)) {
        block.append(
          el("p", "right-window", `Runs from ${formatDate(right.start_date)}`)
        );
      }
    }

    card.append(block);
  }

  if (present(right.explanation)) {
    card.append(el("p", "right-explanation", right.explanation));
  }

  if (present(right.notes)) {
    card.append(el("p", "right-notes", right.notes));
  }

  const meta = el("dl", "right-meta");
  const metaRows = [
    ["Source", right.source],
    ["Jurisdiction", right.jurisdiction],
    ["Last reviewed", right.last_reviewed],
  ];
  for (const [label, value] of metaRows) {
    if (!present(value)) continue;
    meta.append(el("dt", null, label));
    meta.append(el("dd", null, String(value)));
  }
  if (meta.childElementCount > 0) card.append(meta);

  return card;
}

function showMessage(container, title, lines) {
  container.replaceChildren();
  const box = el("div", "demo-message");
  box.append(el("p", "demo-message-title", title));
  for (const line of lines) {
    if (line) box.append(el("p", null, line));
  }
  container.append(box);
}

function renderRights(container, data) {
  const rights = data && Array.isArray(data.rights) ? data.rights : null;

  if (!rights) {
    showMessage(container, "Unexpected response", [
      "The API answered, but not in a shape this page knows how to read.",
    ]);
    return;
  }

  container.replaceChildren();

  if (rights.length === 0) {
    showMessage(container, "No rights returned", [
      "Nothing is modelled for this combination yet.",
    ]);
    return;
  }

  for (const right of rights) {
    if (right && typeof right === "object") container.append(buildRightCard(right));
  }

  if (data.disclaimer) {
    container.append(el("p", "demo-disclaimer", data.disclaimer));
  }
}

function renderError(container, status, data) {
  const detail = data && typeof data === "object" ? data.detail : undefined;

  if (status === 422 && Array.isArray(detail)) {
    // Field-level validation. The raw objects carry loc/type/ctx that mean
    // nothing to a visitor, so at most the message is surfaced.
    const msg = detail[0] && typeof detail[0].msg === "string" ? detail[0].msg : "";
    showMessage(container, "Please check the form inputs", [
      "One of the values wasn't accepted.",
      msg,
    ]);
    return;
  }

  if (status === 422 && detail && typeof detail === "object") {
    // The scope gate, and the point of the product: rather than inferring an
    // answer from a neighbouring country's rules, the API declines out loud.
    // Presented as designed behaviour, because that is what it is.
    const supported = Array.isArray(detail.supported) ? detail.supported.join(", ") : "";
    showMessage(container, "This input is outside the modelled scope", [
      typeof detail.message === "string" ? detail.message : "",
      supported ? `Supported today: ${supported}.` : "",
      "We'd rather return nothing than a deadline we can't stand behind.",
    ]);
    return;
  }

  if (status === 429) {
    showMessage(container, "Demo limit reached", [
      "The anonymous demo allows a handful of requests per hour. Try again in a little while, or use an API key against the endpoint directly.",
    ]);
    return;
  }

  showMessage(container, "Couldn't reach the API just now", [
    "Something went wrong on the way to the service. Please try again in a moment.",
  ]);
}

function readValue(id) {
  const field = document.getElementById(id);
  return field ? field.value.trim() : "";
}

function buildRequestBody() {
  const body = {
    buyer_country: readValue("demo-country"),
    channel: readValue("demo-channel"),
    contract_type: "goods",
    purchase_date: readValue("demo-purchase-date"),
  };

  // Blank means "same as the purchase date", which is the API's own fallback.
  // Omit the key rather than sending null and inviting a validation error.
  const delivery = readValue("demo-delivery-date");
  if (delivery) body.delivery_date = delivery;

  return body;
}

async function runDemo() {
  const button = document.getElementById("demo-submit");
  const results = document.getElementById("demo-results");
  if (!button || !results) return;

  if (!readValue("demo-purchase-date")) {
    showMessage(results, "Please check the form inputs", [
      "A purchase date is needed before we can compute anything.",
    ]);
    return;
  }

  button.disabled = true;
  button.textContent = "Checking…";
  showMessage(results, "Checking…", []);

  try {
    const response = await fetch(RIGHTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(buildRequestBody()),
    });

    // Errors carry JSON bodies too, and any of them may fail to parse; a null
    // here just means the branch below has to fall back to the status code.
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (response.ok) {
      renderRights(results, data);
    } else {
      renderError(results, response.status, data);
    }
  } catch {
    // fetch itself rejected: offline, DNS, CORS, connection cut mid-flight.
    showMessage(results, "Couldn't reach the API just now", [
      "The request didn't get through. Check your connection and try again.",
    ]);
  } finally {
    // In `finally` so no branch above — including one added later — can leave
    // the button disabled and the demo looking hung.
    button.disabled = false;
    button.textContent = SUBMIT_LABEL;
  }
}

function initDemo() {
  const button = document.getElementById("demo-submit");
  if (button) button.addEventListener("click", runDemo);
}

document.addEventListener("DOMContentLoaded", () => {
  upgradeFreshnessDate();
  initDemo();
});
