#pragma once

#include <vector>

namespace still {

// One (time, mean_score) observation across sessions -- the input to
// Module 12's cross-session trend. `timestamp_days` is caller-computed
// (e.g. days since the patient's first session) since this layer has no
// notion of wall-clock time or timezones; keeping that conversion in
// Python keeps this class a pure numeric routine.
struct TrendPoint {
    double timestamp_days = 0.0;
    double mean_score = 0.0;
};

// Mirrors the numeric fields of setu_schemas.DistressTrend (slope,
// confidence) -- trend_label/window_sessions/patient_id are Python-side
// concerns layered on top of this raw result.
struct TrendResult {
    double slope = 0.0;
    double confidence = 0.0;
};

// Recency-weighted linear regression: more recent sessions influence the
// slope more than older ones, so a patient improving over the last two
// sessions after a long stable stretch isn't hidden by the average of
// everything that came before.
//
// Non-polymorphic for the same reason as TurnScorer: one strategy, called
// often, no present need for runtime substitutability.
class TrendRegressor {
public:
    // half_life_days: how quickly a point's influence decays with age. A
    // point exactly half_life_days older than the most recent point in the
    // series carries half the regression weight of the most recent one.
    explicit TrendRegressor(double half_life_days = 14.0,
                             double confidence_growth_rate = 0.5) noexcept;

    // Requires `points` sorted ascending by timestamp_days (callers already
    // read session_summary ordered by computed_at). Returns
    // {slope: 0, confidence: 0} for fewer than 2 points -- a single session
    // has no trend to speak of.
    [[nodiscard]] TrendResult fit(const std::vector<TrendPoint> &points) const noexcept;

private:
    double half_life_days_;
    double confidence_growth_rate_;
};

} // namespace still