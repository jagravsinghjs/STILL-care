"""
Case Profile Extraction Module — STILL-care
=============================================
Extracts structured case facts from a patient's case profile text.

Two tiers, by design:
  1. Structured fields (FIR number, sections, dates) -> regex + spaCy.
     Cheap, runs on CPU in milliseconds. Safe to run on every save.
  2. Narrative fields (case status, threats, summary) -> local LLM (Ollama).
     Only call extract_narrative_facts() / extract_case_facts() when the
     profile is actually created or updated -- NOT on every chat turn.
     This keeps the expensive call rare, so it's fine even on mid-range
     local hardware.

Usage:
    python case_profile_extraction.py --input profile_text.txt --output case_facts.json

Requirements:
    pip install spacy ollama
    python -m spacy download en_core_web_sm
    ollama pull qwen2.5:7b-instruct   # or whatever model you're already using
"""

import re
import json
import argparse
from datetime import datetime, timezone

try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
except (ImportError, OSError):
    nlp = None
    print("[warn] spaCy / en_core_web_sm not available -- falling back to regex-only date extraction. "
          "Run: pip install spacy && python -m spacy download en_core_web_sm")


# ---------------------------------------------------------------------------
# Tier 1: structured pattern extraction (cheap, always safe to run)
# ---------------------------------------------------------------------------

FIR_PATTERN = re.compile(r'FIR\s*(?:No\.?|Number)?\s*[:\-]?\s*(\d+/\d{4})', re.IGNORECASE)
SECTION_PATTERN = re.compile(
    r'(?:u/s|section[s]?)\s*[:\-]?\s*([\d,\s]+)\s*(IPC|BNS|POCSO|SC/ST Act)',
    re.IGNORECASE
)
DATE_PATTERN = re.compile(r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b')


def extract_fir_number(text: str):
    m = FIR_PATTERN.search(text)
    return m.group(1) if m else None


def extract_sections(text: str) -> list:
    matches = SECTION_PATTERN.findall(text)
    sections = []
    for nums, act in matches:
        for n in nums.split(","):
            n = n.strip()
            if n:
                sections.append(f"{n} {act}")
    return sections


def extract_dates(text: str) -> list:
    dates = set(DATE_PATTERN.findall(text))
    if nlp:
        doc = nlp(text)
        for ent in doc.ents:
            if ent.label_ == "DATE":
                dates.add(ent.text)
    return sorted(dates)


def extract_structured_facts(text: str) -> dict:
    """Fast path -- safe to call frequently, e.g. live as the patient types."""
    return {
        "fir_number": extract_fir_number(text),
        "sections": extract_sections(text),
        "dates_mentioned": extract_dates(text),
    }


# ---------------------------------------------------------------------------
# Tier 2: narrative extraction via local LLM -- this is now the PRIMARY path,
# since patients describe things casually ("judge pushed it to next month",
# "she said something about evidence") rather than in formal FIR language.
# Regex/spaCy above are just a cheap backstop, not the main extractor.
# Call this ONLY on profile create/update, not per chat message.
# ---------------------------------------------------------------------------

def extract_narrative_facts(text: str, model: str = "qwen2.5:7b-instruct") -> dict:
    """
    One LLM call that pulls whatever the patient actually shared, in
    whatever form they shared it in. Every field can be null/empty --
    patients won't give everything at once, and that's expected.
    """
    import ollama

    prompt = f"""Extract case-related facts from this text, written by a patient describing
their case in their own words -- it may be informal, partial, or out of order.
Respond with JSON only -- no other text, no markdown fences. Use null or [] for
anything not mentioned. Do not invent details.

{{
  "fir_number": "<FIR number if stated, else null>",
  "sections": ["<legal sections mentioned, if any>"],
  "case_type": "<e.g. rape, murder, caste-based violence, witness intimidation, or null>",
  "hearing_events": [
    {{
      "date": "<date mentioned in whatever form given -- exact ('12/03/2026') or relative ('next month', 'in two weeks'). Always include an entry even if only a relative date is given -- never skip an event just because there's no exact date.>",
      "type": "next_hearing" | "past_hearing" | null,
      "outcome": "<what happened/was decided at this hearing, or null>",
      "notes": "<anything else about this specific event, or null>"
    }}
  ],
  "threats_mentioned": ["<any threats/intimidation described, one entry per distinct mention>"],
  "status_summary": "<1-2 sentence plain-language summary of where the case currently stands, based only on this text>"
}}

Patient's text:
\"\"\"{text}\"\"\"
"""
    response = ollama.chat(model=model, messages=[{"role": "user", "content": prompt}])
    raw = response["message"]["content"].strip()

    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:].strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # fail soft -- never let a bad LLM response break the save
        parsed = {
            "fir_number": None,
            "sections": [],
            "case_type": None,
            "hearing_events": [],
            "threats_mentioned": [],
            "status_summary": raw[:300],
        }

    # backstop: fold in any *numeric-format* dates regex caught that the LLM
    # didn't turn into a hearing_event, so nothing gets silently dropped.
    # NOTE: deliberately regex-only here, not extract_dates()/spaCy -- spaCy
    # tags relative phrases like "next month" or "next date" as DATE too,
    # which would spam hearing_events with junk. Numeric dates (12/03/2026)
    # are unambiguous enough to safely auto-add; fuzzy phrases are not.
    caught_dates = set(DATE_PATTERN.findall(text))
    known_event_dates = {ev.get("date") for ev in parsed.get("hearing_events", [])}
    for d in caught_dates:
        if d not in known_event_dates:
            parsed.setdefault("hearing_events", []).append(
                {"date": d, "type": None, "outcome": None, "notes": "date detected but not classified"}
            )

    return parsed


# ---------------------------------------------------------------------------
# Merge: combine a new extraction into the patient's existing case_facts.
# Patients share info incrementally over multiple updates -- never overwrite,
# always merge.
# ---------------------------------------------------------------------------

def _empty_case_facts() -> dict:
    return {
        "fir_number": None,
        "sections": [],
        "case_type": None,
        "hearing_events": [],
        "threats_mentioned": [],
        "status_summary": "",
        "last_updated": None,
    }


def merge_case_facts(existing: dict, new: dict) -> dict:
    merged = dict(existing) if existing else _empty_case_facts()
    merged.setdefault("sections", [])
    merged.setdefault("hearing_events", [])
    merged.setdefault("threats_mentioned", [])

    if new.get("fir_number"):
        merged["fir_number"] = new["fir_number"]
    if new.get("case_type"):
        merged["case_type"] = new["case_type"]

    for s in new.get("sections", []) or []:
        if s and s not in merged["sections"]:
            merged["sections"].append(s)

    for ev in new.get("hearing_events", []) or []:
        match = next((e for e in merged["hearing_events"] if e.get("date") == ev.get("date")), None)
        if match:
            for k, v in ev.items():
                if v:  # only overwrite with non-empty new info
                    match[k] = v
        else:
            merged["hearing_events"].append(ev)

    for t in new.get("threats_mentioned", []) or []:
        if t and t not in merged["threats_mentioned"]:
            merged["threats_mentioned"].append(t)

    if new.get("status_summary"):
        merged["status_summary"] = new["status_summary"]  # always keep the latest summary

    merged["last_updated"] = datetime.now(timezone.utc).isoformat()
    return merged


# ---------------------------------------------------------------------------
# Combined entry point -- call this on profile create/update
# ---------------------------------------------------------------------------

def extract_and_merge_case_facts(text: str, existing_facts: dict = None,
                                  model: str = "qwen2.5:7b-instruct") -> dict:
    """
    Extracts whatever the patient just shared and merges it into their
    existing case_facts record (pass the previously stored dict, or None
    for a brand-new patient).
    """
    new_facts = extract_narrative_facts(text, model=model)
    return merge_case_facts(existing_facts or _empty_case_facts(), new_facts)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract and merge case facts from a profile update")
    parser.add_argument("--input", required=True, help="Path to the patient's new profile text")
    parser.add_argument("--existing", help="Path to existing case_facts.json for this patient, if any")
    parser.add_argument("--output", default="case_facts.json", help="Where to write the merged JSON")
    parser.add_argument("--model", default="qwen2.5:7b-instruct", help="Ollama model for narrative extraction")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        new_text = f.read()

    existing_facts = None
    if args.existing:
        with open(args.existing, "r", encoding="utf-8") as f:
            existing_facts = json.load(f)

    merged = extract_and_merge_case_facts(new_text, existing_facts=existing_facts, model=args.model)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2)

    print(json.dumps(merged, indent=2))