import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { patientService } from '../../patient/service';
import SessionHistory, { type HistoryState } from '../../components/dashboard/SessionHistory';
import SessionViewer from '../../components/dashboard/SessionViewer';

export default function DashboardPage() {
  const { setUser } = useAuth();
  const [state, setState] = useState<HistoryState>({ status: 'loading' });
  const [selected, setSelected] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const expire = useCallback(() => setUser(null), [setUser]);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    patientService.history(controller.signal).then((sessions) => {
      if (controller.signal.aborted) return;
      setState({ status: 'ready', sessions });
      setSelected((current) => sessions.some((session) => session.id === current) ? current : null);
    }).catch((error) => {
      if (controller.signal.aborted) return;
      if (error.status === 401) expire();
      setState({ status: 'error', message: error.message });
      setSelected(null);
    });
    return () => controller.abort();
  }, [refresh, expire]);
  return <div className="dashboard-grid">
    <SessionHistory state={state} selected={selected} onSelect={setSelected} onRefresh={() => { setSelected(null); setRefresh(refresh + 1); }} />
    <SessionViewer key={selected ?? 'unselected'} selectedId={selected} emptyHistory={state.status === 'ready' && state.sessions.length === 0} onExpired={expire} />
  </div>;
}
