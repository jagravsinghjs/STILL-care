"""tests/test_module7.py -- Module 17 (intervention recommendation)."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from db.connection import get_raw_connection, init_schema
from db.repository import get_pending_interventions
from modules.module7_intervention import recommend_interventions
from schemas.schemas import InterventionCategory, RiskStatus, RiskTier

PATIENT_ID = "patient-001"
NOW = datetime.now(timezone.utc)


@pytest.fixture
def conn(tmp_path):
    db_path = tmp_path / "test_still.db"
    init_schema(db_path=db_path)
    connection = get_raw_connection(db_path=db_path)
    yield connection
    connection.close()


def _status(tier: RiskTier) -> RiskStatus:
    return RiskStatus(
        patient_id=PATIENT_ID, tier=tier, tier_since=NOW,
        previous_tier=None, consecutive_high_assessments=0,
    )


def test_green_tier_no_acute_recommends_nothing(conn):
    result = recommend_interventions(_status(RiskTier.GREEN), acute_override=False, conn=conn)
    assert result is None
    assert get_pending_interventions(PATIENT_ID, conn=conn) == []


def test_yellow_tier_recommends_counselling_only(conn):
    result = recommend_interventions(_status(RiskTier.YELLOW), acute_override=False, conn=conn)
    assert result is not None
    assert result.categories == [InterventionCategory.COUNSELLING]
    assert result.accepted is None
    assert len(result.rationale) == 1


def test_red_tier_recommends_counselling_and_protection(conn):
    result = recommend_interventions(_status(RiskTier.RED), acute_override=False, conn=conn)
    assert result is not None
    assert InterventionCategory.COUNSELLING in result.categories
    assert InterventionCategory.PROTECTION_RELOCATION in result.categories
    assert InterventionCategory.MEDICAL not in result.categories
    assert len(result.categories) == len(result.rationale)  # aligned by index


def test_acute_override_adds_medical_even_at_green(conn):
    """acute_override can theoretically coexist with any tier in this
    function's inputs (though in practice Module 15 forces RED on acute
    override) -- MEDICAL should trigger on the flag alone."""
    result = recommend_interventions(_status(RiskTier.GREEN), acute_override=True, conn=conn)
    assert result is not None
    assert InterventionCategory.MEDICAL in result.categories


def test_red_tier_with_acute_override_recommends_all_three(conn):
    result = recommend_interventions(_status(RiskTier.RED), acute_override=True, conn=conn)
    assert result is not None
    assert set(result.categories) == {
        InterventionCategory.COUNSELLING,
        InterventionCategory.MEDICAL,
        InterventionCategory.PROTECTION_RELOCATION,
    }


def test_persisted_and_retrievable(conn):
    recommend_interventions(_status(RiskTier.RED), acute_override=False, conn=conn)
    pending = get_pending_interventions(PATIENT_ID, conn=conn)
    assert len(pending) == 1
    assert pending[0].accepted is None

