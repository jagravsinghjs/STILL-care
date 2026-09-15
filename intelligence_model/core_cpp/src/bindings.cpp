#include <pybind11/pybind11.h>
#include <pybind11/stl.h>

#include "risk_aggregation.h"
#include "session_stats.h"
#include "trend_regression.h"
#include "turn_scoring.h"

namespace py = pybind11;
using namespace still;

PYBIND11_MODULE(still_core, m) {
    m.doc() = "Still's C++ numeric core: turn scoring, session stats, "
              "trend regression, and risk aggregation (Modules 11-13).";

    // -- turn_scoring --------------------------------------------------
    py::enum_<ArousalLabel>(m, "ArousalLabel")
        .value("LOW", ArousalLabel::LOW)
        .value("MODERATE", ArousalLabel::MODERATE)
        .value("HIGH", ArousalLabel::HIGH);

    py::class_<ArousalFeatures>(m, "ArousalFeatures")
        .def(py::init([](double pitch_mean, double pitch_std, double energy,
                          double zero_crossing_rate, double pause_ratio,
                          ArousalLabel arousal_label) {
                 ArousalFeatures a;
                 a.pitch_mean = pitch_mean;
                 a.pitch_std = pitch_std;
                 a.energy = energy;
                 a.zero_crossing_rate = zero_crossing_rate;
                 a.pause_ratio = pause_ratio;
                 a.arousal_label = arousal_label;
                 return a;
             }),
             py::arg("pitch_mean"), py::arg("pitch_std"), py::arg("energy"),
             py::arg("zero_crossing_rate"), py::arg("pause_ratio"), py::arg("arousal_label"))
        .def_readwrite("pitch_mean", &ArousalFeatures::pitch_mean)
        .def_readwrite("pitch_std", &ArousalFeatures::pitch_std)
        .def_readwrite("energy", &ArousalFeatures::energy)
        .def_readwrite("zero_crossing_rate", &ArousalFeatures::zero_crossing_rate)
        .def_readwrite("pause_ratio", &ArousalFeatures::pause_ratio)
        .def_readwrite("arousal_label", &ArousalFeatures::arousal_label);

    py::class_<EmotionScores>(m, "EmotionScores")
        .def(py::init([](double anger, double disgust, double fear, double joy,
                          double neutral, double sadness, double surprise) {
                 EmotionScores e;
                 e.anger = anger;
                 e.disgust = disgust;
                 e.fear = fear;
                 e.joy = joy;
                 e.neutral = neutral;
                 e.sadness = sadness;
                 e.surprise = surprise;
                 return e;
             }),
             py::arg("anger"), py::arg("disgust"), py::arg("fear"), py::arg("joy"),
             py::arg("neutral"), py::arg("sadness"), py::arg("surprise"))
        .def_readwrite("anger", &EmotionScores::anger)
        .def_readwrite("disgust", &EmotionScores::disgust)
        .def_readwrite("fear", &EmotionScores::fear)
        .def_readwrite("joy", &EmotionScores::joy)
        .def_readwrite("neutral", &EmotionScores::neutral)
        .def_readwrite("sadness", &EmotionScores::sadness)
        .def_readwrite("surprise", &EmotionScores::surprise);

    py::class_<TurnScoreResult>(m, "TurnScoreResult")
        .def_readonly("score", &TurnScoreResult::score)
        .def_readonly("flagged_high_pause", &TurnScoreResult::flagged_high_pause);

    py::class_<TurnScorer>(m, "TurnScorer")
        .def(py::init<double, double, double, double>(),
             py::arg("arousal_weight") = 0.4, py::arg("pause_weight") = 0.2,
             py::arg("emotion_weight") = 0.4, py::arg("high_pause_threshold") = 0.5)
        .def("score", &TurnScorer::score, py::arg("arousal"), py::arg("emotion"));

    // -- session_stats ---------------------------------------------------
    py::class_<SessionStats>(m, "SessionStats")
        .def_readonly("mean_score", &SessionStats::mean_score)
        .def_readonly("max_score", &SessionStats::max_score)
        .def_readonly("min_score", &SessionStats::min_score)
        .def_readonly("volatility", &SessionStats::volatility)
        .def_readonly("within_session_trend", &SessionStats::within_session_trend);

    py::class_<SessionStatsCalculator>(m, "SessionStatsCalculator")
        .def_static("compute", &SessionStatsCalculator::compute, py::arg("scores"));

    // -- trend_regression -------------------------------------------------
    py::class_<TrendPoint>(m, "TrendPoint")
        .def(py::init<double, double>(), py::arg("timestamp_days"), py::arg("mean_score"))
        .def_readwrite("timestamp_days", &TrendPoint::timestamp_days)
        .def_readwrite("mean_score", &TrendPoint::mean_score);

    py::class_<TrendResult>(m, "TrendResult")
        .def_readonly("slope", &TrendResult::slope)
        .def_readonly("confidence", &TrendResult::confidence);

    py::class_<TrendRegressor>(m, "TrendRegressor")
        .def(py::init<double, double>(),
             py::arg("half_life_days") = 14.0, py::arg("confidence_growth_rate") = 0.5)
        .def("fit", &TrendRegressor::fit, py::arg("points"));

    // -- risk_aggregation -------------------------------------------------
    py::class_<ContributingFeature>(m, "ContributingFeature")
        .def_readonly("name", &ContributingFeature::name)
        .def_readonly("value", &ContributingFeature::value)
        .def_readonly("weight", &ContributingFeature::weight);

    py::class_<RiskInputs>(m, "RiskInputs")
        .def(py::init<double, double, double, double, double, bool>(),
             py::arg("trend_slope"), py::arg("trend_confidence"),
             py::arg("session_mean_score"), py::arg("session_volatility"),
             py::arg("session_within_trend"), py::arg("acute_override") = false)
        .def_readwrite("trend_slope", &RiskInputs::trend_slope)
        .def_readwrite("trend_confidence", &RiskInputs::trend_confidence)
        .def_readwrite("session_mean_score", &RiskInputs::session_mean_score)
        .def_readwrite("session_volatility", &RiskInputs::session_volatility)
        .def_readwrite("session_within_trend", &RiskInputs::session_within_trend)
        .def_readwrite("acute_override", &RiskInputs::acute_override);

    py::class_<RiskAssessment>(m, "RiskAssessment")
        .def_readonly("risk_score", &RiskAssessment::risk_score)
        .def_readonly("contributing_features", &RiskAssessment::contributing_features);

    py::class_<RiskAggregator>(m, "RiskAggregator")
        .def(py::init<double, double, double, double>(),
             py::arg("trend_weight") = 0.4, py::arg("session_score_weight") = 0.35,
             py::arg("volatility_weight") = 0.25, py::arg("volatility_scale") = 4.0)
        .def("aggregate", &RiskAggregator::aggregate, py::arg("inputs"));
}