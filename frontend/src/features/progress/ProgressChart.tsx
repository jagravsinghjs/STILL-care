import type { ApiSummary } from "../../api/client";
import { Card } from "../../components/ui";
import { dateLabel } from "../../utils/date";
export const stateLabel = {
  GREEN: "GREEN · Routine support",
  YELLOW: "YELLOW · Follow-up",
  RED: "RED · Timely attention",
};
const height = { GREEN: 150, YELLOW: 95, RED: 40 };
const color = { GREEN: "#52765b", YELLOW: "#a5762b", RED: "#a34e42" };
export function ProgressChart({ reports }: { reports: ApiSummary[] }) {
  const points = [...reports].reverse().slice(-8);
  const x = (i: number) =>
    points.length === 1 ? 440 : 210 + (i * 440) / (points.length - 1);
  return (
    <Card className="progress-card">
      <div className="section-heading">
        <h2>Change over time</h2>
        <span>Last {points.length} check-ins</span>
      </div>
      <p className="muted small-text">
        Attention states from processed reports; qualitative support categories,
        not health scores.
        {points.some((p) => p.processing_mode === "mock")
          ? " Includes deterministic demo processing."
          : ""}
      </p>
      {points.length === 0 ? (
        <p className="muted">
          Your timeline will appear after your first processed check-in.
        </p>
      ) : (
        <>
          <svg
            viewBox="0 0 720 220"
            role="img"
            aria-labelledby="progress-title"
          >
            <title id="progress-title">
              Attention states over time.{" "}
              {points
                .map(
                  (p) =>
                    `${dateLabel(p.created_at)}: ${stateLabel[p.attention_state]}`,
                )
                .join(". ")}
            </title>
            {(["RED", "YELLOW", "GREEN"] as const).map((state) => (
              <g key={state}>
                <text x="5" y={height[state] + 4} fontSize="12" fill="#66706a">
                  {stateLabel[state]}
                </text>
                <line
                  x1="200"
                  x2="670"
                  y1={height[state]}
                  y2={height[state]}
                  stroke="#dce4d6"
                  strokeDasharray="5 5"
                />
              </g>
            ))}
            <polyline
              points={points
                .map((p, i) => `${x(i)},${height[p.attention_state]}`)
                .join(" ")}
              fill="none"
              stroke="#7a8977"
              strokeWidth="2"
            />
            {points.map((p, i) => (
              <circle
                key={p.id}
                cx={x(i)}
                cy={height[p.attention_state]}
                r="6"
                fill={color[p.attention_state]}
              >
                <title>
                  {dateLabel(p.created_at)}: {stateLabel[p.attention_state]}
                </title>
              </circle>
            ))}
            <text x="210" y="200" fontSize="12">
              Earlier
            </text>
            <text x="650" y="200" textAnchor="end" fontSize="12">
              Latest
            </text>
          </svg>
          <ol className="progress-labels">
            {points.map((p) => (
              <li key={p.id}>
                <strong>{dateLabel(p.created_at)}</strong>
                <p>{stateLabel[p.attention_state]}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </Card>
  );
}
