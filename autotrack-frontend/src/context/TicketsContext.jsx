/* Estado compartido de los tickets.
   La bandeja, el tablero y los reportes son tres lecturas del mismo conjunto:
   se carga una sola vez aquí y cada vista se suscribe, en vez de que cada una
   pida la lista por su cuenta y se desincronicen entre sí. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { solicitudesAPI } from '../services/api';
import { isDesk } from '../lib/tickets';

const TicketsCtx = createContext(null);

export function TicketsProvider({ user, users = [], showToast, children }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      setTickets(await solicitudesAPI.getAll());
    } catch (e) {
      setError(e?.error || 'No se pudieron cargar los tickets');
      showToast?.('No se pudieron cargar los tickets', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * Aplica la respuesta del servidor sobre el ticket ya en memoria.
   * Los endpoints de escritura devuelven la fila cruda (`RETURNING *`), sin los
   * JOIN de la lista, así que el nombre del responsable se vuelve a resolver
   * contra el directorio de usuarios; si no, la fila queda con el anterior.
   */
  const patch = useCallback((updated) => {
    const a = updated.assignee_id ? users.find(u => u.id === updated.assignee_id) : null;
    const resolved = {
      ...updated,
      assignee_name:        a?.name     ?? (updated.assignee_id ? undefined : null),
      assignee_initials:    a?.initials ?? (updated.assignee_id ? undefined : null),
      assignee_color_index: a?.colorIndex ?? a?.color_index ?? (updated.assignee_id ? undefined : null),
    };
    Object.keys(resolved).forEach(k => resolved[k] === undefined && delete resolved[k]);
    setTickets(list => list.map(t => (t.id === resolved.id ? { ...t, ...resolved } : t)));
  }, [users]);

  const create = useCallback(async (formData) => {
    const created = await solicitudesAPI.create(formData);
    setTickets(list => [created, ...list]);
    return created;
  }, []);

  const updateStatus = useCallback(async (id, data) => {
    const updated = await solicitudesAPI.updateStatus(id, data);
    patch(updated);
    return updated;
  }, [patch]);

  const updateInfo = useCallback(async (id, infoAdicional) => {
    const updated = await solicitudesAPI.updateInfo(id, { infoAdicional });
    patch(updated);
    return updated;
  }, [patch]);

  const markProjectCreated = useCallback(async (id) => {
    await solicitudesAPI.markProjectCreated(id);
    setTickets(list => list.map(t => (t.id === id ? { ...t, project_created: true } : t)));
  }, []);

  const remove = useCallback(async (id) => {
    await solicitudesAPI.remove(id);
    setTickets(list => list.filter(t => t.id !== id));
  }, []);

  const value = useMemo(() => ({
    tickets, loading, error, refresh,
    create, updateStatus, updateInfo, markProjectCreated, remove,
    /* La bandeja completa solo tiene sentido para la mesa; el auditor ve los suyos. */
    scope: isDesk(user) ? 'desk' : 'own',
  }), [tickets, loading, error, refresh, create, updateStatus, updateInfo, markProjectCreated, remove, user]);

  return <TicketsCtx.Provider value={value}>{children}</TicketsCtx.Provider>;
}

export function useTickets() {
  const ctx = useContext(TicketsCtx);
  if (!ctx) throw new Error('useTickets debe usarse dentro de <TicketsProvider>');
  return ctx;
}
