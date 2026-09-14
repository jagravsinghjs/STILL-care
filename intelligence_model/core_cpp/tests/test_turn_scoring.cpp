#include "turn_scoring.h"

#include <cassert>
#include <cmath>

using namespace still;

namespace {
bool approx(double a, double b, double eps = 1e-6) { return std::fabs(a - b) < eps; }
}

int main() {
    TurnScorer scorer; // default weights: 0.4 arousal, 0.2 pause, 0.4 emotion

    // All-zero emotion, LOW arousal, zero pause -> score should be 0.
    {
        ArousalFeatures a{};
        a.arousal_label = ArousalLabel::LOW;
        a.pause_ratio = 0.0;
        EmotionScores e{}; // all zero
        const auto result = scorer.score(a, e);
        assert(approx(result.score, 0.0));
        assert(!result.flagged_high_pause);
    }

    // Max arousal, max pause, max negative emotion -> score saturates at 100.
    {
        ArousalFeatures a{};
        a.arousal_label = ArousalLabel::HIGH;
        a.pause_ratio = 1.0;
        EmotionScores e{};
        e.anger = 1.0;
        e.disgust = 1.0;
        e.fear = 1.0;
        e.sadness = 1.0;
        const auto result = scorer.score(a, e);
        assert(approx(result.score, 100.0));
        assert(result.flagged_high_pause); // 1.0 > default threshold 0.5
    }

    // Missing/default fields (aggregate-initialized struct) should behave
    // like all-zero input, not crash or produce NaN.
    {
        ArousalFeatures a{}; // defaults: LOW, all zeros
        EmotionScores e{};   // defaults: all zeros
        const auto result = scorer.score(a, e);
        assert(approx(result.score, 0.0));
        assert(!result.flagged_high_pause);
    }

    // Pause ratio exactly at the threshold should NOT flag (strictly >).
    {
        ArousalFeatures a{};
        a.pause_ratio = 0.5;
        EmotionScores e{};
        const auto result = scorer.score(a, e);
        assert(!result.flagged_high_pause);
    }

    // MODERATE arousal alone (nothing else) -> exactly half the arousal
    // weight's contribution, nothing else.
    {
        ArousalFeatures a{};
        a.arousal_label = ArousalLabel::MODERATE;
        EmotionScores e{};
        const auto result = scorer.score(a, e);
        assert(approx(result.score, 0.4 * 50.0)); // arousal_weight * base(MODERATE)
    }

    return 0;
}