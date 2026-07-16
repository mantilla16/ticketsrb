import { useState } from 'react';
import { colorClass } from '../utils/helpers';

const PR_LABEL = { high: 'Alta', mid: 'Media', low: 'Baja' };
const PR_CLASS = { high: 'pp-high', mid: 'pp-mid', low: 'pp-low' };

const TIPO_LABEL = { automatizacion: 'Automatización', analitica: 'Analítica', compartido: 'Compartido', asignacion_flash: 'Flash' };
const TIPO_CLS   = { automatizacion: 'tipo-auto', analitica: 'tipo-analitica', compartido: 'tipo-compartido', asignacion_flash: 'tipo-flash' };
const TIPO_FILTERS = ['all', 'automatizacion', 'analitica', 'compartido', 'asignacion_flash', 'paso_soporte'];

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function HistorialView({ projects, users, onCardClick }) {
  const [search,     setSearch]     = useState('');
  const [tipoFilter, setTipoFilter] = useState('all');

  const done = projects
    .filter(p => p.status === 'done')
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  const filtered = done
    .filter(p => tipoFilter === 'all'
      || (tipoFilter === 'paso_soporte' ? p.wasSoporte : (p.tipo || 'automatizacion') === tipoFilter))
    .filter(p => !search.trim() || (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.client || '').toLowerCase().includes(search.toLowerCase())
    ));

  const assignee = (p) => users.find(u => u.id === (p.assigneeId || p.assignee_id));

  return (
    <div className="hist-root">
      {/* Header */}
      <div className="hist-header">
        <div className="hist-counter">
          <span className="hist-counter-num">{done.length}</span>
          <span className="hist-counter-lbl">proyectos finalizados</span>
        </div>
        <div className="hist-search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="hist-search"
            placeholder="Buscar por nombre o cliente…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="hist-search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>
      </div>

      {/* Tipo filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {TIPO_FILTERS.map(t => (
          <button
            key={t}
            className={`sol-chip${tipoFilter === t ? ' sol-chip--active' : ''}`}
            onClick={() => setTipoFilter(t)}
          >
            {t === 'all' ? 'Todos' : t === 'paso_soporte' ? 'Pasó por soporte' : TIPO_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="hist-empty">No hay proyectos que coincidan con "{search}"</div>
      ) : (
        <div className="hist-grid">
          {filtered.map((p, i) => {
            const user = assignee(p);
            return (
              <div
                key={p.id}
                className="hist-card"
                onClick={() => onCardClick(p.id)}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  <span className={`tipo-badge ${TIPO_CLS[p.tipo || 'automatizacion']}`} style={{ fontSize: 10 }}>
                    {TIPO_LABEL[p.tipo || 'automatizacion']}
                  </span>
                  <span className="hist-done-badge" style={{ marginLeft: 'auto' }}
                    {...(p.wasSoporte ? { 'data-soporte': true } : {})}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Finalizado
                  </span>
                  {p.wasSoporte && (
                    <span className="hist-done-badge" data-soporte="true">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
                      </svg>
                      Pasó por soporte
                    </span>
                  )}
                </div>

                <div className="hist-card-name">{p.name}</div>

                {p.client && <div className="hist-card-client">{p.client}</div>}

                <div className="hist-card-footer">
                  {user ? (
                    <div className="hist-card-user">
                      <div className={`avatar-xs ${colorClass(user.colorIndex)}`}>{user.initials}</div>
                      <span>{user.name.split(' ')[0]}</span>
                    </div>
                  ) : <div />}
                  <div className="hist-card-date">
                    {fmt(p.dueDate || p.due_date)}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
