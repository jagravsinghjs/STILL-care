#include "risk_aggregation.h"

#include <algorithm>

namespace still {

namespace {

[[nodiscard]] inline double clamp0_100(double v) noexcept {
    return std::min(100.0, std::max(0.0, v));
}

} // namespace

RiskAggregator::RiskAggregator(double trend_weight, double session_score_weight,
                                double volatility_weight, double volatility_scale) noexcept
    : trend_weight_(trend_weight),
      session_score_weight_(session_score_weight),
      volatility_weight_(volatility_weight),
      volatility_scale_(volatility_scale) {}

RiskAssessment RiskAggregator::aggregate(const RiskInputs &inputs) const {
    std::vector<ContributingFeature> features;
    features.reserve(4); // trend, session_score, volatility, (+ acute_override if present)

    // A negative slope (worsening) drives risk up; a positive slope drives
    // it down. Confidence modulates the contribution so a barely-confident
    // 2-session trend can't dominate the score the way a well-established
    // one can.
    const double trend_component = clamp0_100(-inputs.trend_slope * 100.0) * inputs.trend_confidence;
    features.push_back({"trend_slope", inputs.trend_slope, trend_weight_ * inputs.trend_confidence});

    const double session_component = clamp0_100(inputs.session_mean_score);
    features.push_back({"session_mean_score", inputs.session_mean_score, session_score_weight_});

    const double volatility_component = clamp0_100(inputs.session_volatility * volatility_scale_);
    features.push_back({"recent_volatility", inputs.session_volatility, volatility_weight_});

    double risk_score = trend_weight_ * trend_component
                       + session_score_weight_ * session_component
                       + volatility_weight_ * volatility_component;
    risk_score = clamp0_100(risk_score);

    if (inputs.acute_override) {
        // Per architecture.md / test_module13.py: an acute-keyword match
        // must force risk_level=HIGH regardless of every other feature.
        // Forcing the raw score to 100 here -- not just downstream in
        // Python's tier classification -- means that guarantee holds no
        // matter what thresholds Module 13/15 apply on top of this number.
        risk_score = 100.0;
        features.push_back({"acute_override", 1.0, 1.0});
    }

    return RiskAssessment{risk_score, std::move(features)};
}

} // namespace still