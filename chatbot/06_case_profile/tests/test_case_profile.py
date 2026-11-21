"""Offline case-memory regression checks; no model downloads or real registry writes."""

from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
from types import ModuleType
import unittest
from unittest.mock import Mock, patch


FOLDER = Path(__file__).resolve().parents[1]


def load_case_module():
    registry = ModuleType("patient_registry")
    registry.register_case_facts_path = Mock()
    spacy = ModuleType("spacy")
    spacy.load = Mock(side_effect=OSError("optional NLP model unavailable in offline tests"))
    replacements = {"patient_registry": registry, "spacy": spacy}
    missing = object()
    previous = {name: sys.modules.get(name, missing) for name in replacements}
    sys.modules.update(replacements)
    try:
        spec = importlib.util.spec_from_file_location("case_profile_under_test", FOLDER / "case_profile.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    finally:
        for name, value in previous.items():
            if value is missing:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = value
    return module


class CaseProfileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.case = load_case_module()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.input = self.root / "update.txt"
        self.input.write_text("There was a new hearing.", encoding="utf-8")
        self.output = self.root / "profile.json"

    def model_response(self, content):
        ollama = ModuleType("ollama")
        ollama.chat = Mock(return_value={"message": {"content": content}})
        return patch.dict(sys.modules, {"ollama": ollama})

    def test_unrelated_undated_events_remain_separate_and_inputs_are_unchanged(self):
        old = {"hearing_events": [{"date": None, "type": "past_hearing", "outcome": "bail denied"}]}
        new = {"hearing_events": [{"date": None, "type": "next_hearing", "notes": "another hearing"}],
               "sections": ["302 IPC"]}
        before_old, before_new = deepcopy(old), deepcopy(new)
        result = self.case.merge_case_facts(old, new)
        self.assertEqual(len(result["hearing_events"]), 2)
        self.assertEqual(result["hearing_events"][0]["type"], "past_hearing")
        self.assertEqual(result["hearing_events"][1]["outcome"], None)
        self.assertEqual(old, before_old)
        self.assertEqual(new, before_new)

    def test_repeated_relative_phrase_does_not_merge_different_events(self):
        old = {"hearing_events": [{"date": "next month", "notes": "evidence hearing"}]}
        new = {"hearing_events": [{"date": "next month", "notes": "bail hearing"}]}
        self.assertEqual(len(self.case.merge_case_facts(old, new)["hearing_events"]), 2)

    def test_identical_repeated_event_is_not_duplicated(self):
        facts = {"hearing_events": [{"date": None, "notes": "evidence hearing"}]}
        self.assertEqual(len(self.case.merge_case_facts(facts, facts)["hearing_events"]), 1)

    def test_complementary_dated_details_merge_but_conflicts_stay_separate(self):
        old = {"hearing_events": [{"date": "12/03/2026", "type": "past_hearing"}]}
        new = {"hearing_events": [{"date": "12/03/2026", "outcome": "adjourned"}]}
        result = self.case.merge_case_facts(old, new)
        self.assertEqual(len(result["hearing_events"]), 1)
        self.assertEqual(result["hearing_events"][0]["outcome"], "adjourned")
        conflict = {"hearing_events": [{"date": "12/03/2026", "outcome": "bail denied"}]}
        self.assertEqual(len(self.case.merge_case_facts(result, conflict)["hearing_events"]), 2)

    def test_null_model_lists_and_empty_events_are_normalized(self):
        content = json.dumps({"hearing_events": None, "sections": None,
                              "threats_mentioned": None, "status_summary": None})
        with self.model_response(content):
            result = self.case.extract_narrative_facts("No hearing details yet")
        for field in ("hearing_events", "sections", "threats_mentioned"):
            self.assertEqual(result[field], [])
        self.assertEqual(result["status_summary"], "")
        self.assertEqual(self.case.normalize_case_facts({"hearing_events": [None, {}]})["hearing_events"], [])

    def test_malformed_model_facts_are_rejected_with_clear_errors(self):
        for facts, message in [
            ([], "JSON object"),
            ({"hearing_events": ["next month"]}, "hearing_events[0]"),
            ({"hearing_events": "next month"}, "hearing_events"),
            ({"sections": [302]}, "sections[0]"),
            ({"threats_mentioned": "a threat"}, "threats_mentioned"),
            ({"hearing_events": [{"date": 123}]}, "hearing_events[0].date"),
            ({"hearing_events": [{"type": "invented"}]}, "hearing_events[0].type"),
        ]:
            with self.subTest(facts=facts), self.model_response(json.dumps(facts)):
                with self.assertRaises(ValueError) as error:
                    self.case.extract_narrative_facts("Update")
                self.assertIn(message, str(error.exception))

    def test_invalid_model_json_is_not_saved_as_summary(self):
        with self.model_response("unparseable model output"):
            with self.assertRaisesRegex(ValueError, "invalid JSON"):
                self.case.extract_narrative_facts("Update")

    def test_existing_output_is_loaded_without_existing_argument(self):
        self.output.write_text(json.dumps({"fir_number": "123/2026", "sections": ["302 IPC"]}))
        with patch.object(self.case, "extract_narrative_facts", return_value={"sections": ["3 SC/ST Act"]}), \
                patch.object(self.case, "generate_status_summary", return_value="Updated summary"), \
                patch.object(self.case, "register_case_facts_path") as registry:
            self.case.main(["--input", str(self.input), "--output", str(self.output), "--patient-id", "demo"])
        result = json.loads(self.output.read_text())
        self.assertEqual(result["fir_number"], "123/2026")
        self.assertEqual(result["sections"], ["302 IPC", "3 SC/ST Act"])
        registry.assert_called_once_with("demo", str(self.output.resolve()), display_name=None)

    def test_invalid_existing_json_prevents_model_calls_and_overwrite(self):
        self.output.write_text("broken existing JSON")
        with patch.object(self.case, "extract_narrative_facts") as extract, \
                patch.object(self.case, "register_case_facts_path") as register:
            with self.assertRaises(ValueError):
                self.case.save_profile_update(str(self.input), str(self.output), "demo")
        extract.assert_not_called()
        register.assert_not_called()
        self.assertEqual(self.output.read_text(), "broken existing JSON")

    def test_bad_new_facts_do_not_replace_existing_profile(self):
        self.output.write_text('{"fir_number": "123/2026"}')
        previous = self.output.read_bytes()
        with self.model_response('{"hearing_events": ["not an event object"]}'), \
                patch.object(self.case, "register_case_facts_path") as register:
            with self.assertRaises(ValueError):
                self.case.save_profile_update(str(self.input), str(self.output), "demo")
        self.assertEqual(self.output.read_bytes(), previous)
        register.assert_not_called()

    def test_summary_failure_preserves_original_memory_and_file(self):
        existing = {"hearing_events": [{"date": "12/03/2026", "type": "past_hearing"}]}
        before = deepcopy(existing)
        self.output.write_text(json.dumps(existing))
        previous_bytes = self.output.read_bytes()
        with patch.object(self.case, "extract_narrative_facts", return_value={
            "hearing_events": [{"date": "12/03/2026", "outcome": "adjourned"}]
        }), patch.object(self.case, "generate_status_summary", side_effect=RuntimeError("offline")):
            with self.assertRaises(RuntimeError):
                self.case.extract_and_merge_case_facts("Update", existing)
            with self.assertRaises(RuntimeError):
                self.case.save_profile_update(str(self.input), str(self.output), "demo")
        self.assertEqual(existing, before)
        self.assertEqual(self.output.read_bytes(), previous_bytes)

    def test_failed_replacement_keeps_existing_file_and_cleans_temporary_file(self):
        self.output.write_text('{"fir_number": "123/2026"}')
        previous = self.output.read_bytes()
        with patch.object(self.case, "extract_and_merge_case_facts", return_value={"fir_number": "123/2026"}), \
                patch.object(self.case.os, "replace", side_effect=OSError("disk error")), \
                patch.object(self.case, "register_case_facts_path") as registry:
            with self.assertRaises(OSError):
                self.case.save_profile_update(str(self.input), str(self.output), "demo")
        self.assertEqual(self.output.read_bytes(), previous)
        self.assertEqual(set(self.root.iterdir()), {self.input, self.output})
        registry.assert_not_called()

    def test_explicit_source_cannot_overwrite_another_existing_destination(self):
        source = self.root / "other.json"
        source.write_text("{}")
        self.output.write_text('{"fir_number": "123/2026"}')
        with patch.object(self.case, "extract_narrative_facts") as extract:
            with self.assertRaisesRegex(ValueError, "differs from --existing"):
                self.case.save_profile_update(str(self.input), str(self.output), "demo", str(source))
        extract.assert_not_called()
        self.assertEqual(json.loads(self.output.read_text())["fir_number"], "123/2026")


if __name__ == "__main__":
    unittest.main()
