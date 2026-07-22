import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutos de inactividad → cierre de sesión

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('at-token');
    if (token) {
      // La regla de inactividad también aplica entre recargas/cierres del navegador:
      // si la última actividad registrada supera el límite (o no existe), la sesión expira.
      const last = parseInt(localStorage.getItem('at-last-activity') || '0', 10);
      if (!last || Date.now() - last > IDLE_LIMIT_MS) {
        localStorage.removeItem('at-token');
        localStorage.removeItem('at-last-activity');
        localStorage.setItem('at-idle-logout', '1');
        setLoading(false);
        return;
      }
      authAPI.me()
        .then(setUser)
        .catch(() => localStorage.removeItem('at-token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const loginGoogle = async (credential) => {
    const { token, user } = await authAPI.google(credential);
    localStorage.setItem('at-token', token);
    localStorage.setItem('at-last-activity', String(Date.now()));
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('at-token');
    setUser(null);
  };

  // ── Cierre automático por inactividad (20 min) ──
  const idleTimer = useRef(null);
  useEffect(() => {
    if (!user) return;

    const expire = () => {
      localStorage.setItem('at-idle-logout', '1');
      localStorage.removeItem('at-token');
      localStorage.removeItem('at-last-activity');
      setUser(null);
    };

    const reset = () => {
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(expire, IDLE_LIMIT_MS);
    };

    const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - last > 5000) {
        last = now;
        localStorage.setItem('at-last-activity', String(now));
        reset();
      } // throttle: máx. un reset cada 5s
    };

    EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    reset();

    return () => {
      clearTimeout(idleTimer.current);
      EVENTS.forEach(e => window.removeEventListener(e, onActivity));
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, loginGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
