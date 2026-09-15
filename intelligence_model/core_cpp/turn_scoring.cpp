#include "turn_scoring.h"

#include <algorithm>
#include <cassert>
#include <cmath>

namespace still {

namespace {

// Arousal label -> base 0-100 contribution, before weighting. Indexed
// directly by the ArousalLabel enum's underlying value (LOW=0, MODERATE=1,
// HIGH=2) -- a lookup table instead of a switch to avoid a branch here,
// since this runs on every single turn.
constexpr double kArousalBase[3] = {0.0, 50.0, 100.0};

[[nodiscard]] inline double clamp0_100(double v) noexcept {
    return std::min(100.0, std::max(0.0, v));
}

} // namespace

TurnScorer::TurnScorer(double arousal_weight, double pause_weight,
                        double emotion_weight, double high_pause_threshold) noexcept
    : arousal_weight_(arousal_weight),
      pause_weight_(pause_weight),
      emotion_weight_(emotion_weight),
      high_pause_threshold_(high_pause_threshold) {
    assert(arousal_weight_ >= 0.0 && pause_weight_ >= 0.0 && emotion_weight_ >= 0.0);
    assert(std::abs((arousal_weight_ + pause_weight_ + emotion_weight_) - 1.0) < 1e-6);
}

TurnScoreResult TurnScorer::score(const ArousalFeatures &arousal,
                                   const EmotionScores &emotion) const noexcept {
    const double arousal_component = kArousalBase[static_cast<int>(arousal.arousal_label)];
    const double pause_component = clamp0_100(arousal.pause_ratio * 100.0);

    // "Negative-emotion mass": the distress-bearing portion of the emotion
    // distribution. Individual scores are bounded [0,1] but EmotionScores
    // has no constraint that they sum to 1, so this can exceed 1.0 for an
    // unusual input -- clamp defensively rather than trust the upstream
    // model's output shape.
    const double negative_mass = emotion.anger + emotion.disgust + emotion.fear + emotion.sadness;
    const double emotion_component = clamp0_100(negative_mass * 100.0);

    const double raw = arousal_weight_ * arousal_component
                      + pause_weight_ * pause_component
                      + emotion_weight_ * emotion_component;

    return TurnScoreResult{
        clamp0_100(raw),
        arousal.pause_ratio > high_pause_threshold_,
    };
}

} // namespace still