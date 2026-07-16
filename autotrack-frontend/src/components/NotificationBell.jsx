import { useState, useEffect, useRef, useCallback } from 'react';
import { notificationsAPI } from '../services/api';
import { colorClass } from '../utils/helpers';

const TYPE_ICON = {
  assign:    '👤',
  status:    '🔄',
  update:    '✏️',
  log:       '📈',
  task:      '✅',
  solicitud: '📨',
};

function timeAgo(d) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60)    return 'hace un momento';
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'ayer';
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export default function NotificationBell({ onOpenProject }) {
  const [items, setItems]   = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen]     = useState(false);
  const rootRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await notificationsAPI.getAll();
      setItems(data.items || []);
      setUnread(data.unread || 0);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      notificationsAPI.markAllRead().catch(() => {});
      setUnread(0);
    }
  };

  const clickItem = (n) => {
    setOpen(false);
    if (n.project_id && onOpenProject) onOpenProject(n.project_id);
  };

  return (
    <div className="nb-root" ref={rootRef}>
      <button className={`nb-bell${open ? ' nb-bell--open' : ''}`} onClick={toggle} aria-label="Notificaciones">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && <span className="nb-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="nb-panel">
          <div className="nb-panel-head">Notificaciones</div>
          {items.length === 0 ? (
            <div className="nb-empty">No tienes notificaciones aún</div>
          ) : (
            <div className="nb-list">
              {items.map(n => (
                <button key={n.id} className={`nb-item${n.is_read ? '' : ' nb-item--new'}`} onClick={() => clickItem(n)}>
                  {n.actor_name ? (
                    <span className={`avatar-xs ${colorClass(n.actor_color)}`}>{n.actor_initials}</span>
                  ) : (
                    <span className="nb-item-ico">{TYPE_ICON[n.type] || '🔔'}</span>
                  )}
                  <span className="nb-item-body">
                    <span className="nb-item-text">
                      {n.actor_name && <b>{n.actor_name.split(' ').slice(0, 2).join(' ')}</b>} {n.message}
                    </span>
                    <span className="nb-item-time">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.is_read && <span className="nb-dot" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
