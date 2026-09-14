/* Panorama de la mesa, pensado para dirección.
 *
 * Responde cuatro preguntas, en este orden:
 *   1. ¿Qué tenemos pendiente y desde cuándo?
 *   2. ¿Ganamos o perdemos terreno? (entradas frente a cierres)
 *   3. ¿Cuánto tardamos?
 *   4. ¿Qué viene? (entregas comprometidas)
 *
 * Y después, de dónde viene la demanda y cómo está repartida la carga.
 *
 * Sin librería de gráficos: barras proporcionales, que es lo que estos datos
 * necesitan y además se imprime bien.
 */

import { useMemo, useState } from 'react';
import { useTickets } from '../../context/TicketsContext';
import {
  CATEGORIES, categoryOf, isOpen, isClosed, slaOf, ageInDays,
  PRIORITY_LIST, priorityOf, statusOf, fmtDate,
} from '../../lib/tickets';
import { Badge, EmptyState, Segmented, Stat } from '../ui';

const RANGES = [
  { value: '30',  label: '30 días' },
  { value: '90',  label: '90 días' },
  { value: '365', label: '12 meses' },
  { value: 'all', label: 'Histórico' },
];

const DIA = 86_400_000;

/* ── Piezas de presentación ─────────────────────────────────────────────── */

function Panel({ title, sub, children, nota }) {
  return (
    <section className="rb-card">
      <header className="rb-card-head">
        <div>
          <div className="rb-card-title">{title}</div>
          {sub && <div className="rb-card-sub">{sub}</div>}
        </div>
      </header>
      <div className="rb-card-body">
        {children}
        {nota && <p className="rb-hint" style={{ marginTop: 14 }}>{nota}</p>}
      </div>
    </section>
  );
}

function Bars({ rows, empty = 'Sin datos en el periodo', sufijo = '' }) {
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
          <span className="tk-bar-val">{r.value}{sufijo}</span>
        </div>
      ))}
    </div>
  );
}

/** Dos series enfrentadas por periodo — entradas frente a cierres. */
function BarsDobles({ rows }) {
  const max = Math.max(1, ...rows.flatMap(r => [r.a, r.b]));
  return (
    <div className="tk-bars">
      <div className="rb-row" style={{ gap: 16, marginBottom: 4, fontSize: 'var(--rb-fs-xs)' }}>
        <span className="rb-row" style={{ gap: 5 }}>
          <i className="rb-dot" style={{ background: 'var(--rb-navy)' }} /> Entraron
        </span>
        <span className="rb-row" style={{ gap: 5 }}>
          <i className="rb-dot" style={{ background: 'var(--rb-teal)' }} /> Se cerraron
        </span>
      </div>
      {rows.map(r => (
        <div className="tk-bar-row" key={r.label}>
          <span className="tk-bar-label">{r.label}</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className="tk-bar-track" style={{ height: 6 }}>
              <span className="tk-bar-fill" style={{ width: `${(r.a / max) * 100}%`, background: 'var(--rb-navy)' }} />
            </span>
            <span className="tk-bar-track" style={{ height: 6 }}>
              <span className="tk-bar-fill" style={{ width: `${(r.b / max) * 100}%`, background: 'var(--rb-teal)' }} />
            </span>
          </span>
          <span className="tk-bar-val">{r.a}/{r.b}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Cálculos ───────────────────────────────────────────────────────────── */

const tally = (items, keyFn) => {
  const m = new Map();
  items.forEach(t => {
    const k = keyFn(t);
    if (k) m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};

const mediana = (nums) => {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** Tramos de antigüedad de lo que sigue abierto. */
const TRAMOS = [
  { label: 'Menos de 3 días', min: 0,  max: 3,        color: 'var(--rb-teal)' },
  { label: 'De 3 a 7 días',   min: 3,  max: 7,        color: 'var(--rb-cyan)' },
  { label: 'De 1 a 4 semanas', min: 7, max: 28,       color: 'var(--rb-orange)' },
  { label: 'Más de un mes',   min: 28, max: Infinity, color: 'var(--rb-alert)' },
];

/** Horizontes de planificación para las entregas comprometidas. */
const HORIZONTES = [
  { label: 'Vencidas',        min: -Infinity, max: 0,        color: 'var(--rb-alert)' },
  { label: 'Esta semana',     min: 0,  max: 7,               color: 'var(--rb-orange)' },
  { label: 'Próxima semana',  min: 7,  max: 14,              color: 'var(--rb-cyan)' },
  { label: 'En 2 a 4 semanas', min: 14, max: 28,             color: 'var(--rb-navy)' },
  { label: 'Más adelante',    min: 28, max: Infinity,        color: 'var(--rb-gray)' },
];

export default function TicketReports() {
  const { tickets, loading } = useTickets();
  const [range, setRange] = useState('90');

  const scope = useMemo(() => {
    if (range === 'all') return tickets;
    const desde = Date.now() - Number(range) * DIA;
    return tickets.filter(t => new Date(t.created_at).getTime() >= desde);
  }, [tickets, range]);

  /* Lo pendiente se mira SIEMPRE completo, no filtrado por periodo: un ticket
     de hace cinco meses que sigue abierto es justo el que hay que ver. */
  const abiertos = useMemo(() => tickets.filter(isOpen), [tickets]);

  const kpis = useMemo(() => {
    const cerrados = scope.filter(isClosed);
    const diasCierre = cerrados.map(ageInDays);

    // Cumplimiento: de los cerrados, cuántos se atendieron dentro del plazo.
    const aTiempo = cerrados.filter(t => {
      const pr = priorityOf(t.urgencia || t.priority);
      const limite = new Date(t.created_at);
      limite.setDate(limite.getDate() + pr.slaDays + 2); // margen por fines de semana
      return new Date(t.updated_at || t.created_at) <= limite;
    }).length;

    return {
      pendiente: abiertos.length,
      sinDuenno: abiertos.filter(t => !t.assignee_id).length,
      vencidos: abiertos.filter(t => slaOf(t)?.state === 'breached').length,
      enEjecucion: abiertos.filter(t => t.status === 'convertido').length,
      cerrados: cerrados.length,
      cumplimiento: cerrados.length ? Math.round((aTiempo / cerrados.length) * 100) : null,
      medio: diasCierre.length ? Math.round(diasCierre.reduce((a, b) => a + b, 0) / diasCierre.length) : 0,
      mediana: mediana(diasCierre),
    };
  }, [scope, abiertos]);

  /* 1. Antigüedad de lo pendiente */
  const antiguedad = useMemo(() => TRAMOS.map(tr => ({
    label: tr.label,
    color: tr.color,
    value: abiertos.filter(t => {
      const d = ageInDays(t);
      return d >= tr.min && d < tr.max;
    }).length,
  })), [abiertos]);

  /* 2. Ritmo: entradas frente a cierres, por mes */
  const ritmo = useMemo(() => {
    const meses = [];
    const hoy = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const fin = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      meses.push({
        label: d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }).replace('.', ''),
        a: tickets.filter(t => { const c = new Date(t.created_at); return c >= d && c < fin; }).length,
        b: tickets.filter(t => isClosed(t) && t.updated_at
          && new Date(t.updated_at) >= d && new Date(t.updated_at) < fin).length,
      });
    }
    return meses;
  }, [tickets]);

  /* 3. Cuánto tardamos, por prioridad */
  const demoras = useMemo(() => PRIORITY_LIST.map(p => {
    const dias = scope.filter(t => isClosed(t) && (t.urgencia || t.priority) === p.value).map(ageInDays);
    return {
      label: `Prioridad ${p.label.toLowerCase()}`,
      value: dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : 0,
      color: { alta: 'var(--rb-alert)', media: 'var(--rb-orange)', baja: 'var(--rb-gray)' }[p.value],
      n: dias.length,
    };
  }), [scope]);

  /* 4. Planificación: entregas comprometidas de lo que sigue abierto */
  const planificacion = useMemo(() => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const conFecha = abiertos.filter(t => t.due_date);
    return {
      sinFecha: abiertos.length - conFecha.length,
      tramos: HORIZONTES.map(h => ({
        label: h.label,
        color: h.color,
        value: conFecha.filter(t => {
          const d = Math.floor((new Date(t.due_date) - hoy) / DIA);
          return d >= h.min && d < h.max;
        }).length,
      })),
      proximas: conFecha
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, 6),
    };
  }, [abiertos]);

  /* 5. Origen de la demanda y reparto de la carga */
  const porLinea = useMemo(() => tally(scope, t => (t.area || '').trim() || 'Sin línea').slice(0, 8), [scope]);
  const porTipo = useMemo(() => {
    const orden = CATEGORIES.map(c => c.label);
    return tally(scope, t => categoryOf(t.type).label)
      .sort((a, b) => orden.indexOf(a.label) - orden.indexOf(b.label));
  }, [scope]);
  const porResponsable = useMemo(() => {
    const filas = tally(abiertos, t => t.assignee_name);
    const sin = abiertos.filter(t => !t.assignee_id).length;
    return sin ? [...filas, { label: 'Sin asignar', value: sin, color: 'var(--rb-orange)' }] : filas;
  }, [abiertos]);

  if (loading) return <div className="rb-skeleton" style={{ height: 320 }} />;

  if (!tickets.length) {
    return (
      <div className="rb-card">
        <EmptyState icon="chart" title="Todavía no hay datos">
          El panorama se construye con los tickets radicados. En cuanto entren los primeros,
          esta pantalla se llena sola.
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      <div className="tk-toolbar">
        <Segmented value={range} onChange={setRange} options={RANGES} />
        <span style={{ flex: 1 }} />
        <span className="rb-hint">
          {scope.length} tickets en el periodo · {abiertos.length} abiertos en total
        </span>
      </div>

      {/* ── Lo esencial de un vistazo ── */}
      <div className="rb-stats">
        <Stat label="Pendiente ahora" tone="brand" icon="inbox"
          value={kpis.pendiente} foot={`${kpis.enEjecucion} ya en ejecución`} />
        <Stat label="Sin responsable" tone="warning" icon="user"
          value={kpis.sinDuenno} foot="Esperan triage" />
        <Stat label="Con SLA vencido" tone="danger" icon="alert"
          value={kpis.vencidos} foot="Pasaron el compromiso de respuesta" />
        <Stat label="Cumplimiento de SLA" tone="success" icon="target"
          value={kpis.cumplimiento == null ? '—' : `${kpis.cumplimiento}%`}
          foot={kpis.cerrados ? `sobre ${kpis.cerrados} cerrados` : 'Sin cierres en el periodo'} />
      </div>

      <div className="tk-report-grid">
        {/* 1 ── Qué tenemos pendiente */}
        <Panel
          title="Antigüedad de lo pendiente"
          sub="Cuánto llevan esperando los tickets que siguen abiertos"
          nota="Se mira sobre todo lo abierto, sin filtrar por periodo: un ticket viejo que sigue vivo es justo el que hay que ver."
        >
          <Bars rows={antiguedad} sufijo="" empty="No hay nada pendiente" />
        </Panel>

        {/* 2 ── Ganamos o perdemos terreno */}
        <Panel
          title="Ritmo de la mesa"
          sub="Tickets que entraron frente a los que se cerraron, por mes"
          nota="Si la barra oscura supera sistemáticamente a la clara, el pendiente crece."
        >
          <BarsDobles rows={ritmo} />
        </Panel>

        {/* 3 ── Cuánto tardamos */}
        <Panel
          title="Cuánto tardamos"
          sub="Días desde que se radica hasta que se cierra"
          nota="Medido de la radicación al cierre. No hay registro de cambios de estado, así que no es posible desglosar cuánto se va en cada etapa; para eso haría falta guardar las transiciones."
        >
          <div className="rb-row" style={{ gap: 28, marginBottom: 16 }}>
            <div>
              <div className="rb-stat-value" style={{ fontSize: 'var(--rb-fs-2xl)' }}>
                {kpis.cerrados ? `${kpis.medio} d` : '—'}
              </div>
              <div className="rb-hint">Promedio</div>
            </div>
            <div>
              <div className="rb-stat-value" style={{ fontSize: 'var(--rb-fs-2xl)' }}>
                {kpis.cerrados ? `${kpis.mediana} d` : '—'}
              </div>
              <div className="rb-hint">Mediana</div>
            </div>
          </div>
          <Bars
            rows={demoras.map(d => ({ ...d, label: `${d.label} (${d.n})` }))}
            sufijo=" d"
            empty="Todavía no hay tickets cerrados en el periodo"
          />
        </Panel>

        {/* 4 ── Qué viene */}
        <Panel
          title="Entregas comprometidas"
          sub="Fechas que los solicitantes esperan, de lo que sigue abierto"
          nota={planificacion.sinFecha
            ? `${planificacion.sinFecha} ticket${planificacion.sinFecha !== 1 ? 's' : ''} abierto${planificacion.sinFecha !== 1 ? 's' : ''} sin fecha comprometida.`
            : null}
        >
          <Bars rows={planificacion.tramos} empty="Ningún ticket abierto tiene fecha" />

          {planificacion.proximas.length > 0 && (
            <>
              <div className="tk-section-title" style={{ marginTop: 20 }}>Lo más próximo</div>
              <div className="tk-review">
                {planificacion.proximas.map(t => (
                  <div className="tk-review-row" key={t.id} style={{ gridTemplateColumns: '92px minmax(0,1fr) auto' }}>
                    <b>{fmtDate(t.due_date)}</b>
                    <span className="rb-truncate">{t.title}</span>
                    <Badge tone={statusOf(t.status).tone}>{statusOf(t.status).label}</Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        {/* 5 ── De dónde viene y cómo se reparte */}
        <Panel title="Demanda por línea de servicio" sub="De dónde viene el trabajo">
          <Bars rows={porLinea} />
        </Panel>

        <Panel title="Tipo de solicitud" sub="Qué nos piden">
          <Bars rows={porTipo} />
        </Panel>

        <Panel title="Carga abierta por responsable" sub="Tickets vivos a nombre de cada persona">
          <Bars rows={porResponsable} empty="No hay tickets abiertos" />
        </Panel>

        <Panel title="Mezcla de prioridades" sub="Cómo llega clasificada la demanda">
          <Bars rows={PRIORITY_LIST.map(p => ({
            label: `Prioridad ${p.label.toLowerCase()}`,
            value: scope.filter(t => (t.urgencia || t.priority) === p.value).length,
            color: { alta: 'var(--rb-alert)', media: 'var(--rb-orange)', baja: 'var(--rb-gray)' }[p.value],
          }))} />
        </Panel>
      </div>
    </>
  );
}
