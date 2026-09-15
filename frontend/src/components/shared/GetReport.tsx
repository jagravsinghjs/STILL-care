import { useState } from "react";
import { Download } from "lucide-react";
import { request, type ApiSummary } from "../../api/client";
import { Button } from "../ui";

type Report = ApiSummary & {
  raw_reflection?: string;
  explanation: string;
  recommended_action: string;
};

export function GetReport({ patientId, name, supervisor = false }: {
  patientId: string;
  name: string;
  supervisor?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setLoading(true);
    setError("");
    try {
      const id = encodeURIComponent(patientId);
      const reports = await request<Report[]>(supervisor
        ? `/api/supervisor/patients/${id}/summaries`
        : `/api/patients/${id}/reports`);
      if (!reports.length) {
        setError("No reports yet. Complete a session first.");
        return;
      }
      const content = [
        "STILL-care — Session report", name,
        `Downloaded: ${new Date().toLocaleString()}`,
        "Attention states and trends are not clinical assessments.",
        ...reports.map((r) => [
          "", `Session: ${new Date(r.created_at).toLocaleString()}`,
          `Mode: ${r.mode}`, `Processing: ${r.processing_mode}`,
          `Attention state: ${r.attention_state}`,
          `Trend: ${r.trend.replaceAll("_", " ")}`,
          `Summary: ${r.summary}`, `Themes: ${r.themes.join(", ") || "None recorded"}`,
          `Explanation: ${r.explanation}`, `Recommended action: ${r.recommended_action}`,
          ...(!supervisor && r.raw_reflection !== undefined ? [`Your reflection: ${r.raw_reflection}`] : []),
        ].join("\n")),
      ].join("\n");
      const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `still-care-${patientId.replace(/[^a-zA-Z0-9_-]/g, "_")}-report.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to download report.");
    } finally {
      setLoading(false);
    }
  }
  return <div>
    <Button className="secondary" onClick={download} disabled={loading}>
      <Download size={17} /> {loading ? "Getting report…" : "Get report"}
    </Button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
