"""

(De)serialization helpers between the JSON-blob TEXT columns in
db/schema.sql (arousal_json, emotion_json, features_json, factors_json,
categories_json, rationale_json) and their corresponding Pydantic models
from schemas/schemas.py.

"""

from __future__ import annotations

import json
from typing import Type, TypeVar

from pydantic import BaseModel

ModelT = TypeVar("ModelT", bound=BaseModel)


# --- single model <-> JSON ----------------------------------------------

def model_to_json(model: BaseModel) -> str:
    """Serialize a single Pydantic model (e.g. ArousalFeatures) to JSON."""
    return model.model_dump_json()


def model_from_json(json_str: str, model_cls: Type[ModelT]) -> ModelT:
    """Deserialize a JSON string (from a TEXT column) into `model_cls`."""
    return model_cls.model_validate_json(json_str)


# --- list[model] <-> JSON -------------------------------------------------
# Used for features_json (list[ContributingFeature]) and
# factors_json (list[ExplanationFactor]).

def model_list_to_json(models: list[BaseModel]) -> str:
    """Serialize a list of Pydantic models to a JSON array string."""
    return json.dumps([m.model_dump(mode="json") for m in models])


def model_list_from_json(json_str: str, model_cls: Type[ModelT]) -> list[ModelT]:
    """Deserialize a JSON array string into a list of `model_cls` instances."""
    raw = json.loads(json_str)
    return [model_cls.model_validate(item) for item in raw]


# --- list[str] <-> JSON ---------------------------------------------------
# Used for rationale_json (list[str], aligned by index with categories_json).

def str_list_to_json(items: list[str]) -> str:
    return json.dumps(items)


def str_list_from_json(json_str: str) -> list[str]:
    return json.loads(json_str)


# --- list[str-Enum] <-> JSON ----------------------------------------------
# Used for categories_json (list[InterventionCategory]).

def enum_list_to_json(items: list) -> str:
    """Serialize a list of str-Enum members (or already-plain strings) to JSON."""
    return json.dumps([item.value if hasattr(item, "value") else item for item in items])


def enum_list_from_json(json_str: str, enum_cls: type) -> list:
    """Deserialize a JSON array string into a list of `enum_cls` members."""
    raw = json.loads(json_str)
    return [enum_cls(value) for value in raw]