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
  CATEGORIES, categoryOf, isOpen, isClosed, slaOf,
  PRIORITY_LIST, priorityOf, statusOf, fmtDate, coberturaAnalitica,
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

function Panel({ title, sub, children, nota, aparte }) {
  return (
    <section className="rb-card">
      <header className="rb-card-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rb-card-title">{title}</div>
          {sub && <div className="rb-card-sub">{sub}</div>}
        </div>
        {aparte}
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

/* Estados de un proyecto que siguen vivos. `done` y `cancelado` están cerrados. */
const TRABAJO_ABIERTO = ['backlog', 'progress', 'standby', 'testing', 'soporte'];
const PRIORIDAD_PROYECTO = { high: 'alta', mid: 'media', low: 'baja' };

/**
 * Tickets y proyectos son cosas distintas en la base, pero para dirección son
 * lo mismo: trabajo que entra, espera y se entrega. Se normalizan a una forma
 * común para poder contarlos juntos.
 *
 * Hace falta porque no todo el trabajo nace de un ticket: un proyecto se puede
 * crear a mano, y si el panorama solo mirara la bandeja, ese trabajo sería
 * invisible justo para quien necesita verlo todo.
 */
const desdeTicket = (t) => ({
  id: `t-${t.id}`,
  titulo: t.title,
  origen: 'ticket',
  abierto: isOpen(t),
  creado: t.created_at,
  cerrado: isClosed(t) ? t.updated_at : null,
  fecha: t.due_date || null,
  prioridad: t.urgencia || t.priority || 'media',
  area: (t.area || '').trim(),
  responsable: t.assignee_name || null,
  estado: statusOf(t.status).label,
  tono: statusOf(t.status).tone,
});

const desdeProyecto = (p) => {
  const abierto = TRABAJO_ABIERTO.includes(p.status);
  const responsables = p.assignees?.length ? p.assignees : (p.assignee ? [p.assignee] : []);
  return {
    id: `p-${p.id}`,
    titulo: p.name,
    origen: 'trabajo',
    abierto,
    creado: p.createdAt || p.created_at,
    cerrado: abierto ? null : (p.updatedAt || p.updated_at),
    fecha: p.dueDate || null,
    prioridad: PRIORIDAD_PROYECTO[p.priority] || 'media',
    area: (p.client || '').trim(),
    responsable: responsables[0]?.name || null,
    estado: p.status === 'progress' ? 'En curso' : p.status === 'standby' ? 'En standby'
      : p.status === 'testing' ? 'En testing' : p.status === 'soporte' ? 'En soporte'
      : p.status === 'done' ? 'Finalizado' : p.status === 'cancelado' ? 'Cancelado' : 'Por hacer',
    tono: p.status === 'standby' ? 'warning' : p.status === 'done' ? 'success'
      : p.status === 'cancelado' ? 'danger' : 'brand',
  };
};

const diasDesde = (fecha) => fecha
  ? Math.max(0, Math.floor((Date.now() - new Date(fecha)) / DIA)) : 0;

export default function TicketReports({ projects = [] }) {
  const { tickets, loading } = useTickets();
  const [range, setRange] = useState('90');

  /* Todo el trabajo, venga de donde venga. */
  const todo = useMemo(
    () => [...tickets.map(desdeTicket), ...projects.map(desdeProyecto)],
    [tickets, projects],
  );

  const scope = useMemo(() => {
    if (range === 'all') return todo;
    const desde = Date.now() - Number(range) * DIA;
    return todo.filter(x => new Date(x.creado).getTime() >= desde);
  }, [todo, range]);

  /* Lo pendiente se mira SIEMPRE completo, no filtrado por periodo: algo de
     hace cinco meses que sigue abierto es justo lo que hay que ver. */
  const abiertos = useMemo(() => todo.filter(x => x.abierto), [todo]);

  /* El SLA es propio del ticket: un proyecto creado a mano no tiene
     compromiso de respuesta que medir. */
  const ticketsAbiertos = useMemo(() => tickets.filter(isOpen), [tickets]);

  const kpis = useMemo(() => {
    const cerrados = scope.filter(x => !x.abierto && x.cerrado);
    const dias = cerrados.map(x => Math.max(0,
      Math.round((new Date(x.cerrado) - new Date(x.creado)) / DIA)));

    const ticketsCerrados = scope.filter(x => x.origen === 'ticket' && !x.abierto);
    const aTiempo = tickets.filter(isClosed).filter(t => {
      const pr = priorityOf(t.urgencia || t.priority);
      const limite = new Date(t.created_at);
      limite.setDate(limite.getDate() + pr.slaDays + 2); // margen por fines de semana
      return new Date(t.updated_at || t.created_at) <= limite;
    }).length;
    const totalTicketsCerrados = tickets.filter(isClosed).length;

    return {
      pendiente: abiertos.length,
      deTickets: abiertos.filter(x => x.origen === 'ticket').length,
      deTrabajos: abiertos.filter(x => x.origen === 'trabajo').length,
      sinDuenno: abiertos.filter(x => !x.responsable).length,
      vencidos: ticketsAbiertos.filter(t => slaOf(t)?.state === 'breached').length,
      cerrados: cerrados.length,
      ticketsCerrados: ticketsCerrados.length,
      cumplimiento: totalTicketsCerrados ? Math.round((aTiempo / totalTicketsCerrados) * 100) : null,
      medio: dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : 0,
      mediana: mediana(dias),
    };
  }, [scope, abiertos, tickets, ticketsAbiertos]);

  /* 1. Antigüedad de lo pendiente */
  const antiguedad = useMemo(() => TRAMOS.map(tr => ({
    label: tr.label,
    color: tr.color,
    value: abiertos.filter(x => {
      const d = diasDesde(x.creado);
      return d >= tr.min && d < tr.max;
    }).length,
  })), [abiertos]);

  /* 2. Ritmo: lo que entró frente a lo que se cerró, por mes */
  const ritmo = useMemo(() => {
    const meses = [];
    const hoy = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const fin = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const dentro = (f) => f && new Date(f) >= d && new Date(f) < fin;
      meses.push({
        label: d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }).replace('.', ''),
        a: todo.filter(x => dentro(x.creado)).length,
        b: todo.filter(x => !x.abierto && dentro(x.cerrado)).length,
      });
    }
    return meses;
  }, [todo]);

  /* 3. Cuánto tardamos, por prioridad */
  const demoras = useMemo(() => PRIORITY_LIST.map(p => {
    const dias = scope
      .filter(x => !x.abierto && x.cerrado && x.prioridad === p.value)
      .map(x => Math.max(0, Math.round((new Date(x.cerrado) - new Date(x.creado)) / DIA)));
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
    const conFecha = abiertos.filter(x => x.fecha);
    return {
      sinFecha: abiertos.length - conFecha.length,
      tramos: HORIZONTES.map(h => ({
        label: h.label,
        color: h.color,
        value: conFecha.filter(x => {
          const d = Math.floor((new Date(x.fecha) - hoy) / DIA);
          return d >= h.min && d < h.max;
        }).length,
      })),
      proximas: [...conFecha].sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(0, 6),
    };
  }, [abiertos]);

  /* 5. Origen de la demanda y reparto de la carga */
  const porLinea = useMemo(
    () => tally(scope, x => x.area || 'Sin línea').slice(0, 8), [scope]);
  const porTipo = useMemo(() => {
    const orden = CATEGORIES.map(c => c.label);
    return tally(scope.filter(x => x.origen === 'ticket'),
      x => categoryOf(tickets.find(t => `t-${t.id}` === x.id)?.type).label)
      .sort((a, b) => orden.indexOf(a.label) - orden.indexOf(b.label));
  }, [scope, tickets]);
  const porResponsable = useMemo(() => {
    const filas = tally(abiertos, x => x.responsable);
    const sin = abiertos.filter(x => !x.responsable).length;
    return sin ? [...filas, { label: 'Sin asignar', value: sin, color: 'var(--rb-orange)' }] : filas;
  }, [abiertos]);

  const analitica = useMemo(() => coberturaAnalitica(projects), [projects]);

  /* Trabajo por proyecto: para dirección, «5 abiertos» no responde nada; lo
     que se pregunta es cuánto queda por hacer dentro de cada uno.
     Solo se cuentan proyectos vivos (backlog, progress, standby, testing,
     soporte); los cerrados no arrastran su lista al panorama. Y solo tareas
     pendientes: las completadas no reclaman atención. */
  const trabajoPorProyecto = useMemo(() => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const vencida = (d) => d && new Date(String(d).slice(0, 10) + 'T00:00:00') < hoy;

    return projects
      .filter(p => TRABAJO_ABIERTO.includes(p.status))
      .map(p => {
        const tareas = p.tasks || [];
        const pendientes = tareas.filter(t => !t.done);
        const vencidas = pendientes.filter(t => vencida(t.dueDate)).length;
        const proxima = pendientes
          .filter(t => t.dueDate)
          .map(t => t.dueDate)
          .sort()[0] || null;

        /* Las TRES tareas más urgentes del proyecto, para verlas sin abrir la
           ficha. Ordenadas: vencidas primero (las más vencidas antes), después
           las que tienen fecha próxima, al final las sin fecha. Mostrar más no
           cabe en el panorama; el enlace lleva a la ficha para las restantes. */
        const orden = (t) => {
          if (!t.dueDate) return 2;
          return vencida(t.dueDate) ? 0 : 1;
        };
        const topTareas = [...pendientes]
          .sort((a, b) => orden(a) - orden(b) || (a.dueDate || 'z').localeCompare(b.dueDate || 'z'))
          .slice(0, 3);

        return {
          id: p.id,
          nombre: p.name,
          responsable: (p.assignees?.[0] || p.assignee)?.name || null,
          totalTareas: tareas.length,
          pendientes: pendientes.length,
          vencidas,
          proxima,
          proximaVencida: vencida(proxima),
          topTareas: topTareas.map(t => ({
            id: t.id, title: t.title, done: t.done, dueDate: t.dueDate,
            vencida: vencida(t.dueDate),
            asignado: (p.assignees || []).find(u => u.id === t.assigneeId) || (t.assigneeId ? { name: '—', initials: '—' } : null),
          })),
          restoPendientes: Math.max(0, pendientes.length - topTareas.length),
        };
      })
      /* Primero lo que reclama atención: vencidas arriba, después las que
         están más cerca de vencer, después el resto. */
      .sort((a, b) => {
        if (a.vencidas !== b.vencidas) return b.vencidas - a.vencidas;
        if (a.proxima && b.proxima) return a.proxima.localeCompare(b.proxima);
        if (a.proxima) return -1;
        if (b.proxima) return 1;
        return a.nombre.localeCompare(b.nombre, 'es');
      });
  }, [projects]);

  const totalPendientes = trabajoPorProyecto.reduce((s, x) => s + x.pendientes, 0);
  const totalVencidas   = trabajoPorProyecto.reduce((s, x) => s + x.vencidas, 0);

  if (loading) return <div className="rb-skeleton" style={{ height: 320 }} />;

  if (!todo.length) {
    return (
      <div className="rb-card">
        <EmptyState icon="chart" title="Todavía no hay datos">
          El panorama se construye con los tickets radicados y los trabajos en curso.
          En cuanto entre el primero, esta pantalla se llena sola.
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
          {scope.length} en el periodo · {abiertos.length} abiertos en total
          {kpis.deTrabajos > 0 && ` · incluye ${kpis.deTrabajos} trabajo${kpis.deTrabajos !== 1 ? 's' : ''} sin ticket`}
        </span>
      </div>

      {/* ── Lo esencial de un vistazo ── */}
      <div className="rb-stats">
        <Stat label="Pendiente ahora" tone="brand" icon="inbox"
          value={kpis.pendiente}
          foot={`${kpis.deTickets} tickets · ${kpis.deTrabajos} trabajos`} />
        <Stat label="Sin responsable" tone="warning" icon="user"
          value={kpis.sinDuenno} foot="Esperan triage" />
        <Stat label="Con SLA vencido" tone="danger" icon="alert"
          value={kpis.vencidos} foot="Tickets que pasaron el compromiso" />
        <Stat label="Cumplimiento de SLA" tone="success" icon="target"
          value={kpis.cumplimiento == null ? '—' : `${kpis.cumplimiento}%`}
          foot={kpis.cumplimiento == null ? 'Sin tickets cerrados aún' : 'Sobre los tickets cerrados'} />
      </div>

      {/* ── 1. LO QUE RECLAMA ATENCIÓN ─────────────────────────────────
          El bloque táctico va arriba: trabajo por proyecto con sus tareas
          visibles + entregas comprometidas al lado. Es lo que dirección
          mira primero. */}
      <div className="tk-report-hero">
        {trabajoPorProyecto.length > 0 && (
          <Panel
            title="Trabajo por proyecto"
            sub="Cuánto queda por hacer en cada proyecto abierto y cuál es su próxima entrega"
            aparte={totalVencidas > 0
              ? <span className="tk-panel-badge tk-panel-badge--danger">{totalVencidas} vencida{totalVencidas > 1 ? 's' : ''}</span>
              : <span className="tk-panel-badge">{totalPendientes} tareas</span>}
          >
            <div className="tk-proj-list">
              {trabajoPorProyecto.map(x => {
                const tono = x.vencidas ? 'danger' : x.proxima ? 'warning' : 'neutral';
                return (
                  <article key={x.id} className={`tk-proj tk-proj--${tono}`}>
                    <div className="tk-proj-head">
                      <span className={`tk-proj-rail tk-proj-rail--${tono}`} />
                      <div className="tk-proj-main">
                        <div className="tk-proj-name rb-truncate">{x.nombre}</div>
                        <div className="tk-proj-meta">{x.responsable || 'Sin responsable'}</div>
                      </div>
                      <div className="tk-proj-count">
                        <b>{x.pendientes}</b>
                        <span>/{x.totalTareas}</span>
                      </div>
                      <span className={`tk-proj-tag tk-proj-tag--${tono}`}>
                        {x.vencidas
                          ? `${x.vencidas} vencida${x.vencidas > 1 ? 's' : ''}`
                          : x.proxima
                            ? `Próxima ${fmtDate(x.proxima)}`
                            : 'Sin fecha'}
                      </span>
                    </div>

                    {(x.topTareas.length > 0 || x.pendientes === 0) && (
                      <div className={`tk-proj-tasks tk-proj-tasks--${tono}`}>
                        {x.topTareas.length === 0 ? (
                          <div className="tk-proj-empty">
                            {x.totalTareas === 0
                              ? 'Aún sin tareas registradas.'
                              : 'Todo completado por ahora.'}
                          </div>
                        ) : (
                          <>
                            {x.topTareas.map(t => (
                              <div key={t.id} className="tk-proj-task">
                                <span className={`tk-proj-task-dot tk-proj-task-dot--${t.vencida ? 'danger' : 'neutral'}`} />
                                <span className="tk-proj-task-title rb-truncate">{t.title}</span>
                                <span className={`tk-proj-task-when tk-proj-task-when--${t.vencida ? 'danger' : 'muted'}`}>
                                  {t.dueDate ? (t.vencida ? `vencida — ${fmtDate(t.dueDate)}` : fmtDate(t.dueDate)) : 'sin fecha'}
                                </span>
                              </div>
                            ))}
                            {x.restoPendientes > 0 && (
                              <div className="tk-proj-mas">
                                y {x.restoPendientes} tarea{x.restoPendientes > 1 ? 's' : ''} pendiente{x.restoPendientes > 1 ? 's' : ''} más
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </Panel>
        )}

        <Panel
          title="Entregas comprometidas"
          sub="Qué viene y en cuánto"
          nota={planificacion.sinFecha
            ? `${planificacion.sinFecha} abierto${planificacion.sinFecha > 1 ? 's' : ''} sin fecha comprometida. Sin fecha no hay compromiso que medir.`
            : null}
        >
          <div className="tk-horizonte">
            {planificacion.tramos.map(t => (
              <div key={t.label} className={`tk-horizonte-row${t.value > 0 && (t.label === 'Vencidas' || t.label === 'Esta semana') ? ' tk-horizonte-row--alerta' : ''}`}>
                <span className="tk-horizonte-punto" style={{ background: t.color }} />
                <span className="tk-horizonte-label">{t.label}</span>
                <span className="tk-horizonte-val">{t.value}</span>
              </div>
            ))}
          </div>

          {planificacion.proximas.length > 0 && (
            <>
              <div className="tk-section-title" style={{ marginTop: 20 }}>Lo más próximo</div>
              <div className="tk-review">
                {planificacion.proximas.map(x => (
                  <div className="tk-review-row" key={x.id} style={{ gridTemplateColumns: '92px minmax(0,1fr) auto' }}>
                    <b>{fmtDate(x.fecha)}</b>
                    <span className="rb-truncate">{x.titulo}</span>
                    <Badge tone={x.tono}>{x.estado}</Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </div>


      {/* ── 2. ANALÍTICA POR CLIENTE ─────────────────────────────────────
          Banda propia con lectura ampliada: es el objetivo estratégico
          concreto de esta mesa, no un panel más entre otros nueve. */}
      {analitica.total > 0 && (
        <div className="tk-report-band">
          <Panel
            title="Analítica por cliente"
            sub="A cuántos clientes se les cargó la analítica y a cuántos falta"
            nota="Un cliente cuenta como cargado en cuanto se marca en alguno de sus proyectos. Se marca desde la ficha del proyecto, cliente por cliente."
          >
            <div className="tk-analitica">
              <div className="tk-analitica-hero">
                <div className="tk-analitica-pct">
                  {analitica.pct}<span>%</span>
                </div>
                <div className="tk-analitica-cifras">
                  <div>
                    <b style={{ color: 'var(--rb-teal-ink)' }}>{analitica.hechos.length}</b>
                    <span>Cargada</span>
                  </div>
                  <div className="tk-analitica-sep" />
                  <div>
                    <b style={{ color: analitica.faltan.length ? 'var(--rb-orange-ink)' : 'var(--rb-text-3)' }}>{analitica.faltan.length}</b>
                    <span>Pendientes</span>
                  </div>
                  <div className="tk-analitica-sep" />
                  <div>
                    <b>{analitica.total}</b>
                    <span>Total en curso</span>
                  </div>
                </div>
              </div>

              <div className="tk-analitica-bar">
                {analitica.hechos.length > 0 && (
                  <div className="tk-analitica-bar-fill tk-analitica-bar-fill--ok"
                    style={{ width: `${(analitica.hechos.length / analitica.total) * 100}%` }}>
                    {analitica.hechos.length} cargada
                  </div>
                )}
                {analitica.faltan.length > 0 && (
                  <div className="tk-analitica-bar-fill tk-analitica-bar-fill--faltan"
                    style={{ width: `${(analitica.faltan.length / analitica.total) * 100}%` }}>
                    {analitica.faltan.length} pendientes
                  </div>
                )}
              </div>
            </div>

            <div className="tk-analitica-cols">
              {analitica.faltan.length > 0 && (
                <div>
                  <div className="tk-section-title">Falta cargar</div>
                  <div className="tk-review">
                    {analitica.faltan.map(c => (
                      <div className="tk-review-row" key={c.id} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                        <span className="rb-truncate">{c.nombre}</span>
                        <span className="rb-hint rb-truncate" style={{ maxWidth: 220 }}>
                          {[...new Set(c.proyectos)].join(' · ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analitica.hechos.length > 0 && (
                <div>
                  <div className="tk-section-title">Ya cargada</div>
                  <div className="tk-review">
                    {analitica.hechos.map(c => (
                      <div className="tk-review-row" key={c.id} style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto' }}>
                        <span className="rb-truncate">{c.nombre}</span>
                        <span className="rb-hint rb-truncate" style={{ maxWidth: 160 }}>{c.quien || '—'}</span>
                        <b style={{ fontSize: 'var(--rb-fs-xs)' }}>{c.cuando ? fmtDate(c.cuando) : '—'}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {analitica.porPersona.length > 0 && (
              <>
                <div className="tk-section-title" style={{ marginTop: 20 }}>Quién la ha cargado</div>
                <Bars rows={analitica.porPersona} sufijo=" clientes" />
              </>
            )}
          </Panel>
        </div>
      )}


      {/* ── 3. SALUD DEL PROCESO ─────────────────────────────────────────
          Los tres indicadores que dicen cómo está corriendo la mesa: qué
          se acumula, si crece o baja el pendiente, cuánto tardamos. */}
      <div className="tk-report-group">
        <div className="tk-group-title">Salud del proceso</div>
        <div className="tk-report-grid">
          <Panel
            title="Antigüedad de lo pendiente"
            sub="Cuánto lleva esperando todo lo que sigue abierto"
            nota="Se mira sobre todo lo abierto, sin filtrar por periodo: un ticket viejo que sigue vivo es justo el que hay que ver."
          >
            <Bars rows={antiguedad} sufijo="" empty="No hay nada pendiente" />
          </Panel>

          <Panel
            title="Ritmo de la mesa"
            sub="Lo que entró frente a lo que se cerró, por mes"
            nota="Si la barra oscura supera sistemáticamente a la clara, el pendiente crece."
          >
            <BarsDobles rows={ritmo} />
          </Panel>

          <Panel
            title="Cuánto tardamos"
            sub="Días desde que se radica hasta que se cierra"
            nota="Medido de la creación al cierre, sobre tickets y trabajos. Sin registro de cambios de estado no es posible desglosar cuánto se va en cada etapa."
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
        </div>
      </div>


      {/* ── 4. DÓNDE VIENE Y CÓMO SE REPARTE ─────────────────────────────
          Distribución del trabajo: cuatro paneles pequeños, uno por eje. */}
      <div className="tk-report-group">
        <div className="tk-group-title">De dónde viene y cómo se reparte</div>
        <div className="tk-report-grid tk-report-grid--four">
          <Panel title="Demanda por línea de servicio" sub="De dónde viene el trabajo">
            <Bars rows={porLinea} />
          </Panel>

          <Panel title="Tipo de solicitud" sub="Qué nos piden"
            nota="Solo cuenta lo que entró como ticket: un trabajo creado a mano no declara tipo.">
            <Bars rows={porTipo} empty="Todavía no hay tickets en el periodo" />
          </Panel>

          <Panel title="Carga abierta por responsable" sub="Trabajo vivo a nombre de cada persona">
            <Bars rows={porResponsable} empty="No hay nada abierto" />
          </Panel>

          <Panel title="Mezcla de prioridades" sub="Cómo llega clasificada la demanda">
            <Bars rows={PRIORITY_LIST.map(p => ({
              label: `Prioridad ${p.label.toLowerCase()}`,
              value: scope.filter(x => x.prioridad === p.value).length,
              color: { alta: 'var(--rb-alert)', media: 'var(--rb-orange)', baja: 'var(--rb-gray)' }[p.value],
            }))} />
          </Panel>
        </div>
      </div>
    </>
  );
}
