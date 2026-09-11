/* Reportes de la mesa.

   Responde cuatro preguntas de dirección, en ese orden: ¿cumplimos el
   compromiso?, ¿cuánto tardamos?, ¿de dónde viene la demanda? y ¿cómo está
   repartida la carga. Sin librería de gráficos: barras proporcionales, que es
   lo que estos datos necesitan y se imprime bien. */

import { useMemo, useState } from 'react';
import { useTickets } from '../../context/TicketsContext';
import {
  CATEGORIES, categoryOf, isOpen, isClosed, slaOf, ageInDays,
  PRIORITY_LIST, priorityOf,
} from '../../lib/tickets';
import { EmptyState, Segmented, Stat } from '../ui';

const RANGES = [
  { value: '30',  label: '30 días' },
  { value: '90',  label: '90 días' },
  { value: '365', label: '12 meses' },
  { value: 'all', label: 'Histórico' },
];

function Bars({ rows, empty = 'Sin datos en el periodo' }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  if (!rows.length) return <div className="rb-hint" style={{ padding: '8px 0' }}>{empty}</div>;
  return (
    <div className="tk-bars">
      {rows.map(r => (
        <div className="tk-bar-row" key={r.label}>
          <span className="tk-bar-label" title={r.label}>{r.label}</span>
          <span className="tk-bar-track">
            <span className="tk-bar-fill"
              style={{ width: `${(r.value / max) * 100}%`, background: r.color || undefined }} />
          </span>
          <span className="tk-bar-val">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, sub, children }) {
  return (
    <section className="rb-card">
      <header className="rb-card-head">
        <div>
          <div className="rb-card-title">{title}</div>
          {sub && <div className="rb-card-sub">{sub}</div>}
        </div>
      </header>
      <div className="rb-card-body">{children}</div>
    </section>
  );
}

const tally = (items, keyFn) => {
  const m = new Map();
  items.forEach(t => {
    const k = keyFn(t);
    if (!k) return;
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
};

export default function TicketReports() {
  const { tickets, loading } = useTickets();
  const [range, setRange] = useState('90');

  const scope = useMemo(() => {
    if (range === 'all') return tickets;
    const from = Date.now() - Number(range) * 86_400_000;
    return tickets.filter(t => new Date(t.created_at).getTime() >= from);
  }, [tickets, range]);

  const stats = useMemo(() => {
    const closed = scope.filter(isClosed);
    const open   = scope.filter(isOpen);

    /* Cumplimiento: de los cerrados, cuántos se cerraron dentro del plazo. */
    const onTime = closed.filter(t => {
      const pr  = priorityOf(t.urgencia || t.priority);
      const end = new Date(t.updated_at || t.created_at);
      const lim = new Date(t.created_at);
      lim.setDate(lim.getDate() + pr.slaDays + 2); // margen por fines de semana
      return end <= lim;
    }).length;

    const avgAge = closed.length
      ? Math.round(closed.reduce((s, t) => s + ageInDays(t), 0) / closed.length)
      : 0;

    return {
      total: scope.length,
      open: open.length,
      closed: closed.length,
      breached: open.filter(t => slaOf(t)?.state === 'breached').length,
      compliance: closed.length ? Math.round((onTime / closed.length) * 100) : null,
      avgAge,
    };
  }, [scope]);

  const byArea     = useMemo(() => tally(scope, t => (t.area || '').trim() || 'Sin línea').slice(0, 10), [scope]);
  const byCategory = useMemo(() => {
    const counts = tally(scope, t => categoryOf(t.type).label);
    const order = CATEGORIES.map(c => c.label);
    return counts.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  }, [scope]);
  const byAssignee = useMemo(() => {
    const open = scope.filter(isOpen);
    const rows = tally(open, t => t.assignee_name);
    const unassigned = open.filter(t => !t.assignee_id).length;
    return unassigned ? [...rows, { label: 'Sin asignar', value: unassigned, color: 'var(--rb-orange)' }] : rows;
  }, [scope]);
  /* En superficies grandes van los colores planos del manual; las variantes
     oscuras («ink») se reservan para texto, donde hacen falta por contraste. */
  const PRIORITY_FILL = { alta: 'var(--rb-alert)', media: 'var(--rb-orange)', baja: 'var(--rb-gray)' };
  const byPriority = useMemo(() => PRIORITY_LIST.map(p => ({
    label: `Prioridad ${p.label.toLowerCase()}`,
    value: scope.filter(t => (t.urgencia || t.priority) === p.value).length,
    color: PRIORITY_FILL[p.value],
  })), [scope]);

  if (loading) {
    return <div className="rb-skeleton" style={{ height: 320 }} />;
  }

  if (!tickets.length) {
    return (
      <div className="rb-card">
        <EmptyState icon="chart" title="Todavía no hay datos">
          Los reportes se construyen con los tickets radicados. En cuanto entren los primeros, esta pantalla se llena sola.
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      <div className="tk-toolbar">
        <Segmented value={range} onChange={setRange} options={RANGES} />
        <span style={{ flex: 1 }} />
        <span className="rb-hint">{stats.total} tickets en el periodo</span>
      </div>

      <div className="rb-stats">
        <Stat label="Cumplimiento de SLA" tone="success" icon="target"
          value={stats.compliance == null ? '—' : `${stats.compliance}%`}
          foot={stats.closed ? `${stats.closed} tickets cerrados` : 'Sin cierres en el periodo'} />
        <Stat label="Tiempo medio de atención" tone="brand" icon="clock"
          value={stats.closed ? `${stats.avgAge} d` : '—'}
          foot="Desde radicación hasta cierre" />
        <Stat label="Abiertos" tone="neutral" icon="inbox"
          value={stats.open} foot="Pendientes al día de hoy" />
        <Stat label="Con SLA vencido" tone="danger" icon="alert"
          value={stats.breached} foot="Requieren acción inmediata" />
      </div>

      <div className="tk-report-grid">
        <Panel title="Demanda por línea de servicio" sub="De dónde viene el trabajo">
          <Bars rows={byArea} />
        </Panel>
        <Panel title="Tipo de solicitud" sub="Qué nos piden">
          <Bars rows={byCategory} />
        </Panel>
        <Panel title="Carga abierta por responsable" sub="Tickets vivos asignados a cada persona">
          <Bars rows={byAssignee} empty="No hay tickets abiertos" />
        </Panel>
        <Panel title="Mezcla de prioridades" sub="Cómo llega clasificada la demanda">
          <Bars rows={byPriority} />
        </Panel>
      </div>
    </>
  );
}
