import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('at-token');
    if (token) {
      authAPI.me()
        .then(setUser)
        .catch(() => localStorage.removeItem('at-token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { token, user } = await authAPI.login({ email, password });
    localStorage.setItem('at-token', token);
    setUser(user);
    return user;
  };

  const register = async (name, email, password) => {
    const { token, user } = await authAPI.register({ name, email, password });
    localStorage.setItem('at-token', token);
    setUser(user);
    return user;
  };

  const loginGoogle = async (credential) => {
    const { token, user } = await authAPI.google(credential);
    localStorage.setItem('at-token', token);
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('at-token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
