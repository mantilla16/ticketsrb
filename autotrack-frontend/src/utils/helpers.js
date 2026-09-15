export const ST = {
  backlog:  { l: 'Por hacer',  dot: 'var(--c-backlog)',  cls: 'status-backlog' },
  progress: { l: 'En proceso', dot: 'var(--c-progress)', cls: 'status-progress' },
  standby:  { l: 'En standby', dot: 'var(--c-standby)',  cls: 'status-standby' },
  testing:  { l: 'En testing', dot: 'var(--c-testing)',  cls: 'status-testing' },
  done:     { l: 'Finalizado', dot: 'var(--c-done)',     cls: 'status-done' },
};

export const PR = {
  high: { l: 'Alta',  dot: 'p-high', txt: 'pr-high' },
  mid:  { l: 'Media', dot: 'p-mid',  txt: 'pr-mid' },
  low:  { l: 'Baja',  dot: 'p-low',  txt: 'pr-low' },
};

export const PORD = { high: 0, mid: 1, low: 2 };

export function fmtDate(d) {
  if (!d) return '—';
  const iso = d.includes('T') ? d.slice(0, 10) : d;
  const [y, m, day] = iso.split('-');
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

export function dateStatus(due) {
  if (!due) return '';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((new Date(due) - now) / 86400000);
  return diff < 0 ? 'overdue' : diff <= 5 ? 'soon' : '';
}

export function sortByPriority(a, b) {
  return (PORD[a.priority] ?? 1) - (PORD[b.priority] ?? 1);
}

export function colorClass(colorIndex) {
  return `eng-c-${colorIndex ?? 0}`;
}

export function fmtLogDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}
