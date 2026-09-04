/**
 * STILL-care Supervisor Entry Point Card
 *
 * Subtle, respectful entry point allowing the patient to connect with their assigned supervisor.
 * Strictly non-alarmist and distinct from an emergency button.
 * Navigates to /patient/supervisor.
 */

import { Link } from 'react-router-dom';
import { Stethoscope, ArrowRight } from 'lucide-react';
import { Supervisor } from '../../types';

interface SupervisorEntryCardProps {
  supervisor?: Supervisor;
}

export function SupervisorEntryCard({ supervisor }: SupervisorEntryCardProps) {
  const supervisorName = supervisor?.name || 'Dr. Meera Iyer';
  const supervisorTitle = supervisor?.title || 'Supervising Counselor';
  const supervisorOrg = supervisor?.organization || 'Campus Wellbeing & Counseling Services';

  return (
    <aside
      id="supervisor-entry-card"
      aria-labelledby="supervisor-entry-title"
      className="p-5 bg-paper-grey/60 border border-charcoal/15 rounded-md space-y-4"
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-charcoal/60 font-medium">
          <Stethoscope className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
          <span>Care supervision &middot; Fictional demo</span>
        </div>
        <h2
          id="supervisor-entry-title"
          className="text-base font-serif text-charcoal font-medium"
        >
          Your care supervisor
        </h2>
        <div className="pt-1 space-y-0.5">
          <p className="text-sm font-medium text-charcoal">{supervisorName}</p>
          <p className="text-xs text-charcoal/70">{supervisorTitle}</p>
          <p className="text-[11px] text-charcoal/50">{supervisorOrg} (Demo)</p>
        </div>
      </div>

      <p className="text-xs text-charcoal/75 leading-relaxed">
        High-level observations from your check-ins are reviewed by your assigned supervisor to ensure continuity
        in your care. You can send a message or request an appointment anytime.
      </p>

      <div>
        <Link
          id="connect-supervisor-action"
          to="/patient/supervisor"
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-paper-grey text-charcoal hover:bg-charcoal/10 border border-charcoal/20 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-charcoal/30 min-h-[40px]"
        >
          <span>Connect with your supervisor</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
