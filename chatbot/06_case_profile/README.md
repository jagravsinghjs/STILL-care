# Case-profile memory

Extracts case facts from a patient's written update using local Ollama,
merges them into a profile, and registers its path for stage 05 to find.
The stored summary is regenerated from the merged facts. Patient statements
and model extraction are not independently verified legal records.

## Setup

From the repository root, using the project's Python environment:

```bash
uv pip install ollama spacy
ollama pull qwen2.5:7b-instruct
export STILL_DB_PATH="$PWD/data/still.db"
```

Ollama must be running locally. Run `ollama serve` if needed. The spaCy
`en_core_web_sm` model is optional for the structured date helper; numeric
date fallback in the narrative workflow uses regex directly.
Use the same absolute `STILL_DB_PATH` for stages 05 and 06.

## Create or update a profile

```bash
uv run python chatbot/06_case_profile/case_profile.py \
  --input chatbot/06_case_profile/input/sample_profile_update.txt \
  --output chatbot/06_case_profile/output/case_facts_demo_patient_001.json \
  --patient-id demo_patient_001
```

For a later update, change `--input` to the new text file and keep the same
patient ID and output path. **An existing output is loaded and merged
automatically**, even when `--existing` is omitted. Use a different profile
file for each patient; the profile JSON does not itself bind a patient ID.

`--existing` is still supported to read an explicit source. If it differs
from an already-existing output, the operation is refused instead of
replacing another profile. Use an unused destination when copying a profile.
Unreadable/invalid existing JSON is never silently replaced with a new profile.

After extraction and summary generation succeed, a temporary JSON file is
written and atomically replaces the output. The path is then registered in
SQLite. If registry registration fails, the saved file remains; registration
and file saving are not a single transaction.

## Validation and merging

- Missing or null optional lists become empty lists; optional text may be null.
- Events must be objects with optional string fields `date`, `type`, `outcome`,
  and `notes`. Types are `next_hearing`, `past_hearing`, or null. Null/empty
  event placeholders are omitted.
- Malformed containers/values and invalid model JSON stop the update with a
  descriptive error before saving. Raw model failures are not stored as facts.
- Different undated events and events sharing only a relative phrase such as
  `next month` are kept separate. Exact duplicate events are not added twice.
- Events sharing the same numeric date string merge complementary information
  only when their existing nonempty type/outcome/notes do not conflict.
  Conflicting events stay separate to avoid mixing their facts.
- Merging copies nested data, so a failed later step cannot mutate the caller's
  original profile object. Extraction, summary, serialization, and replacement
  failures preserve the existing output file.

This conservative matching can retain multiple entries that refer to the same
real event. Date normalization, resolving relative dates, extraction-accuracy
evaluation, and consolidation of the duplicated registry helpers remain future
work. Numeric dates have a regex backstop; FIR/section regex helpers are not
currently merged as a fallback into narrative extraction.

## Offline regression checks

```bash
uv run python -m unittest discover -s chatbot/06_case_profile/tests -v
```

Tests use temporary profiles and mocked Ollama/registry calls. They do not
download models or modify real patient files or the application database.
