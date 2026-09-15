import { Link } from "react-router-dom";
import { GetReport } from "../../components/shared/GetReport";
import { ArrowRight } from "lucide-react";
import { Card } from "../../components/ui";
import {
  ProgressChart,
  stateLabel,
} from "../../features/progress/ProgressChart";
import { useApp } from "../../store/useApp";
import { dateLabel } from "../../utils/date";
export function Dashboard() {
  const identity = useApp((s) => s.identity);
  const reports = useApp((s) => s.reports);
  const latest = reports[0];
  const earlier = reports.length > 1 ? reports[reports.length - 1] : null;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR UPDATE</div>
          <h1>{identity?.name.split(" ")[0]}’s dashboard</h1>
          <p>Your previous and latest check-in updates.</p>
        </div>
        {identity && <GetReport patientId={identity.id} name={identity.name} />}
      </div>
      <div className="dashboard-grid comparison">
        <Card>
          <div className="eyebrow">
            EARLIER{earlier ? " · " + dateLabel(earlier.created_at) : ""}
          </div>
          <h2>
            {earlier
              ? stateLabel[earlier.attention_state]
              : "No earlier check-in"}
          </h2>
          <p>
            {earlier?.summary ??
              "At least two check-ins are needed to compare updates."}
          </p>
        </Card>
        <Card className="current-update">
          <div className="eyebrow">
            LATEST{latest ? " · " + dateLabel(latest.created_at) : ""}
          </div>
          <h2>
            {latest ? stateLabel[latest.attention_state] : "No check-ins yet"}
          </h2>
          <p>
            {latest?.summary ??
              "Open STILL Assistant in the navigation to start your first session."}
          </p>
          {latest && (
            <p>
              {latest.trend.replaceAll("_", " ")}
              {latest.processing_mode === "mock" ? " · Demo processing" : ""}
            </p>
          )}
        </Card>
      </div>
      <ProgressChart reports={reports} />
      <Card className="latest-update">
        <div>
          <div className="eyebrow">CHECK-IN HISTORY</div>
          <h3>
            {reports.length} processed check-in{reports.length === 1 ? "" : "s"}
          </h3>
          <p className="muted">
            Review your private reflections and generated reports.
          </p>
        </div>
        <Link className="text-link" to="/patient/history">
          View history <ArrowRight size={16} />
        </Link>
      </Card>
    </>
  );
}
