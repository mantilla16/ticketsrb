import { useState, useRef, useEffect } from 'react';
import { colorClass } from '../utils/helpers';

const STATUS_DOT = {
  backlog: 'var(--rb-navy)', progress: 'var(--rb-navy-soft)', standby: '#78716C',
  testing: '#e87d3a', done: 'var(--rb-success)', soporte: '#0B6E80', cancelado: 'var(--rb-danger)',
};
const STATUS_L = {
  backlog: 'Por hacer', progress: 'En proceso', standby: 'En standby',
  testing: 'En testing', done: 'Finalizado', soporte: 'En soporte', cancelado: 'Cancelado',
};

export default function ProjectSearch({ projects, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const q = query.trim().toLowerCase();
  const results = q
    ? projects.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.client || '').toLowerCase().includes(q) ||
        (p.assignee?.name || '').toLowerCase().includes(q)
      ).slice(0, 8)
    : [];

  const select = (id) => {
    onSelect(id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="psearch" ref={wrapRef}>
      <div className="psearch-input-wrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="psearch-input"
          placeholder="Buscar proyecto…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') { setQuery(''); setOpen(false); e.target.blur(); }
            if (e.key === 'Enter' && results.length) select(results[0].id);
          }}
        />
        {query && (
          <button className="psearch-clear" onClick={() => { setQuery(''); setOpen(false); }}>✕</button>
        )}
      </div>

      {open && q && (
        <div className="psearch-results">
          {results.length === 0 ? (
            <div className="psearch-empty">Sin resultados para "{query}"</div>
          ) : results.map(p => (
            <button key={p.id} className="psearch-item" onClick={() => select(p.id)}>
              <span className="psearch-dot" style={{ background: STATUS_DOT[p.status] || 'var(--rb-navy)' }} />
              <span className="psearch-item-body">
                <span className="psearch-item-name">{p.name}</span>
                <span className="psearch-item-meta">
                  {[p.client, STATUS_L[p.status]].filter(Boolean).join(' · ')}
                </span>
              </span>
              {p.assignee && (
                <span className={`avatar-xs ${colorClass(p.assignee.colorIndex)}`}>{p.assignee.initials}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
