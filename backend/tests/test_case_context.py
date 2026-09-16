from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from backend.case_context import save_case_context
from backend.database import connect, initialize_schema


class CaseContextTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.db_path = self.root / "still.db"
        initialize_schema(self.db_path)
        self.conn = connect(self.db_path)
        self.previous_root = os.environ.get("STILL_CASE_FACTS_DIR")
        os.environ["STILL_CASE_FACTS_DIR"] = str(self.root / "facts")

    def tearDown(self) -> None:
        self.conn.close()
        if self.previous_root is None:
            os.environ.pop("STILL_CASE_FACTS_DIR", None)
        else:
            os.environ["STILL_CASE_FACTS_DIR"] = self.previous_root
        self.directory.cleanup()

    @patch("backend.case_context._extractor")
    def test_saves_and_registers_the_merged_case_facts(self, extractor) -> None:
        extractor.return_value = lambda text, existing_facts: {"status_summary": text, "prior": existing_facts}
        path = save_case_context(self.conn, patient_id="patient.001", display_name="Asha Devi", text="FIR 12/2026")
        self.conn.commit()
        self.assertEqual(json.loads(path.read_text())["status_summary"], "FIR 12/2026")
        registry = self.conn.execute("SELECT case_facts_path FROM patients WHERE patient_id = ?", ("patient.001",)).fetchone()
        self.assertEqual(registry["case_facts_path"], str(path))


if __name__ == "__main__":
    unittest.main()
