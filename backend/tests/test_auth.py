from __future__ import annotations

import tempfile
import os
from pathlib import Path
import unittest

from backend.auth import (
    AuthenticationError,
    DuplicateAccountError,
    decode_access_token,
    issue_access_token,
    register_student,
    verify_password,
)
from backend.database import connect, initialize_schema


class RegistrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.db_path = Path(self.directory.name) / "still.db"
        initialize_schema(self.db_path)
        self.conn = connect(self.db_path)
        self.previous_secret = os.environ.get("STILL_JWT_SECRET")
        os.environ["STILL_JWT_SECRET"] = "test-secret-that-is-at-least-thirty-two-characters"

    def tearDown(self) -> None:
        self.conn.close()
        if self.previous_secret is None:
            os.environ.pop("STILL_JWT_SECRET", None)
        else:
            os.environ["STILL_JWT_SECRET"] = self.previous_secret
        self.directory.cleanup()

    def test_registers_a_student_with_a_verifiable_password(self) -> None:
        account = register_student(
            self.conn, user_id="patient.001", name="Asha Devi", password="safe-password-1"
        )
        self.conn.commit()
        row = self.conn.execute("SELECT * FROM accounts WHERE user_id = ?", (account.user_id,)).fetchone()
        self.assertEqual((account.user_id, account.display_name, account.role), ("patient.001", "Asha Devi", "STUDENT"))
        self.assertEqual(row["role"], "STUDENT")
        self.assertNotEqual(row["password_hash"], "safe-password-1")
        self.assertTrue(verify_password("safe-password-1", row["password_hash"]))
        self.assertFalse(verify_password("wrong-password", row["password_hash"]))

    def test_rejects_duplicate_user_ids(self) -> None:
        register_student(self.conn, user_id="patient.001", name="Asha Devi", password="safe-password-1")
        with self.assertRaises(DuplicateAccountError):
            register_student(self.conn, user_id="patient.001", name="Other Name", password="safe-password-2")

    def test_issues_a_signed_expiring_access_token(self) -> None:
        account = register_student(self.conn, user_id="patient.001", name="Asha Devi", password="safe-password-1")
        token = issue_access_token(account)
        claims = decode_access_token(token)
        self.assertEqual(claims["sub"], "patient.001")
        self.assertEqual(claims["role"], "STUDENT")
        with self.assertRaises(AuthenticationError):
            decode_access_token(token + "tampered")


if __name__ == "__main__":
    unittest.main()
