import { ArrowLeft, Headset, Mic } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NewSessionPage() {
  return <section className="patient-subpage"><Link className="quiet-button" to="/patient"><ArrowLeft size={18} />Back to history</Link>
    <Mic className="subpage-icon" size={42} aria-hidden="true" /><h1>A space to talk</h1>
    <p>Voice sessions aren’t connected to this browser yet.</p><p className="muted">No session has been started. You can return here when voice conversations are available, or speak with your consultant about arranging a check-in.</p>
    <Link className="quiet-button" to="/patient/consultant">Talk to Consultant</Link>
  </section>;
}

export function ConsultantPage() {
  return <section className="patient-subpage"><Link className="quiet-button" to="/patient"><ArrowLeft size={18} />Back to history</Link>
    <Headset className="subpage-icon" size={42} aria-hidden="true" /><h1>Talk to your consultant</h1>
    <p>Consultant contact details and messaging aren’t connected yet.</p><p className="muted">No message has been sent. Please use the contact method your consultant has already shared with you.</p>
  </section>;
}
