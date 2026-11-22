import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authService, type AuthUser } from './service';

const AuthContext = createContext<{
  user: AuthUser | null;
  restoring: boolean;
  setUser: (user: AuthUser | null) => void;
}>({ user: null, restoring: true, setUser: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restoring, setRestoring] = useState(authService.configured);
  useEffect(() => {
    let active = true;
    if (authService.configured) {
      authService.session().then((current) => { if (active) setUser(current); })
        .catch(() => { if (active) setUser(null); })
        .finally(() => { if (active) setRestoring(false); });
    }
    return () => { active = false; };
  }, []);
  return <AuthContext.Provider value={{ user, setUser, restoring }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
