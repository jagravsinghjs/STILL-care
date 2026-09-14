#include "session_stats.h"

#include <algorithm>
#include <cmath>
#include <numeric>

namespace still {

SessionStats SessionStatsCalculator::compute(const std::vector<double> &scores) noexcept {
    if (scores.empty()) {
        return SessionStats{};
    }

    const std::size_t n = scores.size();
    using Diff = std::vector<double>::difference_type;

    const double sum = std::accumulate(scores.begin(), scores.end(), 0.0);
    const double mean = sum / static_cast<double>(n);
    const auto [min_it, max_it] = std::minmax_element(scores.begin(), scores.end());

    double volatility = 0.0;
    if (n > 1) {
        double sq_diff_sum = 0.0;
        for (const double s : scores) {
            const double d = s - mean;
            sq_diff_sum += d * d;
        }
        // Sample standard deviation (n-1 denominator): with only a handful
        // of turns per session, the population variant would systematically
        // understate spread.
        volatility = std::sqrt(sq_diff_sum / static_cast<double>(n - 1));
    }

    // within_session_trend: slope between the mean of the first third and
    // the mean of the last third of the session (architecture.md). The "x"
    // axis is turn index; normalizing by the index distance between each
    // third's representative (midpoint) index keeps the value comparable
    // across sessions of different length.
    double within_session_trend = 0.0;
    if (n >= 3) {
        const std::size_t third = n / 3;
        const double first_third_mean =
            std::accumulate(scores.begin(), scores.begin() + static_cast<Diff>(third), 0.0)
            / static_cast<double>(third);
        const double last_third_mean =
            std::accumulate(scores.end() - static_cast<Diff>(third), scores.end(), 0.0)
            / static_cast<double>(third);

        const double first_mid_index = (static_cast<double>(third) - 1.0) / 2.0;
        const double last_mid_index =
            static_cast<double>(n - third) + (static_cast<double>(third) - 1.0) / 2.0;
        const double index_distance = last_mid_index - first_mid_index;

        within_session_trend = (index_distance > 0.0)
            ? (last_third_mean - first_third_mean) / index_distance
            : 0.0;
    }
    // n < 3: not enough turns to meaningfully split into thirds -- trend
    // stays 0.0 rather than a misleadingly precise number from 1-2 points.

    return SessionStats{
        mean,
        *max_it,
        *min_it,
        volatility,
        within_session_trend,
    };
}

} // namespace still