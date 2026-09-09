# Module 17 — Intervention Recommendation

Turns a patient's `RiskStatus` (+ `acute_override`) into a set of
candidate `InterventionCategory` values with plain-language rationale,
packaged as an `InterventionRecommendation`. **Suggests, never decides.**
`accepted` is always `None` on creation — it's a proposal row for a
supervisor to accept or dismiss, matching the PS's requirement exactly.

## Currently implemented: 3 of 5 categories

| Category | Trigger |
|---|---|
| `COUNSELLING` | Tier is YELLOW or RED |
| `MEDICAL` | `acute_override` is True |
| `PROTECTION_RELOCATION` | Tier is RED (not gated on acute_override — sustained high risk alone is enough) |

## Deliberately NOT implemented: `LEGAL_AID`, `FINANCIAL_ASSISTANCE`

Nothing in Modules 11–13's current signals (trend slope, session score,
volatility, acute-risk language) indicates legal or financial distress.
Implementing rules for these now would mean inventing triggers with no
real signal behind them — worse than not recommending them at all, since
a supervisor might reasonably trust a system-generated suggestion more
than they should.

**Adding real support for these would need**, at minimum:

1. A new signal source — most likely an extension of Module 13's
   transcript-scanning approach (`acute_keyword_detector.py`'s pattern),
   but for legal/financial-distress language rather than acute-risk
   language. A separate detector, not a reuse of the acute one — the
   phrase sets and false-positive tolerance are entirely different (a
   financial-distress false positive is low-stakes; an acute-risk false
   negative is not, so they shouldn't share a threshold or a review
   process).
2. Clinical/programmatic sign-off on what should trigger each — same
   review process called for in Module 13's `acute_keyword_detector.py`
   README, since these are also judgment calls about a vulnerable
   population's needs, not neutral engineering decisions.
3. A decision on whether `category_rules.py`'s current shape (a flat list
   of `(category, applies, rationale)` tuples evaluated against
   `RiskStatus` + a boolean) is even the right shape for a legal/financial
   trigger, which likely needs transcript text as an input the way
   `MEDICAL`/`acute_override` does — today's `recommend_interventions()`
   signature would need to grow a transcript or feature-vector parameter
   to support this.

Until then, a patient who needs legal or financial help will only get
flagged if a supervisor notices it themselves during a `COUNSELLING`- or
`MEDICAL`-triggered review — this module does not compensate for that gap.