#pragma once

#include <string>
#include <vector>

namespace still {

// Mirrors setu_schemas.ContributingFeature exactly.
struct ContributingFeature {
    std::string name;
    double value = 0.0;
    double weight = 0.0;
};

// The numeric inputs Module 13's heuristic needs -- deliberately just
// scalar features, not full DistressTrend/SessionSummary objects, so this
// layer has zero dependency on the Python-side schemas or on session/
// patient identity. Module 13's Python code pulls these out of the actual
// DistressTrend/SessionSummary rows before calling in.
struct RiskInputs {
    double trend_slope = 0.0;
    double trend_confidence = 0.0;
    double session_mean_score = 0.0;
    double session_volatility = 0.0;
    double session_within_trend = 0.0;
    bool acute_override = false;
};

// Mirrors the numeric fields of setu_schemas.EscalationRisk (risk_score,
// contributing_features) -- patient_id/session_id/assessed_at/risk_level
// are Python-side concerns layered on top.
struct RiskAssessment {
    double risk_score = 0.0;
    std::vector<ContributingFeature> contributing_features;
};

// Weighted-sum heuristic combining trend + session-level signals into a
// single 0-100 risk score with a breakdown of what drove it.
//
// Non-polymorphic for the same reason as TurnScorer/TrendRegressor: this
// heuristic is Module 13's day-1 fallback by design (architecture.md),
// meant to run standalone even before a trained model exists -- a concrete
// class rather than an interface keeps that fallback path trivially simple
// to reason about and call directly.
class RiskAggregator {
public:
    explicit RiskAggregator(double trend_weight = 0.4,
                            double session_score_weight = 0.35,
                            double volatility_weight = 0.25,
                            double volatility_scale = 4.0) noexcept;

    [[nodiscard]] RiskAssessment aggregate(const RiskInputs &inputs) const;

private:
    double trend_weight_;
    double session_score_weight_;
    double volatility_weight_;
    double volatility_scale_; // volatility points -> 0-100 scale divisor
};

} // namespace still