import { useState } from 'react';
import { fmtDate, dateStatus, colorClass, fmtLogDate } from '../utils/helpers';

const STATUS_CLS = {
  backlog:'status-backlog',progress:'status-progress',
  standby:'status-standby',testing:'status-testing',done:'status-done',
};
const STATUS_L = {
  backlog:'Por hacer',progress:'En proceso',
  standby:'En standby',testing:'En testing',done:'Finalizado',
};
const PR_PILL = { high: 'pp-high', mid: 'pp-mid', low: 'pp-low' };
const PR_L    = { high: 'Alta',   mid: 'Media',  low: 'Baja'   };

export default function DetailModal({ open, project, onClose, onEdit, onAddLog }) {
  const [logText, setLogText] = useState('');
  const [logProg, setLogProg] = useState(0);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  if (!open || !project) return null;

  const pct  = project.progress || 0;
  const eng  = project.assignee;
  const dSt  = dateStatus(project.dueDate);
  const pr   = project.priority || 'mid';

  const addLog = async () => {
    if (!logText.trim()) { setError('Escribe el avance de la reunión'); return; }
    setSaving(true); setError('');
    try {
      await onAddLog(project.id, { text: logText.trim(), progress: logProg });
      setLogText('');
    } catch (err) {
      setError(err.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className={`badge ${STATUS_CLS[project.status]}`}>{STATUS_L[project.status]}</span>
              <span className={`priority-pill ${PR_PILL[pr]}`}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: PR_L[pr] === 'Alta' ? 'var(--high)' : PR_L[pr] === 'Media' ? 'var(--mid)' : 'var(--low)', display: 'inline-block' }} />
                {PR_L[pr]}
              </span>
            </div>
            <div className="modal-title">{project.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {eng ? `Asignado a ${eng.name}` : 'Sin asignar'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onEdit(project.id)}>Editar</button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="modal-body" style={{ paddingBottom: 8 }}>
          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
            {eng && (
              <div>
                <div className="detail-label">Responsable</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <div className={`avatar-xs ${colorClass(eng.colorIndex)}`}>{eng.initials}</div>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{eng.name.split(' ')[0]}</span>
                </div>
              </div>
            )}
            <div>
              <div className="detail-label">Entrega</div>
              <div style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, marginTop: 4, color: dSt === 'overdue' ? 'var(--high)' : dSt === 'soon' ? '#E8890C' : 'var(--text)' }}>
                {fmtDate(project.dueDate)}
              </div>
            </div>
            {project.client && (
              <div>
                <div className="detail-label">Área / Cliente</div>
                <div style={{ fontSize: 13, marginTop: 4, fontWeight: 500 }}>{project.client}</div>
              </div>
            )}
          </div>

          {/* Progress */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="detail-label">Progreso</div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{pct}%</span>
            </div>
            <div className="progress-big">
              <div className={`progress-big-fill${pct >= 100 ? ' done' : ''}`} style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div style={{ marginBottom: 18 }}>
              <div className="detail-label">Descripción</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginTop: 4 }}>{project.description}</div>
            </div>
          )}

          {/* Logs */}
          <div className="log-divider">Seguimiento semanal</div>
          <div className="log-list">
            {project.logs?.length ? (
              project.logs.map(l => (
                <div className="log-item" key={l.id}>
                  <div className="log-meta">
                    <span className="log-author">{l.author?.name || 'Sistema'}</span>
                    <span className="log-date">{fmtLogDate(l.createdAt)}{l.progress != null ? ` · ${l.progress}%` : ''}</span>
                  </div>
                  <div className="log-text">{l.text}</div>
                </div>
              ))
            ) : (
              <div className="empty" style={{ padding: 16, fontSize: 12 }}>Sin avances registrados aún</div>
            )}
          </div>

          {/* Add log */}
          <div style={{ marginTop: 14, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 16, border: '1px solid var(--border)' }}>
            {error && <div className="login-error" style={{ marginBottom: 10 }}>{error}</div>}
            <div style={{ marginBottom: 8 }}>
              <label className="form-label">Actualizar progreso</label>
              <input type="range" min={0} max={100} step={5} value={logProg} onChange={e => setLogProg(parseInt(e.target.value))} style={{ marginTop: 4 }} />
              <div style={{ textAlign: 'right', fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>{logProg}%</div>
            </div>
            <textarea
              className="form-textarea"
              value={logText}
              onChange={e => setLogText(e.target.value)}
              placeholder="Registra el avance de la reunión semanal..."
              rows={2}
              style={{ marginBottom: 8, fontSize: 13 }}
            />
            <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={addLog} disabled={saving}>
              {saving ? 'Guardando...' : 'Registrar avance'}
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
