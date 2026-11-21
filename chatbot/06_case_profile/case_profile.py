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

[INTEGRATION] --patient-id (required):
  After writing --output, this now registers (patient_id -> output path)
  in the shared patient registry (see patient_registry.py) so voice_chat.py
  can look the path up automatically instead of requiring a human to
  remember and re-type it via --case-facts every time. This is the fix for
  the "filenames-in-a-folder, not a real patient registry" gap -- it's a
  small addition to the same still.db intelligence_model already owns, not
  a new database.

Usage:
    python case_profile.py --input profile_text.txt --output case_facts.json --patient-id patient_001

Requirements:
    pip install spacy ollama
    python -m spacy download en_core_web_sm
    ollama pull qwen2.5:7b-instruct   # or whatever model you're already using
"""

import re
import json
import argparse
import os
import tempfile
from copy import deepcopy
from datetime import datetime, timezone

# [INTEGRATION] shared patient_id -> case_facts_path registry.
# See patient_registry.py -- copy it into this same folder (or wherever your
# PYTHONPATH picks it up), same pattern as voice_chat.py's existing
# sys.path.insert() for case_profile.py itself.
from patient_registry import register_case_facts_path

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

def _is_meaningful_event(ev: dict) -> bool:
    """An event with every field empty carries no information -- it's noise."""
    return any(ev.get(k) for k in ("date", "type", "outcome", "notes"))


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
        parsed = normalize_case_facts(json.loads(raw))
    except json.JSONDecodeError as e:
        raise ValueError("Case extraction returned invalid JSON; profile was not saved") from e

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

    # drop any hearing_event where every field is empty -- despite being told
    # not to invent details, the model sometimes returns a fully-null
    # placeholder object rather than omitting the key. An event with nothing
    # in it carries no information and just pollutes the list over time.
    parsed["hearing_events"] = [ev for ev in parsed.get("hearing_events", []) if _is_meaningful_event(ev)]

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


def normalize_case_facts(facts: dict) -> dict:
    """Accept absent/null optional fields; reject malformed facts before merging."""
    if not isinstance(facts, dict):
        raise ValueError("Case facts must be a JSON object")
    normalized = deepcopy(facts)

    def optional_string(value, field):
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError(f"{field} must be a string or null")
        return value.strip() or None

    for field in ("fir_number", "case_type", "last_updated"):
        normalized[field] = optional_string(facts.get(field), field)
    normalized["status_summary"] = optional_string(facts.get("status_summary"), "status_summary") or ""

    for field in ("sections", "threats_mentioned"):
        values = facts.get(field)
        if values is None:
            values = []
        if not isinstance(values, list):
            raise ValueError(f"{field} must be a list or null")
        normalized[field] = []
        for index, value in enumerate(values):
            value = optional_string(value, f"{field}[{index}]")
            if value and value not in normalized[field]:
                normalized[field].append(value)

    events = facts.get("hearing_events")
    if events is None:
        events = []
    if not isinstance(events, list):
        raise ValueError("hearing_events must be a list or null")
    normalized["hearing_events"] = []
    for index, event in enumerate(events):
        if event is None:
            continue
        if not isinstance(event, dict):
            raise ValueError(f"hearing_events[{index}] must be an object or null")
        clean_event = deepcopy(event)
        for field in ("date", "type", "outcome", "notes"):
            clean_event[field] = optional_string(event.get(field), f"hearing_events[{index}].{field}")
        if clean_event["type"] not in (None, "next_hearing", "past_hearing"):
            raise ValueError(f"hearing_events[{index}].type must be next_hearing, past_hearing, or null")
        if _is_meaningful_event(clean_event):
            normalized["hearing_events"].append(clean_event)
    return normalized


def _same_hearing_event(existing: dict, new: dict) -> bool:
    if existing == new:
        return True  # Identical repeats add no new facts, even without a date.
    date = new.get("date")
    # Missing dates and relative phrases do not establish event identity.
    if not date or not DATE_PATTERN.fullmatch(date) or existing.get("date") != date:
        return False
    # Preserve separate events rather than combine conflicting details.
    return not any(existing.get(field) and new.get(field) and existing[field] != new[field]
                   for field in ("type", "outcome", "notes"))


def merge_case_facts(existing: dict, new: dict) -> dict:
    merged = normalize_case_facts(existing if existing is not None else _empty_case_facts())
    new = normalize_case_facts(new)

    if new.get("fir_number"):
        merged["fir_number"] = new["fir_number"]
    if new.get("case_type"):
        merged["case_type"] = new["case_type"]

    for s in new.get("sections", []) or []:
        if s and s not in merged["sections"]:
            merged["sections"].append(s)

    for ev in new.get("hearing_events", []) or []:
        if not _is_meaningful_event(ev):
            continue
        match = next((e for e in merged["hearing_events"] if _same_hearing_event(e, ev)), None)
        if match is not None:
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


def generate_status_summary(merged_facts: dict, model: str = "qwen2.5:7b-instruct") -> str:
    """
    Regenerates status_summary from the FULL merged case_facts, not just the
    latest update -- this is what makes status_summary an actual running
    memory of everything the patient has shared, instead of only reflecting
    whatever they said most recently.
    """
    import ollama

    facts_for_prompt = {k: v for k, v in merged_facts.items() if k != "status_summary"}

    prompt = f"""Here is everything known so far about a patient's case, built up across
multiple updates over time:

{json.dumps(facts_for_prompt, indent=2)}

Write a 2-4 sentence plain-language summary of where the case currently stands overall,
covering the case type, key hearings/outcomes so far, and any ongoing concerns like
threats. Base this only on the facts given. Respond with the summary text only -- no
JSON, no headers, no preamble."""

    response = ollama.chat(model=model, messages=[{"role": "user", "content": prompt}])
    return response["message"]["content"].strip()


# ---------------------------------------------------------------------------
# Combined entry point -- call this on profile create/update
# ---------------------------------------------------------------------------

def extract_and_merge_case_facts(text: str, existing_facts: dict = None,
                                  model: str = "qwen2.5:7b-instruct") -> dict:
    """
    Extracts whatever the patient just shared and merges it into their
    existing case_facts record (pass the previously stored dict, or None
    for a brand-new patient). status_summary is then regenerated from the
    complete merged facts, so it reflects everything provided so far.
    """
    existing = normalize_case_facts(existing_facts if existing_facts is not None else _empty_case_facts())
    new_facts = extract_narrative_facts(text, model=model)
    merged = merge_case_facts(existing, new_facts)
    merged["status_summary"] = generate_status_summary(merged, model=model)
    return normalize_case_facts(merged)


def save_profile_update(input_path, output_path, patient_id, existing_path=None,
                        model="qwen2.5:7b-instruct", display_name=None):
    """Automatically merge an existing destination and replace it only on success."""
    output_path = os.path.abspath(output_path)
    if existing_path and os.path.exists(output_path) and os.path.realpath(existing_path) != os.path.realpath(output_path):
        raise ValueError("Output already exists and differs from --existing; choose a new output or update that output directly")
    source_path = existing_path or (output_path if os.path.exists(output_path) else None)
    existing_facts = None
    if source_path:
        with open(source_path, "r", encoding="utf-8") as f:
            existing_facts = normalize_case_facts(json.load(f))
    with open(input_path, "r", encoding="utf-8") as f:
        new_text = f.read()
    if not new_text.strip():
        raise ValueError("Profile update text is empty")
    merged = extract_and_merge_case_facts(new_text, existing_facts=existing_facts, model=model)
    directory = os.path.dirname(output_path)
    os.makedirs(directory, exist_ok=True)
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", dir=directory, suffix=".json",
                                         encoding="utf-8", delete=False) as f:
            temporary_path = f.name
            json.dump(merged, f, indent=2, ensure_ascii=False, allow_nan=False)
        os.replace(temporary_path, output_path)
    finally:
        if temporary_path and os.path.exists(temporary_path):
            os.remove(temporary_path)
    register_case_facts_path(patient_id, output_path, display_name=display_name)
    print(f"\n[integration] Registered case_facts path for patient_id={patient_id}: {output_path}")
    return merged


def main(argv=None):
    parser = argparse.ArgumentParser(description="Extract and merge case facts from a profile update")
    parser.add_argument("--input", required=True, help="Path to the patient's new profile text")
    parser.add_argument("--existing", help="Existing profile to merge; defaults to --output if that file already exists")
    parser.add_argument("--output", default="case_facts.json", help="Where to write the merged JSON")
    parser.add_argument("--model", default="qwen2.5:7b-instruct", help="Ollama model for narrative extraction")
    parser.add_argument(
        "--patient-id",
        required=True,
        help="[INTEGRATION] Registers this patient_id -> --output path in the shared "
             "patient registry (still.db's 'patients' table), so voice_chat.py can look "
             "up the case-facts path automatically instead of needing --case-facts typed "
             "in by hand every session.",
    )
    parser.add_argument(
        "--display-name",
        help="[INTEGRATION] Optional human-readable name to store alongside patient_id "
             "in the registry, purely for a human/dashboard to read later.",
    )
    args = parser.parse_args(argv)
    merged = save_profile_update(args.input, args.output, args.patient_id,
                                 existing_path=args.existing, model=args.model,
                                 display_name=args.display_name)
    print(json.dumps(merged, indent=2))


if __name__ == "__main__":
    main()
