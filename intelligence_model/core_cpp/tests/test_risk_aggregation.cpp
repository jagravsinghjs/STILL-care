#include "risk_aggregation.h"

#include <cassert>
#include <cmath>

using namespace still;

namespace {
bool approx(double a, double b, double eps = 1e-6) { return std::fabs(a - b) < eps; }
}

int main() {
    RiskAggregator aggregator; // defaults

    // Best-case: improving trend, low session score, low volatility -> low risk.
    {
        const RiskInputs inputs{/*trend_slope=*/2.0, /*trend_confidence=*/0.9,
                                /*session_mean_score=*/10.0, /*session_volatility=*/1.0,
                                /*session_within_trend=*/1.0, /*acute_override=*/false};
        const auto result = aggregator.aggregate(inputs);
        assert(result.risk_score < 20.0);
        assert(!result.contributing_features.empty());
    }

    // Worst-case, no acute override: worsening trend, high session score,
    // high volatility -> risk should be high.
    {
        const RiskInputs inputs{/*trend_slope=*/-5.0, /*trend_confidence=*/0.9,
                                /*session_mean_score=*/95.0, /*session_volatility=*/25.0,
                                /*session_within_trend=*/-5.0, /*acute_override=*/false};
        const auto result = aggregator.aggregate(inputs);
        assert(result.risk_score > 70.0);
    }

    // acute_override must force risk_score to exactly 100 regardless of how
    // benign every other feature looks -- matches test_module13.py's
    // requirement one layer up in Python.
    {
        const RiskInputs inputs{/*trend_slope=*/5.0, /*trend_confidence=*/0.9,
                                /*session_mean_score=*/5.0, /*session_volatility=*/0.0,
                                /*session_within_trend=*/5.0, /*acute_override=*/true};
        const auto result = aggregator.aggregate(inputs);
        assert(approx(result.risk_score, 100.0));

        bool found_override_feature = false;
        for (const auto &f : result.contributing_features) {
            if (f.name == "acute_override") {
                found_override_feature = true;
            }
        }
        assert(found_override_feature);
    }

    // Zero confidence in the trend should zero out its contribution to
    // risk, even with a sharply worsening slope -- an unreliable trend
    // shouldn't drive the score.
    {
        const RiskInputs inputs{/*trend_slope=*/-10.0, /*trend_confidence=*/0.0,
                                /*session_mean_score=*/0.0, /*session_volatility=*/0.0,
                                /*session_within_trend=*/0.0, /*acute_override=*/false};
        const auto result = aggregator.aggregate(inputs);
        assert(approx(result.risk_score, 0.0));
    }

    return 0;
}