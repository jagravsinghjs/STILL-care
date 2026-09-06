/**
 * STILL-care Supervisor Profile & Settings (/supervisor/profile)
 *
 * Supervisor profile for Dr. Meera Iyer:
 * - Credentials & Institutional Role
 * - Caseload overview & continuity preferences
 * - Privacy governance confirmation
 */

import React from 'react';
import {
  User,
  ShieldCheck,
  Stethoscope,
  Bell,
  Mail,
  CheckCircle2,
  Lock,
  Building
} from 'lucide-react';
import { useSupervisorStore } from '../../store/supervisorStore';

export default function SupervisorProfilePage() {
  const { patients, alerts } = useSupervisorStore();

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-charcoal/15 pb-4">
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-charcoal tracking-tight">
          Supervisor profile & settings
        </h1>
        <p className="text-xs sm:text-sm text-charcoal/70 mt-1">
          Counselor identity, institutional assignments, and care continuity parameters.
        </p>
      </div>

      {/* Identity Card */}
      <div className="bg-bone border border-charcoal/15 rounded-lg p-5 sm:p-6 space-y-4 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-slate-teal/15 text-slate-teal border border-slate-teal/25 flex items-center justify-center font-serif text-xl font-bold">
            MI
          </div>
          <div>
            <h2 className="font-serif text-xl font-semibold text-charcoal">
              Dr. Meera Iyer
            </h2>
            <p className="text-xs text-charcoal/70 mt-0.5">
              Campus Mental Health & Well-being Counselor · Member Support Services
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-charcoal/60">
              <span className="inline-flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-charcoal/50" />
                <span>Wellness Center</span>
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-charcoal/50" />
                <span>dr.meera.iyer@campus.edu</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Caseload & Privacy Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Caseload Summary */}
        <div className="bg-bone border border-charcoal/15 rounded-lg p-5 space-y-3 shadow-2xs">
          <div className="flex items-center gap-2 font-serif text-base font-semibold text-charcoal">
            <Stethoscope className="w-4 h-4 text-slate-teal" />
            <h3>Assigned Caseload</h3>
          </div>
          <div className="space-y-1.5 text-xs text-charcoal/80">
            <div className="flex justify-between py-1 border-b border-charcoal/10">
              <span>Total assigned members</span>
              <strong className="text-charcoal">{patients.length} members</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-charcoal/10">
              <span>Under active monitoring</span>
              <strong className="text-risk-amber">
                {patients.filter((p) => p.currentRiskLevel === 'yellow').length} members
              </strong>
            </div>
            <div className="flex justify-between py-1 border-b border-charcoal/10">
              <span>Increasing concern</span>
              <strong className="text-risk-red">
                {patients.filter((p) => p.currentRiskLevel === 'red').length} members
              </strong>
            </div>
            <div className="flex justify-between py-1">
              <span>Stable trajectory</span>
              <strong className="text-risk-green">
                {patients.filter((p) => p.currentRiskLevel === 'green').length} members
              </strong>
            </div>
          </div>
        </div>

        {/* Privacy Boundary Status */}
        <div className="bg-bone border border-charcoal/15 rounded-lg p-5 space-y-3 shadow-2xs">
          <div className="flex items-center gap-2 font-serif text-base font-semibold text-charcoal">
            <Lock className="w-4 h-4 text-slate-teal" />
            <h3>Privacy Boundary Guarantee</h3>
          </div>
          <p className="text-xs text-charcoal/75 leading-relaxed">
            STILL-care enforces strict separation between member reflections and counselor continuity observations:
          </p>
          <ul className="space-y-1.5 text-xs text-charcoal/80">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-risk-green shrink-0" />
              <span>Raw conversation transcripts remain on member device</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-risk-green shrink-0" />
              <span>Counselor receives longitudinal themes only</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-risk-green shrink-0" />
              <span>No clinical diagnostic claims or scoring models</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
