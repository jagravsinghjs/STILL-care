"""
modules/module1_session_analysis/report_generator.py

Module 11 -- builds a clinician-readable PDF report from a SessionSummary:
plain-language summary, a score-timeline chart, and flagged high-pause
turns. Pure presentation layer -- takes a SessionSummary, writes a PDF,
does no scoring or DB access itself.
"""

from __future__ import annotations

from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from schemas.schemas import SessionSummary

_TREND_LABEL = {
    True: "worsening within this session",
    False: "stable or improving within this session",
}


def _timeline_chart(summary: SessionSummary) -> Drawing:
    drawing = Drawing(400, 160)
    chart = HorizontalLineChart()
    chart.x = 30
    chart.y = 20
    chart.width = 340
    chart.height = 120
    chart.data = [[t.score for t in summary.timeline]]
    chart.lines[0].strokeColor = colors.HexColor("#B23A48")
    chart.categoryAxis.categoryNames = [str(i + 1) for i in range(len(summary.timeline))]
    chart.valueAxis.valueMin = 0
    chart.valueAxis.valueMax = 100
    drawing.add(chart)
    return drawing


def generate_report(summary: SessionSummary, output_path: str) -> str:
    """
    Renders `summary` to a PDF at `output_path`. Returns output_path for
    convenient chaining. Caller decides the path/filename -- this function
    makes no assumption about where reports live on disk.
    """
    doc = SimpleDocTemplate(output_path, pagesize=LETTER)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("Session Analysis Report", styles["Title"]))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph(f"Session ID: {summary.session_id}", styles["Normal"]))
    story.append(Paragraph(f"Patient ID: {summary.patient_id}", styles["Normal"]))
    story.append(
        Paragraph(
            f"{summary.start_time:%Y-%m-%d %H:%M} &ndash; {summary.end_time:%H:%M} "
            f"&middot; {summary.turn_count} turns",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 0.25 * inch))

    is_worsening = summary.within_session_trend > 0
    story.append(
        Paragraph(
            f"Mean distress score <b>{summary.mean_score:.1f}</b> "
            f"(range {summary.min_score:.1f}&ndash;{summary.max_score:.1f}, "
            f"volatility {summary.volatility:.1f}). "
            f"This session was {_TREND_LABEL[is_worsening]}.",
            styles["BodyText"],
        )
    )
    story.append(Spacer(1, 0.25 * inch))

    story.append(Paragraph("Score timeline", styles["Heading2"]))
    story.append(_timeline_chart(summary))
    story.append(Spacer(1, 0.25 * inch))

    flagged = [t for t in summary.timeline if t.flagged_high_pause]
    story.append(Paragraph("Flagged high-pause turns", styles["Heading2"]))
    if flagged:
        rows = [["Turn ID", "Time", "Score"]] + [
            [t.turn_id, t.timestamp.strftime("%H:%M:%S"), f"{t.score:.1f}"] for t in flagged
        ]
        table = Table(rows, hAlign="LEFT")
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEEEEE")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                ]
            )
        )
        story.append(table)
    else:
        story.append(Paragraph("None.", styles["Normal"]))

    doc.build(story)
    return output_path