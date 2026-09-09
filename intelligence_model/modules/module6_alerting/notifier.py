"""
modules/module6_alerting/notifier.py

Module 16 -- thin client that pushes a freshly-inserted Alert to alertd
via its Unix domain socket, so connected supervisor dashboards get a
near-real-time push instead of waiting on the next poll.

alertd does not exist yet (deferred per the build order -- CMakeLists.txt
references its expected source paths, but alertd/alertd.c and
alertd/socket_server.c aren't written). This means every call here will
fail with a connection error until alertd is actually built and running.
That failure is caught and logged, never raised -- notification is a
best-effort enhancement on top of the real safety action (the Alert row
itself, already durably written to `alerts` by alert_engine.py before
this is ever called). A missing/down notifier must never make an alert
disappear or block the pipeline.
"""

from __future__ import annotations

import json
import logging
import os
import socket

from schemas.schemas import Alert

logger = logging.getLogger(__name__)

# Placeholder path -- alertd's actual socket path isn't defined anywhere
# yet since alertd itself doesn't exist. Configurable via env var so this
# doesn't need code changes once alertd's real path is decided.
ALERTD_SOCKET_PATH = os.environ.get("STILL_ALERTD_SOCKET_PATH", "/tmp/still_alertd.sock")

_SOCKET_TIMEOUT_SECONDS = 0.5  # fail fast -- this must never stall the pipeline


def notify_alertd(alert: Alert) -> bool:
    """
    Best-effort push of `alert` to alertd. Returns True if the socket
    accepted the message, False on any failure (socket missing, alertd
    not running, timeout, etc.) -- callers should treat False as "no-op,
    not an error."
    """
    payload = json.dumps(
        {
            "alert_id": alert.alert_id,
            "patient_id": alert.patient_id,
            "triggered_at": alert.triggered_at.isoformat(),
            "tier": alert.tier.value,
            "reason": alert.reason,
        }
    ).encode("utf-8")

    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
            sock.settimeout(_SOCKET_TIMEOUT_SECONDS)
            sock.connect(ALERTD_SOCKET_PATH)
            sock.sendall(payload)
        return True
    except OSError as exc:
        # FileNotFoundError (socket doesn't exist), ConnectionRefusedError
        # (alertd not listening), TimeoutError -- all expected until
        # alertd is built. Logged at debug, not warning/error, precisely
        # because this is the expected state right now, not a fault.
        logger.debug("notify_alertd: could not reach alertd at %s (%s)", ALERTD_SOCKET_PATH, exc)
        return False