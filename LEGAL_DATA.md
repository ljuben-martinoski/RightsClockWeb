# How RightsClock's legal data is maintained


RightsClock returns statutory consumer rights and deadline dates. The code that computes a
date is simple; the value is in the legal dataset behind it being correct, current, and
traceable to an official source.

This document describes how that dataset is maintained, so you can judge whether to rely on
it. It is published deliberately: "how do I know this stays right?" is a fair question and
you should not have to take our word for it.

**RightsClock provides legal information, not legal advice.** We are not a law firm. Every
response carries a citation so you can verify it at source, and we recommend you do for
anything consequential.

---

## What is modelled

| Dimension | Covered |
|---|---|
| Countries | Germany (DE), Austria (AT), Netherlands (NL) |
| Contract type | Physical goods |
| Sales channel | Distance (online), off-premises (doorstep), in-store |
| Seller | Business seller to consumer (B2C); private sales answered with a reason |
| Rights | Right of withdrawal, legal guarantee |

## Three possible answers

RightsClock distinguishes three outcomes, and the distinction is deliberate:

**The right applies** — with a computed deadline, explanation and citation. Where a
national caveat exists it travels with the answer: `second_hand: true` adds the note
that the guarantee period *may* be contractually reduced, without changing the
returned deadline.

**The right does not apply** — `applies: false` with an explanation of *why*. In-store
purchases and private (C2C) sales fall here for withdrawal: the right genuinely does not
exist in those circumstances, and saying so with a reason is an answer, not a gap.

**Out of scope** — a `422` naming exactly what is unsupported. Services, digital content,
digital services, and every country outside DE/AT/NL. The API never falls back to
approximate or adjacent rules to produce an answer.

That third case is the one that matters most. A wrong deadline is worse than no deadline:
someone who gets no answer consults a lawyer, while someone who gets a confidently wrong
answer misses their window. Scope is narrow so that what is inside it can be defended.

---

## Sources

Every rule cites a primary source. In order of preference:

1. **EU legislation** via EUR-Lex:
   - Directive 2011/83/EU (consumer rights)
   - Directive (EU) 2019/771 (sale of goods)
   - Regulation (EEC, Euratom) No 1182/71 (rules for counting periods)

2. **National implementing statutes**, cited per rule:
   - **Germany** — BGB §§ 312g, 355, 356 (withdrawal); § 193 (deadline rollover);
     §§ 434, 437, 438(2) (legal guarantee); § 477 (reversal of proof);
     § 476(2) (second-hand limitation)
   - **Austria** — FAGG § 11 (withdrawal); VGG §§ 4, 10, 11 and ABGB § 933
     (legal guarantee); VGG § 10(3) (second-hand)
   - **Netherlands** — Burgerlijk Wetboek Boek 6, art. 6:230o (withdrawal);
     BW Boek 7, art. 7:17 and 7:23 (conformity and notification)

3. **Your Europe** (the European Commission's citizen information portal) — used for
   orientation and cross-checking, never as the sole citation for a rule

Secondary sources — law-firm blogs, summaries, news articles, other APIs — are never used as
a citation. They are acceptable as a signal that something may have changed and warrants
checking against a primary source.

---

## How a rule changes

Every modification to a file in `app/data/` follows this process:

1. **Open a pull request.** No direct commits to `main` touching legal data.

2. **Cite the source.** The PR description states the primary source consulted and links
   to it. If the source is a statute, the specific article or paragraph.

3. **Update `last_reviewed`** on every rule the change touches, to the date the source was
   actually consulted — not the date of the commit.

4. **Do not merge the same day.** A rule change is reviewed at least one day after it is
   written.

RightsClock is currently maintained by one person, so step 4 is not a second pair of eyes —
it is a second pass by the same eyes, on a different day. It exists because the errors that
survive first reading are the ones that matter, and because the resulting record is
inspectable: the git history of `app/data/` is a dated audit trail of every legal claim this
API has ever made, with its source.

### Unverified rules are excluded, not guessed at

A rule that cannot be confirmed against a primary source is marked `verified: false` and is
**excluded from API responses entirely** until it is checked. It does not ship in a degraded
or best-effort form. This is enforced at startup: the ruleset loader drops unverified rules
before they can reach a response, and refuses to start at all if a category exception is unverified.
Verification does not merge upward: a country override can attest its national
version of a rule, but cannot re-verify an EU base rule that is itself unverified.

---

## How staleness is prevented

Law changes; a rule reviewed in 2026 is not automatically correct in 2028. Three mechanisms,
all automated:

**Continuous integration fails on stale data.** Every push runs a freshness gate that warns
at 300 days and fails the build at 365. A rule cannot pass its first birthday unreviewed
without breaking the build.

**A weekly scheduled check.** Data goes stale without commits, so the same gate runs every
Monday at 06:00 UTC regardless of development activity. Without this, a quiet period could
carry the dataset past a year with nothing to notice.

**The oldest review date is public.** `GET /v1/ready` returns `oldest_last_reviewed` — the
oldest review date anywhere in the dataset. You can check the freshness of the data behind
this API at any time, without asking us.

```
curl https://api.rightsclock.eu/v1/ready
```

### Quarterly review

Independently of the automated gates, the full dataset is reviewed every three months.
Next scheduled review: **1 October 2026.**

Each review checks, for every rule:

- Has the underlying law changed since the last review?
- Is the cited article or paragraph still accurate?
- Is the plain-language explanation still a fair summary?

`last_reviewed` is updated only for rules actually checked against a source. It is never
bulk-updated to make a build pass.

---

## Reporting an error

If you believe a rule is wrong, please say so — corrections are the most useful thing you
can send us.

**Open an issue:** https://github.com/ljuben-martinoski/RightsClockAPI/issues

Please include the request you sent, the response you received, and the source you believe
is correct. Reports citing a primary source are prioritised.

---

## Limitations you should know about

- **Deadline rollover uses nationwide public holidays only.** Regional holidays
  observed in only some German or Austrian Bundesländer (e.g. Fronleichnam,
  Allerheiligen) are not applied. Where such a holiday falls on a deadline, the true
  deadline may be one or more days later than returned — RightsClock is never later
  than the real deadline, but may be earlier.

- **Rollover uses the buyer's national holiday calendar**, not the seller's. For
  cross-border purchases within the modelled countries this reflects the consumer's
  position, which is where the right sits.

- **There is no `seller_country` field.** It was removed rather than accepted and
  ignored: rules resolve from `buyer_country`, which also selects the holiday
  calendar. It will return as a breaking change if and when cross-border logic
  actually uses it.

- **The Netherlands legal guarantee returns no deadline date.** Dutch law sets no
  fixed two-year cap; goods must conform for the period reasonably expected given
  the product's nature and lifespan (BW 7:17). RightsClock returns the right and its
  explanation with no computed deadline, because no honest fixed date exists. Claims
  prescribe two years after the seller is notified (BW 7:23 lid 2).

- **Holiday rollover applies to withdrawal deadlines, not to guarantee expiry.**
  Whether a guarantee or limitation period expiring on a weekend or public holiday
  rolls forward is governed by national law and varies between member states.
  RightsClock does not apply a rollover there rather than guess.

- **Second-hand goods are flagged, not recalculated.** `second_hand: true` attaches
  the national caveat that the guarantee period *may* be contractually reduced to one
  year (BGB § 476(2) in Germany, VGG § 10(3) in Austria). The returned deadline is
  unchanged, because such a reduction requires a specific contractual agreement
  RightsClock cannot know about.

- **Only statutory minimum rights are modelled.** A seller's own returns policy may
  be more generous. RightsClock does not know about contractual terms and does not
  model them.

- **`delivery_date` defaults to `purchase_date` when omitted.** Since withdrawal
  periods run from delivery, omitting a real delivery date will return a deadline
  earlier than the true one. Supply the actual delivery date whenever you have it.

---

*Last updated: 2026-07-23*

*Questions about this process: [open an issue](https://github.com/ljuben-martinoski/RightsClockAPI/issues)*
