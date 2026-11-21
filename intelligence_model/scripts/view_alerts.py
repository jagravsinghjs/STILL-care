"""Local prototype supervisor queue; does not implement account authentication."""

import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db.connection import init_schema
from db.repository import get_session, get_unacknowledged_alerts
from modules.module6_alerting import check_session_review


def main(argv=None):
    parser = argparse.ArgumentParser(description="View pending patient-review alerts from STILL_DB_PATH")
    parser.add_argument("--patient-id", help="Filter to one patient; omit for the local supervisor queue")
    parser.add_argument("--review-session", help="Explicitly evaluate an existing session under the new rules")
    args = parser.parse_args(argv)
    init_schema()
    if args.review_session:
        session = get_session(args.review_session)
        if session is None:
            parser.error("Session not found")
        if args.patient_id and session["patient_id"] != args.patient_id:
            parser.error("Session belongs to a different patient")
        check_session_review(args.review_session)
    alerts = get_unacknowledged_alerts(args.patient_id)
    if not alerts:
        print("No pending supervisor review alerts.")
    for alert in alerts:
        print(f"[{alert.priority.upper()}] Patient {alert.patient_id} | alert {alert.alert_id}")
        print(alert.reason)
        print(f"Recorded: {alert.triggered_at.isoformat()} | monitoring tier: {alert.tier.value}\n")


if __name__ == "__main__":
    main()
