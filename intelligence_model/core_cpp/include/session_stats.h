#pragma once

#include <vector>

namespace still {

// Mirrors the aggregate (non-timeline) fields of setu_schemas.SessionSummary.
struct SessionStats {
    double mean_score = 0.0;
    double max_score = 0.0;
    double min_score = 0.0;
    double volatility = 0.0;           // sample std dev of turn scores
    double within_session_trend = 0.0; // slope, first-third vs last-third
};

// Stateless aggregate calculator -- no configuration needed today, so this
// is a class of one static method rather than a free function purely to
// group all session-level math under one discoverable type on the Python
// side (`still_core.SessionStatsCalculator.compute(...)`), matching
// TurnScorer/TrendRegressor/RiskAggregator's naming pattern.
class SessionStatsCalculator {
public:
    SessionStatsCalculator() = delete; // never instantiated -- static-only

    // `scores` should be in chronological order. Returns all zeros for an
    // empty input rather than throwing: this runs in Module 11's
    // aggregation path where callers already guarantee a non-empty
    // timeline (a session with zero scored turns is never summarized), so
    // a thrown exception would only add overhead for a precondition
    // callers already uphold.
    [[nodiscard]] static SessionStats compute(const std::vector<double> &scores) noexcept;
};

} // namespace still