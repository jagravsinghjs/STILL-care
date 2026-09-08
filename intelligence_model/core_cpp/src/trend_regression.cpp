#include "trend_regression.h"

#include <cmath>

namespace still {

TrendRegressor::TrendRegressor(double half_life_days, double confidence_growth_rate) noexcept
    : half_life_days_(half_life_days), confidence_growth_rate_(confidence_growth_rate) {}

TrendResult TrendRegressor::fit(const std::vector<TrendPoint> &points) const noexcept {
    const std::size_t n = points.size();
    if (n < 2) {
        return TrendResult{};
    }

    const double most_recent_t = points.back().timestamp_days;
    // Decay constant such that weight halves every half_life_days_ of age.
    const double decay_lambda = std::log(2.0) / half_life_days_;

    // Two passes over `points` (one for the weighted means, one for the
    // weighted covariance/variance) recomputing exp() each time, rather
    // than caching weights in a std::vector<double>: session counts here
    // are small (tens, not thousands), so a couple of extra transcendental
    // calls is cheaper than a heap allocation on every trend computation.
    double sum_w = 0.0, sum_wx = 0.0, sum_wy = 0.0;
    for (const auto &p : points) {
        const double age = most_recent_t - p.timestamp_days; // >= 0, points sorted ascending
        const double w = std::exp(-decay_lambda * age);
        sum_w += w;
        sum_wx += w * p.timestamp_days;
        sum_wy += w * p.mean_score;
    }
    const double x_bar = sum_wx / sum_w;
    const double y_bar = sum_wy / sum_w;

    double sum_w_dx_dy = 0.0, sum_w_dx2 = 0.0;
    for (const auto &p : points) {
        const double age = most_recent_t - p.timestamp_days;
        const double w = std::exp(-decay_lambda * age);
        const double dx = p.timestamp_days - x_bar;
        const double dy = p.mean_score - y_bar;
        sum_w_dx_dy += w * dx * dy;
        sum_w_dx2 += w * dx * dx;
    }

    // All points sharing the same timestamp makes the slope undefined --
    // report 0 rather than dividing by (near) zero.
    const double slope = (sum_w_dx2 > 1e-12) ? (sum_w_dx_dy / sum_w_dx2) : 0.0;

    // Confidence grows with sample count but asymptotically approaches --
    // never reaches -- 1.0, so even a long history keeps a little
    // epistemic humility baked in ("never reported with false certainty",
    // per architecture.md).
    const double confidence = 1.0 - std::exp(-confidence_growth_rate_ * static_cast<double>(n - 1));

    return TrendResult{slope, confidence};
}

} // namespace still