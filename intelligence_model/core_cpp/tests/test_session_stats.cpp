#include "session_stats.h"

#include <cassert>
#include <cmath>
#include <vector>

using namespace still;

namespace {
bool approx(double a, double b, double eps = 1e-6) { return std::fabs(a - b) < eps; }
}

int main() {
    // Constant sequence: no volatility, no trend.
    {
        const std::vector<double> scores{50.0, 50.0, 50.0, 50.0, 50.0, 50.0};
        const auto stats = SessionStatsCalculator::compute(scores);
        assert(approx(stats.mean_score, 50.0));
        assert(approx(stats.max_score, 50.0));
        assert(approx(stats.min_score, 50.0));
        assert(approx(stats.volatility, 0.0));
        assert(approx(stats.within_session_trend, 0.0));
    }

    // Monotonically increasing sequence: positive, hand-computed trend.
    // first-third mean = 20, last-third mean = 80, index distance = 6
    // -> slope = (80-20)/6 = 10.
    {
        const std::vector<double> scores{10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0};
        const auto stats = SessionStatsCalculator::compute(scores);
        assert(approx(stats.mean_score, 50.0));
        assert(approx(stats.max_score, 90.0));
        assert(approx(stats.min_score, 10.0));
        assert(approx(stats.within_session_trend, 10.0));
    }

    // Oscillating sequence: first-third mean == last-third mean -> trend 0,
    // but volatility should be clearly nonzero.
    {
        const std::vector<double> scores{10.0, 90.0, 10.0, 90.0, 10.0, 90.0};
        const auto stats = SessionStatsCalculator::compute(scores);
        assert(approx(stats.within_session_trend, 0.0));
        assert(stats.volatility > 30.0);
    }

    // Single element: mean/max/min all equal it, no volatility, no trend.
    {
        const std::vector<double> scores{42.0};
        const auto stats = SessionStatsCalculator::compute(scores);
        assert(approx(stats.mean_score, 42.0));
        assert(approx(stats.max_score, 42.0));
        assert(approx(stats.min_score, 42.0));
        assert(approx(stats.volatility, 0.0));
        assert(approx(stats.within_session_trend, 0.0));
    }

    // Two elements: below the n>=3 threshold for a meaningful trend.
    {
        const std::vector<double> scores{10.0, 90.0};
        const auto stats = SessionStatsCalculator::compute(scores);
        assert(approx(stats.within_session_trend, 0.0));
        assert(stats.volatility > 0.0); // volatility is still defined for n=2
    }

    // Empty input: defined as all-zero rather than undefined behavior.
    {
        const std::vector<double> scores{};
        const auto stats = SessionStatsCalculator::compute(scores);
        assert(approx(stats.mean_score, 0.0));
        assert(approx(stats.volatility, 0.0));
    }

    return 0;
}