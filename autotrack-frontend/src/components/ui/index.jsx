/* Primitivas de interfaz compartidas. Envuelven las clases de styles/ui.css
   para que ninguna vista tenga que recordar nombres de clase ni tonos. */

import { useEffect } from 'react';
import Icon from './Icon';
import { statusOf, priorityOf, slaOf } from '../../lib/tickets';

export { default as Icon } from './Icon';

const cx = (...v) => v.filter(Boolean).join(' ');

/* ─────────────────────────────── Botón ───────────────────────────────── */

export function Button({
  variant = 'secondary', size, icon, iconRight, loading,
  children, className, ...rest
}) {
  return (
    <button
      className={cx('rb-btn', `rb-btn--${variant}`, size && `rb-btn--${size}`,
        !children && 'rb-btn--icon', className)}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading ? <span className="rb-spinner" /> : icon && <Icon name={icon} size={size === 'sm' ? 13 : 15} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={size === 'sm' ? 13 : 15} />}
    </button>
  );
}

/* ─────────────────────────────── Etiquetas ───────────────────────────── */

export function Badge({ tone = 'neutral', size, dot, children, className, ...rest }) {
  return (
    <span className={cx('rb-badge', size && `rb-badge--${size}`, className)} data-tone={tone} {...rest}>
      {dot && <i className="rb-dot" />}
      {children}
    </span>
  );
}

export const StatusBadge = ({ value, size }) => {
  const s = statusOf(value);
  return <Badge tone={s.tone} size={size} dot>{s.label}</Badge>;
};

export const PriorityBadge = ({ value, size }) => {
  const p = priorityOf(value);
  return <Badge tone={p.tone} size={size}>{p.label}</Badge>;
};

/** Compromiso de atención. No se pinta cuando el ticket ya está cerrado. */
export function SlaBadge({ ticket, size }) {
  const sla = slaOf(ticket);
  if (!sla || sla.state === 'answered' || sla.state === 'ok') return null;
  return <Badge tone={sla.tone} size={size}>{sla.label}</Badge>;
}

/* ─────────────────────────────── Avatar ──────────────────────────────── */

export function Avatar({ name, initials, colorIndex = 0, size, title }) {
  const label = initials
    || (name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
  if (!label) {
    return (
      <span className={cx('rb-avatar', 'rb-avatar--empty', size && `rb-avatar--${size}`)} title={title || 'Sin asignar'}>
        <Icon name="user" size={12} />
      </span>
    );
  }
  return (
    <span
      className={cx('rb-avatar', size && `rb-avatar--${size}`)}
      data-c={(colorIndex ?? 0) % 8}
      title={title || name}
    >
      {label}
    </span>
  );
}

/* ─────────────────────────────── Campos ──────────────────────────────── */

export function Field({ label, required, optional, hint, error, children, className }) {
  return (
    <div className={cx('rb-field', className)}>
      {label && (
        <label className="rb-label">
          {label}
          {required && <span className="rb-req" aria-hidden="true">*</span>}
          {optional && <span className="rb-opt">(opcional)</span>}
        </label>
      )}
      {children}
      {error   ? <span className="rb-error">{error}</span>
        : hint ? <span className="rb-hint">{hint}</span> : null}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…', ...rest }) {
  return (
    <div className="rb-search">
      <Icon name="search" size={15} />
      <input
        className="rb-input" type="search" value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} {...rest}
      />
      {value && (
        <button className="rb-search-clear" onClick={() => onChange('')} aria-label="Limpiar búsqueda">
          <Icon name="close" size={12} />
        </button>
      )}
    </div>
  );
}

/** Grupo de opciones mutuamente excluyentes con apariencia de botón. */
export function ChoiceGroup({ value, onChange, options, name }) {
  return (
    <div className="rb-choice" role="group" aria-label={name}>
      {options.map(o => (
        <button
          key={o.value} type="button" className="rb-choice-btn"
          aria-pressed={value === o.value}
          title={o.hint || o.desc}
          onClick={() => onChange(o.value)}
        >
          {o.tone && <i className="rb-dot" style={{ background: `var(--rb-${o.tone === 'neutral' ? 'n-400' : o.tone})` }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────── Avisos y vacíos ─────────────────────────── */

export function Alert({ tone = 'info', children }) {
  const icon = tone === 'danger' || tone === 'warning' ? 'alert' : tone === 'success' ? 'check' : 'info';
  return (
    <div className="rb-alert" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={icon} size={15} />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, children, action }) {
  return (
    <div className="rb-empty">
      <span className="rb-empty-icon"><Icon name={icon} size={22} /></span>
      {title && <div className="rb-empty-title">{title}</div>}
      {children && <p className="rb-empty-text">{children}</p>}
      {action}
    </div>
  );
}

/* ─────────────────────── Superposiciones ─────────────────────────────── */

/** Cierra con Escape y bloquea el scroll del fondo mientras está abierta. */
function useOverlay(open, onClose) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, subtitle, width, footer, children }) {
  useOverlay(open, onClose);
  if (!open) return null;
  return (
    <div className="rb-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose?.()}>
      <div className="rb-modal" style={width ? { width: `min(${width}px, 100%)` } : undefined}
        role="dialog" aria-modal="true" aria-label={title}>
        <div className="rb-modal-head">
          <div style={{ minWidth: 0 }}>
            <div className="rb-modal-title">{title}</div>
            {subtitle && <div className="rb-modal-sub">{subtitle}</div>}
          </div>
          <button className="rb-modal-close" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="rb-modal-body">{children}</div>
        {footer && <div className="rb-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, children, label }) {
  useOverlay(open, onClose);
  if (!open) return null;
  return (
    <>
      <div className="rb-drawer-backdrop" onMouseDown={onClose} />
      <aside className="rb-drawer" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </aside>
    </>
  );
}

/* ────────────────────────── Diálogo de confirmación ──────────────────── */

export function ConfirmDialog({ open, onCancel, onConfirm, title, confirmLabel = 'Confirmar', tone = 'danger', busy, children }) {
  return (
    <Modal
      open={open} onClose={onCancel} title={title} width={440}
      footer={<>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancelar</Button>
        <Button variant={tone} onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
      </>}
    >
      <p style={{ fontSize: 'var(--rb-fs-md)', color: 'var(--rb-text-2)', lineHeight: 1.6 }}>{children}</p>
    </Modal>
  );
}

/* ────────────────────────────── Segmentado ───────────────────────────── */

export function Segmented({ value, onChange, options }) {
  return (
    <div className="rb-segmented" role="tablist">
      {options.map(o => (
        <button
          key={o.value} role="tab" aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={13} />}
          {o.label}
          {o.count != null && <span className="rb-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────── Métrica / KPI ───────────────────────────── */

export function Stat({ label, value, foot, tone = 'brand', icon, active, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={cx('rb-stat', active && 'is-active')} data-tone={tone} onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}>
      <span className="rb-stat-accent" />
      <span className="rb-stat-label">{icon && <Icon name={icon} size={12} />}{label}</span>
      <span className="rb-stat-value">{value}</span>
      {foot && <span className="rb-stat-foot">{foot}</span>}
    </Tag>
  );
}
