/**
 * STILL-care Patient Welcome Section
 *
 * Warm, restrained greeting using the fictional demo patient name.
 * Centers the single primary action: "Start a check-in", navigating to /patient/checkin/new.
 *
 * Strictly adheres to non-diagnostic, non-clinical language guidelines.
 */

import { Link } from 'react-router-dom';
import { ArrowRight, MessageSquare } from 'lucide-react';
import { Patient } from '../../types';

interface WelcomeSectionProps {
  patient: Patient | null;
}

export function WelcomeSection({ patient }: WelcomeSectionProps) {
  const firstName = patient?.name ? patient.name.split(' ')[0] : 'there';

  // Time-appropriate natural greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <section
      id="patient-welcome-section"
      aria-labelledby="welcome-heading"
      className="space-y-4 pb-2"
    >
      <div className="space-y-1.5">
        <h1
          id="welcome-heading"
          className="text-2xl sm:text-3xl font-serif text-charcoal font-semibold tracking-tight"
        >
          {getGreeting()}, {firstName}.
        </h1>
        <p className="text-sm sm:text-base text-charcoal/70 max-w-2xl font-sans leading-relaxed">
          A quiet space to pause, reflect, and share what is on your mind today.
        </p>
      </div>

      {/* Primary Action Card: The single strongest action on the page */}
      <div
        id="primary-checkin-banner"
        className="bg-paper-grey/80 border border-charcoal/15 rounded-md p-5 sm:p-6 transition-all hover:border-charcoal/25"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-charcoal/70 font-medium">
              <span>Personal check-in</span>
            </div>
            <h2 className="text-lg font-serif text-charcoal font-medium">
              Ready to take a few quiet minutes?
            </h2>
            <p className="text-xs sm:text-sm text-charcoal/70 max-w-xl">
              You can speak freely or write your thoughts. There is no right or wrong way to share.
            </p>
          </div>

          <div className="shrink-0">
            <Link
              id="start-checkin-primary-cta"
              to="/patient/checkin/new"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded bg-charcoal text-bone text-sm font-medium hover:bg-charcoal/90 transition-colors shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-charcoal/30 min-h-[44px]"
            >
              <MessageSquare className="w-4 h-4 stroke-[2]" aria-hidden="true" />
              <span>Start a check-in</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
