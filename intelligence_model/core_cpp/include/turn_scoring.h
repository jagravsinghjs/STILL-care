#pragma once
 
namespace still {
 
// Mirrors schemas.ArousalLabel by *enumerator name* (LOW/MODERATE/HIGH).
// pybind11 enums bind by name, not by pydantic's lowercase string value, so
// the Python glue layer (Module 11, not yet built) converts via
// `still_core.ArousalLabel[pydantic_label.name]`.
enum class ArousalLabel { LOW, MODERATE, HIGH };
 
// Mirrors setu_schemas.ArousalFeatures field-for-field.
struct ArousalFeatures {
    double pitch_mean = 0.0;
    double pitch_std = 0.0;
    double energy = 0.0;
    double zero_crossing_rate = 0.0;
    double pause_ratio = 0.0;
    ArousalLabel arousal_label = ArousalLabel::LOW;
};
// Mirrors setu_schemas.EmotionScores field-for-field.
struct EmotionScores {
    double anger = 0.0;
    double disgust = 0.0;
    double fear = 0.0;
    double joy = 0.0;
    double neutral = 0.0;
    double sadness = 0.0;
    double surprise = 0.0;
};
 
// Result of scoring a single turn: a 0-100 distress score plus the
// high-pause flag, which setu_schemas.py's TurnScore keeps separate from
// the score itself ("surfaced separately, not folded into score").
struct TurnScoreResult {
    double score = 0.0;
    bool flagged_high_pause = false;
};
// Encapsulates the per-turn scoring formula and its tunable weights.
//
// Deliberately a plain, non-polymorphic class: there is exactly one
// scoring strategy today, so a virtual interface would only add a vtable
// indirection to a function that may run thousands of times per dashboard
// render, for no present benefit. If a second strategy is ever needed at
// runtime, promote this to an interface then -- don't pay for it now.
class TurnScorer {
public:
    // Weights are expected to sum to ~1.0 so the output stays within
    // [0, 100]; checked via assert() (debug builds only -- see .cpp) since
    // these are internal tuning constants, not untrusted external input.
    explicit TurnScorer(double arousal_weight = 0.4,
                         double pause_weight = 0.2,
                         double emotion_weight = 0.4,
                         double high_pause_threshold = 0.5) noexcept;
 
    // Pure function: no I/O, no shared state mutated -- safe to call
    // concurrently (e.g. batch-scoring turns for a dashboard) without
    // synchronization.
    [[nodiscard]] TurnScoreResult score(const ArousalFeatures &arousal,
                                        const EmotionScores &emotion) const noexcept;
 
private:
    double arousal_weight_;
    double pause_weight_;
    double emotion_weight_;
    double high_pause_threshold_;
};
 
} // namespace still