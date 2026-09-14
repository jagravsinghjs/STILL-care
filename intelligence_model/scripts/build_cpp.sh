#!/usr/bin/env bash
#
# scripts/build_cpp.sh
#
# Configures and builds still_core (the pybind11 C++ extension) and
# alertd via the top-level CMakeLists.txt. Just the cmake invocation --
# assumes the venv (.model) is already active with pybind11 already
# installed in it (per requirements.txt / pyproject.toml's build-system).
# `pip install -e .` already does this same build as part of an editable
# install; this script is for iterating on core_cpp/alertd directly
# without going through pip each time.
#
# Usage: run from the intelligence_model/ repo root.
#   ./scripts/build_cpp.sh
#   STILL_BUILD_ALERTD=OFF ./scripts/build_cpp.sh   # skip alertd, C++ only

set -euo pipefail

STILL_BUILD_ALERTD="${STILL_BUILD_ALERTD:-ON}"

cmake -S . -B build -DSTILL_BUILD_ALERTD="${STILL_BUILD_ALERTD}"
cmake --build build