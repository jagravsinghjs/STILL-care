import { Stethoscope, UserRound } from 'lucide-react';
import type { Role } from '../auth/service';

export function RoleSelector({ value, onChange, disabled }: { value: Role; onChange: (role: Role) => void; disabled?: boolean }) {
  return <fieldset className="role-selector" disabled={disabled}>
    <legend className="sr-only">Log in as</legend>
    {([{ role: 'patient', title: 'User', subtitle: 'Your personal space', Icon: UserRound },
      { role: 'supervisor', title: 'Consultant', subtitle: 'Counsellor', Icon: Stethoscope }] as const).map(({ role, title, subtitle, Icon }) =>
      <label className="role-option" key={role}>
        <input type="radio" name="role" value={role} checked={value === role} onChange={() => onChange(role)} aria-label={title} />
        <span className="role-content"><Icon size={29} strokeWidth={1.8} aria-hidden="true" /><span><strong>{title}</strong><small>{subtitle}</small></span></span>
      </label>)}
  </fieldset>;
}
