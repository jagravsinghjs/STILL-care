cmake_minimum_required(VERSION 3.18)
project(still_monitoring LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "" FORCE)
endif()

# Link-time optimization in Release builds: core_cpp's header/.cpp split
# (one declaration file, one definition file per component, per
# architecture.md) means calls like TurnScorer::score() cross a translation
# unit boundary and won't be inlined by a single-TU compile alone -- LTO
# lets the linker inline across that boundary anyway, at effectively zero
# cost to the file layout the doc calls for.
include(CheckIPOSupported)
check_ipo_supported(RESULT STILL_IPO_SUPPORTED OUTPUT STILL_IPO_ERROR)
if(STILL_IPO_SUPPORTED AND CMAKE_BUILD_TYPE STREQUAL "Release")
    set(CMAKE_INTERPROCEDURAL_OPTIMIZATION ON)
endif()

option(STILL_BUILD_CPP_TESTS "Build core_cpp/tests/* native unit test binaries" ON)
option(STILL_BUILD_ALERTD "Build the alertd C daemon alongside the Python extension" ON)

# ---------------------------------------------------------------------------
# pybind11
# ---------------------------------------------------------------------------
# `pip install -e .` builds this via scikit-build-core, inside the same venv
# where pybind11 is already installed (requirements.txt / build-system.requires).
# Ask the interpreter directly for pybind11's CMake config dir rather than
# assuming CMAKE_PREFIX_PATH is already set for us.
find_package(Python REQUIRED COMPONENTS Interpreter Development.Module)
execute_process(
    COMMAND "${Python_EXECUTABLE}" -m pybind11 --cmakedir
    OUTPUT_VARIABLE pybind11_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
)
find_package(pybind11 CONFIG REQUIRED)

# ---------------------------------------------------------------------------
# core_cpp -- numeric core (turn scoring, session stats, trend regression,
# risk aggregation) + its pybind11 binding module.
#
# Module name deliberately `still_core` (not the doc's literal `setu_core`)
# to match the still_monitoring package name -- flag if you'd rather keep
# `setu_core` verbatim.
# ---------------------------------------------------------------------------
set(CORE_CPP_MATH_SOURCES
    core_cpp/src/turn_scoring.cpp
    core_cpp/src/session_stats.cpp
    core_cpp/src/trend_regression.cpp
    core_cpp/src/risk_aggregation.cpp
)

pybind11_add_module(still_core
    core_cpp/src/bindings.cpp
    ${CORE_CPP_MATH_SOURCES}
)
target_include_directories(still_core PRIVATE core_cpp/include)

# Installed to the wheel root so `import still_core` resolves for
# modules/module11_session_analysis, module12_distress_monitoring, and
# module13_escalation_prediction exactly like any other top-level package.
install(TARGETS still_core DESTINATION .)

if(STILL_BUILD_CPP_TESTS)
    enable_testing()

    add_executable(test_turn_scoring
        core_cpp/tests/test_turn_scoring.cpp
        core_cpp/src/turn_scoring.cpp
    )
    target_include_directories(test_turn_scoring PRIVATE core_cpp/include)
    add_test(NAME test_turn_scoring COMMAND test_turn_scoring)

    add_executable(test_session_stats
        core_cpp/tests/test_session_stats.cpp
        core_cpp/src/session_stats.cpp
    )
    target_include_directories(test_session_stats PRIVATE core_cpp/include)
    add_test(NAME test_session_stats COMMAND test_session_stats)

    add_executable(test_trend_regression
        core_cpp/tests/test_trend_regression.cpp
        core_cpp/src/trend_regression.cpp
    )
    target_include_directories(test_trend_regression PRIVATE core_cpp/include)
    add_test(NAME test_trend_regression COMMAND test_trend_regression)

    add_executable(test_risk_aggregation
        core_cpp/tests/test_risk_aggregation.cpp
        core_cpp/src/risk_aggregation.cpp
    )
    target_include_directories(test_risk_aggregation PRIVATE core_cpp/include)
    add_test(NAME test_risk_aggregation COMMAND test_risk_aggregation)
endif()

# ---------------------------------------------------------------------------
# alertd -- standalone C real-time alert daemon. Independently buildable
# (per architecture.md's justification for splitting it out): disable with
# -DSTILL_BUILD_ALERTD=OFF if you only want the Python extension.
# ---------------------------------------------------------------------------
if(STILL_BUILD_ALERTD)
    find_package(Threads REQUIRED)
    find_package(SQLite3 REQUIRED)

    add_executable(alertd
        alertd/alertd.c
        alertd/socket_server.c
    )
    target_include_directories(alertd PRIVATE alertd ${SQLite3_INCLUDE_DIRS})
    target_link_libraries(alertd PRIVATE Threads::Threads ${SQLite3_LIBRARIES})
endif()