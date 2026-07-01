import { useState, useEffect } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const show = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts(t => t.map(x => x.id === id ? { ...x, removing: true } : x));
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 350);
    }, 3600);
  };

  const remove = (id) => {
    setToasts(t => t.map(x => x.id === id ? { ...x, removing: true } : x));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 350);
  };

  return { toasts, show, remove };
}

const ICONS = { success: '✓', error: '✕', info: 'i' };

export default function Toast({ toasts, onRemove }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type}${t.removing ? ' removing' : ''}`}
          onClick={() => onRemove(t.id)}
          role="alert"
        >
          <div className="toast-icon">{ICONS[t.type] || ICONS.info}</div>
          <span style={{ flex: 1 }}>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
