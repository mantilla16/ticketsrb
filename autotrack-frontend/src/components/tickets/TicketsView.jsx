/* Bandeja de tickets — la pantalla principal de la mesa de servicio.

   Una sola vista sirve a tres lecturas (`view`):
     · inbox → todo lo que llega a la mesa
     · mine  → lo mío (asignado a mí si soy del equipo, radicado por mí si soy auditor)
     · board → el mismo conjunto como flujo por estado
   Cambiar de lectura no cambia los filtros ni el buscador: es la misma bandeja
   mirada de otra forma. */

import { useEffect, useMemo, useState } from 'react';
import { projectsAPI } from '../../services/api';
import { useTickets } from '../../context/TicketsContext';
import {
  statusOf, PRIORITY_LIST, SERVICE_LINES,
  isOpen, isClosed, slaOf, byUrgency, searchBlob, isDesk, esSoloLectura,
} from '../../lib/tickets';
import { Button, EmptyState, SearchInput, Segmented, Stat } from '../ui';
import TicketRow from './TicketRow';
import TicketBoard from './TicketBoard';
import TicketDetail from './TicketDetail';
import NewTicketForm from './NewTicketForm';

const PER_PAGE = 12;

/* Cuando un ticket entra en ejecución se abre el proyecto que lo materializa. */
const PROJECT_STATUS = {
  recibido: 'backlog', en_revision: 'backlog', reunion_agendada: 'backlog',
  aceptado: 'progress', convertido: 'progress',
  cerrado: 'done', rechazado: 'cancelado',
};
const PROJECT_PRIORITY = { alta: 'high', media: 'mid', baja: 'low' };

const SLA_FILTERS = [
  { value: 'all',      label: 'Todo el SLA' },
  { value: 'breached', label: 'SLA vencido' },
  { value: 'at_risk',  label: 'Vence hoy o mañana' },
  { value: 'ok',       label: 'Dentro de plazo' },
];

export default function TicketsView({ view = 'inbox', user, users = [], showToast, onProjectCreated }) {
  const {
    tickets, loading, error, refresh,
    create, updateStatus, updateInfo, markProjectCreated, remove,
  } = useTickets();

  const desk       = isDesk(user);
  const puedeAbrir = !esSoloLectura(user);   // gerencia observa, no radica

  const [selected,   setSelected]   = useState(null);
  const [composing,  setComposing]  = useState(false);
  const [search,     setSearch]     = useState('');
  const [tab,        setTab]        = useState('open');
  const [fArea,      setFArea]      = useState('all');
  const [fPriority,  setFPriority]  = useState('all');
  const [fAssignee,  setFAssignee]  = useState('all');
  const [fSla,       setFSla]       = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [page,       setPage]       = useState(1);

  useEffect(() => { setPage(1); }, [search, tab, fArea, fPriority, fAssignee, fSla, view]);

  /* El panel abierto tiene que reflejar los cambios que acaban de guardarse. */
  const openTicket = selected ? tickets.find(t => t.id === selected) || null : null;

  /* ── Alcance según la lectura elegida ── */
  const scoped = useMemo(() => {
    if (view === 'mine') {
      return desk
        ? tickets.filter(t => t.assignee_id === user.id)
        : tickets.filter(t => t.user_id === user.id);
    }
    return tickets;
  }, [tickets, view, desk, user]);

  const counts = useMemo(() => ({
    open:     scoped.filter(isOpen).length,
    closed:   scoped.filter(isClosed).length,
    all:      scoped.length,
    unassigned: scoped.filter(t => isOpen(t) && !t.assignee_id).length,
    breached: scoped.filter(t => slaOf(t)?.state === 'breached').length,
    today:    scoped.filter(t => ['breached', 'today'].includes(slaOf(t)?.state)).length,
  }), [scoped]);

  const areas = useMemo(
    () => [...new Set([...SERVICE_LINES, ...scoped.map(t => (t.area || '').trim())].filter(Boolean))].sort(),
    [scoped],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped
      .filter(t => tab === 'all' ? true : tab === 'open' ? isOpen(t) : isClosed(t))
      .filter(t => !q || searchBlob(t).includes(q))
      .filter(t => fArea === 'all' || (t.area || '').trim() === fArea)
      .filter(t => fPriority === 'all' || (t.urgencia || t.priority) === fPriority)
      .filter(t => fAssignee === 'all'
        || (fAssignee === 'none' ? !t.assignee_id : String(t.assignee_id) === fAssignee))
      .filter(t => {
        if (fSla === 'all') return true;
        const s = slaOf(t)?.state;
        if (fSla === 'at_risk') return s === 'today' || s === 'at_risk';
        return s === fSla;
      })
      .sort(byUrgency);
  }, [scoped, search, tab, fArea, fPriority, fAssignee, fSla]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageItems  = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const filtersActive = [fArea, fPriority, fAssignee, fSla].filter(v => v !== 'all').length;
  const clearFilters = () => { setFArea('all'); setFPriority('all'); setFAssignee('all'); setFSla('all'); };

  /* ── Acciones ── */

  const handleCreate = async (fd) => {
    await create(fd);
    setComposing(false);
    showToast('Ticket radicado. Te avisaremos por correo cuando la mesa lo revise.', 'success');
  };

  const handleSaveStatus = async (id, data) => {
    const before = tickets.find(t => t.id === id);
    await updateStatus(id, data);

    /* El proyecto se abre una sola vez, en cuanto hay responsable. */
    if (data.assigneeId && !before?.project_created) {
      try {
        const project = await projectsAPI.create({
          name:        before.title,
          description: before.description || '',
          client:      before.area || '',
          status:      PROJECT_STATUS[data.status] || 'backlog',
          priority:    PROJECT_PRIORITY[before.urgencia || before.priority] || 'mid',
          assigneeId:  data.assigneeId,
          dueDate:     before.due_date || null,
          progress:    0,
          tipo:        data.tipoProyecto || 'automatizacion',
        });
        await markProjectCreated(id);
        onProjectCreated?.(project);
        showToast(`Ticket en ejecución — proyecto «${project.name}» creado`, 'success');
      } catch {
        showToast('Ticket actualizado, pero no se pudo abrir el proyecto', 'error');
      }
    } else {
      showToast(`Ticket actualizado a «${statusOf(data.status).label}»`, 'success');
    }
    setSelected(null);
  };

  const handleSaveInfo = async (id, info) => {
    await updateInfo(id, info);
    showToast('Información añadida al ticket', 'success');
  };

  const handleDelete = async (id) => {
    await remove(id);
    setSelected(null);
    showToast('Ticket eliminado', 'error');
  };

  /* ── Render ── */

  if (loading) {
    return (
      <div className="rb-col" style={{ gap: 10 }}>
        {[...Array(6)].map((_, i) => <div key={i} className="rb-skeleton" style={{ height: 62 }} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rb-card">
        <EmptyState icon="alert" title="No pudimos cargar los tickets"
          action={<Button variant="secondary" icon="refresh" onClick={refresh}>Reintentar</Button>}>
          {error}
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      {/* Indicadores — actúan también como filtro rápido */}
      {desk && view !== 'mine' && (
        <div className="rb-stats">
          <Stat label="Abiertos" value={counts.open} icon="inbox" tone="brand"
            foot="Tickets vivos en la mesa"
            active={tab === 'open' && !filtersActive}
            onClick={() => { setTab('open'); clearFilters(); }} />
          <Stat label="Sin responsable" value={counts.unassigned} icon="user" tone="warning"
            foot="Esperan triage"
            active={fAssignee === 'none'}
            onClick={() => { setTab('open'); setFAssignee(fAssignee === 'none' ? 'all' : 'none'); }} />
          <Stat label="SLA vencido" value={counts.breached} icon="alert" tone="danger"
            foot="Pasaron el compromiso"
            active={fSla === 'breached'}
            onClick={() => { setTab('open'); setFSla(fSla === 'breached' ? 'all' : 'breached'); }} />
          <Stat label="Cerrados" value={counts.closed} icon="check" tone="success"
            foot="Entregados o no procede"
            active={tab === 'closed'}
            onClick={() => { setTab('closed'); clearFilters(); }} />
        </div>
      )}

      {/* Barra de herramientas */}
      <div className="tk-toolbar">
        <SearchInput value={search} onChange={setSearch}
          placeholder="Buscar por título, radicado, solicitante o línea de servicio…" />

        <Segmented value={tab} onChange={setTab} options={[
          { value: 'open',   label: 'Abiertos', count: counts.open },
          { value: 'closed', label: 'Cerrados', count: counts.closed },
          { value: 'all',    label: 'Todos',    count: counts.all },
        ]} />

        <span style={{ flex: 1 }} />

        {desk && (
          <Button variant={showFilters || filtersActive ? 'primary' : 'secondary'} icon="filter"
            onClick={() => setShowFilters(v => !v)}>
            Filtros{filtersActive ? ` (${filtersActive})` : ''}
          </Button>
        )}
        {puedeAbrir && (
          <Button variant="primary" icon="plus" onClick={() => setComposing(true)}>Nuevo ticket</Button>
        )}
      </div>

      {showFilters && desk && (
        <div className="tk-filters">
          <span className="tk-filters-label">Filtrar por</span>
          <select className="rb-select" value={fArea} onChange={e => setFArea(e.target.value)} aria-label="Línea de servicio">
            <option value="all">Toda línea de servicio</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="rb-select" value={fPriority} onChange={e => setFPriority(e.target.value)} aria-label="Prioridad">
            <option value="all">Toda prioridad</option>
            {PRIORITY_LIST.map(p => <option key={p.value} value={p.value}>Prioridad {p.label.toLowerCase()}</option>)}
          </select>
          <select className="rb-select" value={fAssignee} onChange={e => setFAssignee(e.target.value)} aria-label="Responsable">
            <option value="all">Cualquier responsable</option>
            <option value="none">Sin asignar</option>
            {users.filter(u => isDesk(u)).map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
          </select>
          <select className="rb-select" value={fSla} onChange={e => setFSla(e.target.value)} aria-label="Estado del SLA">
            {SLA_FILTERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {!!filtersActive && (
            <Button variant="ghost" size="sm" icon="close" onClick={clearFilters}>Limpiar</Button>
          )}
        </div>
      )}

      {/* Contenido */}
      {view === 'board' ? (
        filtered.length === 0
          ? <div className="rb-card"><EmptyState title="Nada que mostrar">Ajusta los filtros o el estado seleccionado.</EmptyState></div>
          : <TicketBoard tickets={filtered} onOpen={t => setSelected(t.id)} />
      ) : (
        <div className="tk-list">
          {pageItems.length === 0 ? (
            <EmptyState
              icon={search || filtersActive ? 'search' : 'inbox'}
              title={search || filtersActive ? 'Ningún ticket coincide' : desk ? 'Bandeja al día' : 'Aún no has radicado tickets'}
              action={search || filtersActive
                ? <Button variant="secondary" onClick={() => { setSearch(''); clearFilters(); }}>Quitar filtros</Button>
                : puedeAbrir
                  ? <Button variant="primary" icon="plus" onClick={() => setComposing(true)}>Radicar el primero</Button>
                  : null}
            >
              {search || filtersActive
                ? 'Prueba con otro término o amplía los filtros.'
                : desk
                  ? 'No hay tickets abiertos que atender con los criterios actuales.'
                  : 'Cuando necesites apoyo del equipo, radícalo aquí y podrás seguir su avance paso a paso.'}
            </EmptyState>
          ) : (
            <>
              {pageItems.map(t => (
                <TicketRow key={t.id} ticket={t} onOpen={x => setSelected(x.id)} showRequester={desk} />
              ))}
              {totalPages > 1 && (
                <div className="tk-pager">
                  <span>
                    {(safePage - 1) * PER_PAGE + 1}–{Math.min(safePage * PER_PAGE, filtered.length)} de {filtered.length}
                  </span>
                  <span className="rb-row">
                    <Button variant="ghost" size="sm" icon="chevronLeft"
                      disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                    <Button variant="ghost" size="sm" iconRight="chevronRight"
                      disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <TicketDetail
        ticket={openTicket} open={!!openTicket} onClose={() => setSelected(null)}
        user={user} users={users}
        onSaveStatus={handleSaveStatus} onSaveInfo={handleSaveInfo} onDelete={handleDelete}
      />

      <NewTicketForm
        open={composing} onClose={() => setComposing(false)} onSubmit={handleCreate}
        defaultName={user?.name || ''} defaultEmail={user?.email || ''}
      />
    </>
  );
}
