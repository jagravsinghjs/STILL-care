"""
api/main.py

The mount point. This module's `app` object is a complete, standalone
FastAPI instance -- the main Setu backend mounts it as a sub-application
(see api/README.md's wiring section for the exact code). It is NOT meant
to be run standalone in production; there's no auth, no CORS config, no
rate limiting here, because all of that is the main backend's job.
"""

from __future__ import annotations

from fastapi import FastAPI

from .routes_alerts import router as alerts_router
from .routes_dashboard import router as dashboard_router
from .routes_interventions import router as interventions_router
from .routes_reports import router as reports_router

app = FastAPI(
    title="Still — Monitoring & Intelligence layer",
    description="Modules 11-17. Mounted as a sub-application by the main Setu backend.",
)

app.include_router(reports_router)
app.include_router(dashboard_router)
app.include_router(alerts_router)
app.include_router(interventions_router)