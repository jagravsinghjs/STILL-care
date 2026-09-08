#include "trend_regression.h"

#include <cassert>
#include <cmath>
#include <vector>

using namespace still;

namespace {
bool approx(double a, double b, double eps = 1e-4) { return std::fabs(a - b) < eps; }
}

int main() {
    TrendRegressor regressor; // defaults: half_life=14 days, growth_rate=0.5

    // Fewer than 2 points: no trend to speak of.
    {
        const std::vector<TrendPoint> one{{0.0, 50.0}};
        const auto r1 = regressor.fit(one);
        assert(approx(r1.slope, 0.0));
        assert(approx(r1.confidence, 0.0));

        const std::vector<TrendPoint> none{};
        const auto r0 = regressor.fit(none);
        assert(approx(r0.slope, 0.0));
        assert(approx(r0.confidence, 0.0));
    }

    // With a very long half-life (weighting ~uniform), the slope should
    // closely match plain OLS on a perfectly linear sequence: 1.0 point/day.
    {
        const TrendRegressor loose_decay(/*half_life_days=*/100000.0);
        const std::vector<TrendPoint> points{{0.0, 50.0}, {1.0, 51.0}, {2.0, 52.0}, {3.0, 53.0}};
        const auto result = loose_decay.fit(points);
        assert(approx(result.slope, 1.0, 1e-2));
    }

    // Confidence should increase with more data points, but never reach 1.0.
    {
        const std::vector<TrendPoint> two{{0.0, 50.0}, {1.0, 40.0}};
        const std::vector<TrendPoint> five{
            {0.0, 50.0}, {1.0, 45.0}, {2.0, 40.0}, {3.0, 35.0}, {4.0, 30.0},
        };
        const auto r2 = regressor.fit(two);
        const auto r5 = regressor.fit(five);
        assert(r5.confidence > r2.confidence);
        assert(r5.confidence < 1.0);
    }

    // Recency weighting: with a short half-life, a sharp recent reversal
    // should dominate an otherwise clearly-improving series.
    {
        const TrendRegressor short_decay(/*half_life_days=*/1.0);
        const std::vector<TrendPoint> points{
            {0.0, 30.0}, {1.0, 32.0}, {2.0, 34.0}, {3.0, 36.0}, // improving for a while
            {4.0, 20.0},                                        // sharp recent worsening
        };
        const auto result = short_decay.fit(points);
        assert(result.slope < 0.0);
    }

    return 0;
}