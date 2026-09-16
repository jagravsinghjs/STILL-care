from __future__ import annotations

import os
import tempfile
import threading
import time
import shutil
from pathlib import Path
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import json
import uvicorn

from backend.main import app

SOURCE_DB = Path(__file__).parents[2] / "intelligence_model" / "data" / "still.db"


class RegisterEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.db_path = Path(self.directory.name) / "still.db"
        shutil.copy2(SOURCE_DB, self.db_path)
        self.previous_path = os.environ.get("STILL_DB_PATH")
        self.previous_secret = os.environ.get("STILL_JWT_SECRET")
        os.environ["STILL_DB_PATH"] = str(self.db_path)
        os.environ["STILL_JWT_SECRET"] = "test-secret-that-is-at-least-thirty-two-characters"
        self.server = uvicorn.Server(
            uvicorn.Config(app, host="127.0.0.1", port=8018, log_level="error")
        )
        self.thread = threading.Thread(target=self.server.run, daemon=True)
        self.thread.start()
        deadline = time.monotonic() + 5
        while not self.server.started:
            if time.monotonic() > deadline:
                self.fail("Timed out waiting for the test server to start")
            time.sleep(0.01)

    def tearDown(self) -> None:
        self.server.should_exit = True
        self.thread.join(timeout=5)
        if self.previous_path is None:
            os.environ.pop("STILL_DB_PATH", None)
        else:
            os.environ["STILL_DB_PATH"] = self.previous_path
        if self.previous_secret is None:
            os.environ.pop("STILL_JWT_SECRET", None)
        else:
            os.environ["STILL_JWT_SECRET"] = self.previous_secret
        self.directory.cleanup()

    def test_register_endpoint_creates_a_student_identity(self) -> None:
        payload = {"name": "Asha Devi", "user_id": "patient.001", "password": "safe-password-1"}
        status, body = self.post("/api/auth/register", payload)
        self.assertEqual(status, 201)
        self.assertEqual(body, {"id": "patient.001", "name": "Asha Devi", "role": "STUDENT"})

        status, body = self.post("/api/auth/register", payload)
        self.assertEqual(status, 409)
        self.assertNotIn("safe-password-1", json.dumps(body))

    def test_login_endpoint_returns_a_bearer_token(self) -> None:
        self.post("/api/auth/register", {"name": "Asha Devi", "user_id": "patient.001", "password": "safe-password-1"})
        status, body = self.post("/api/auth/login", {"email": "patient.001", "password": "safe-password-1"})
        self.assertEqual(status, 200)
        self.assertEqual(body["token_type"], "bearer")
        self.assertTrue(body["access_token"].count(".") == 2)
        self.assertEqual(body["user"], {"id": "patient.001", "name": "Asha Devi", "role": "STUDENT"})

        status, body = self.get("/api/auth/me", body["access_token"])
        self.assertEqual(status, 200)
        self.assertEqual(body, {"id": "patient.001", "name": "Asha Devi", "role": "STUDENT"})

    @staticmethod
    def post(path: str, payload: dict) -> tuple[int, dict]:
        request = Request(
            f"http://127.0.0.1:8018{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request) as response:
                return response.status, json.loads(response.read())
        except HTTPError as error:
            return error.code, json.loads(error.read())

    @staticmethod
    def get(path: str, token: str) -> tuple[int, dict]:
        request = Request(
            f"http://127.0.0.1:8018{path}",
            headers={"Authorization": f"Bearer {token}"},
            method="GET",
        )
        try:
            with urlopen(request) as response:
                return response.status, json.loads(response.read())
        except HTTPError as error:
            return error.code, json.loads(error.read())


if __name__ == "__main__":
    unittest.main()
