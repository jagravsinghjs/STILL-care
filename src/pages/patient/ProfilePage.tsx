/**
 * STILL-care Student Profile & Settings (/patient/profile)
 *
 * Provides Ananya Sharma with:
 * - Student identification & campus affiliation (fictional)
 * - Assigned care counselor status (Dr. Meera Iyer)
 * - Local privacy settings and reflection retention controls
 * - Quick link to login / sign out
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  ShieldCheck,
  Stethoscope,
  Lock,
  Mail,
  LogOut,
  Bell,
  BookOpen
} from 'lucide-react';

export default function PatientProfilePage() {
  const navigate = useNavigate();

  const handleSignOut = () => {
    navigate('/login');
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto font-sans animate-fade-in pb-12">
      {/* Page Header */}
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-serif text-charcoal font-semibold tracking-tight">
          Member profile & privacy
        </h1>
        <p className="text-xs sm:text-sm text-charcoal/70">
          Manage your personal preferences, campus affiliation, and on-device privacy protections.
        </p>
      </header>

      {/* Main Profile Card */}
      <div className="bg-bone border border-charcoal/15 rounded-2xl p-6 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-sage/50 border border-secondary-green/30 flex items-center justify-center text-moss font-serif font-bold text-xl">
              AS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-semibold text-charcoal">
                  Ananya Sharma
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] text-moss bg-sage/60 px-2 py-0.5 rounded-full font-medium border border-moss/20">
                  <ShieldCheck className="w-3 h-3" />
                  Active Member
                </span>
              </div>
              <p className="text-xs text-charcoal/70 mt-0.5">
                B.Tech Computer Science &middot; 3rd Year &middot; Roll No: 2023-CS-0418
              </p>
              <p className="text-xs text-charcoal/60 mt-0.5">
                ananya.sharma@campus.edu
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-charcoal/70 hover:text-charcoal bg-paper-grey/80 hover:bg-charcoal/10 rounded-lg border border-charcoal/15 transition-colors self-start sm:self-auto"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-charcoal/10 text-xs">
          <div className="p-3.5 bg-paper-grey/40 rounded-xl border border-charcoal/10 space-y-1">
            <div className="flex items-center gap-1.5 text-charcoal/60 font-medium">
              <Stethoscope className="w-3.5 h-3.5 text-secondary-green" />
              <span>Assigned Counselor</span>
            </div>
            <p className="text-sm font-medium text-charcoal">Dr. Meera Iyer</p>
            <p className="text-[11px] text-charcoal/60">Counseling & Wellness Services</p>
          </div>

          <div className="p-3.5 bg-paper-grey/40 rounded-xl border border-charcoal/10 space-y-1">
            <div className="flex items-center gap-1.5 text-charcoal/60 font-medium">
              <Lock className="w-3.5 h-3.5 text-secondary-green" />
              <span>Data Protection</span>
            </div>
            <p className="text-sm font-medium text-charcoal">On-Device Reflection Isolation</p>
            <p className="text-[11px] text-charcoal/60">Transcripts & voice recordings never shared</p>
          </div>
        </div>
      </div>

      {/* Preferences & Privacy Controls */}
      <div className="bg-bone border border-charcoal/15 rounded-2xl p-6 shadow-2xs space-y-4">
        <h3 className="text-sm font-semibold text-charcoal uppercase tracking-wider">
          Check-in & Privacy Preferences
        </h3>

        <div className="divide-y divide-charcoal/10 text-xs text-charcoal/80">
          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-charcoal">Gentle check-in reminders</p>
              <p className="text-charcoal/60">Receive calm notifications at your preferred time (weekly/bi-weekly).</p>
            </div>
            <span className="text-[11px] font-medium text-moss bg-sage/40 px-2 py-0.5 rounded">Enabled</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-charcoal">Counselor direct messaging</p>
              <p className="text-charcoal/60">Allow Dr. Meera Iyer to send supportive asynchronous check-ins.</p>
            </div>
            <span className="text-[11px] font-medium text-moss bg-sage/40 px-2 py-0.5 rounded">Active</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-charcoal">Transcript isolation guarantee</p>
              <p className="text-charcoal/60">Raw conversation reflections remain exclusively on your device.</p>
            </div>
            <span className="text-[11px] font-medium text-moss bg-sage/40 px-2 py-0.5 rounded">Enforced</span>
          </div>
        </div>
      </div>

      {/* Navigation Quick Links */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-charcoal/70 pt-2">
        <Link
          to="/patient/supervisor"
          className="text-secondary-green hover:underline font-medium"
        >
          &larr; View Privacy Boundary Inspector
        </Link>
        <Link
          to="/patient/dashboard"
          className="text-secondary-green hover:underline font-medium"
        >
          Return to Dashboard &rarr;
        </Link>
      </div>
    </div>
  );
}
