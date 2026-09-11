/* Formulario de radicación de un ticket, pensado para el auditor.

   Va por pasos a propósito: la versión anterior era un formulario largo de una
   sola pantalla con nueve campos obligatorios, y eso se traduce en solicitudes
   a medias. Aquí cada paso pide una sola cosa, valida al avanzar, y el último
   muestra el resumen antes de enviar. */

import { useEffect, useMemo, useState } from 'react';
import {
  CATEGORIES, SERVICE_LINES, PRIORITY_LIST, priorityOf, fmtDate,
} from '../../lib/tickets';
import { Alert, Button, ChoiceGroup, Field, Icon, Modal } from '../ui';

const DESC_MAX = 1200;
const MAX_FILE_MB = 10;

const FREQUENCY = [
  { value: 'unica',       label: 'Una sola vez' },
  { value: 'por_encargo', label: 'En cada encargo' },
  { value: 'mensual',     label: 'Mensual' },
  { value: 'trimestral',  label: 'Trimestral' },
  { value: 'semestral',   label: 'Semestral' },
  { value: 'anual',       label: 'Anual / cierre' },
  { value: 'semanal',     label: 'Semanal' },
  { value: 'diario',      label: 'Diario' },
];

const IMPACT = [
  { value: 'Alto',  label: 'Alto — bloquea un cierre o una entrega al cliente' },
  { value: 'Medio', label: 'Medio — evita reprocesos y errores recurrentes' },
  { value: 'Bajo',  label: 'Bajo — mejora trazabilidad o presentación' },
  { value: 'otro',  label: 'Otro…' },
];

const STEPS = [
  { n: 1, label: 'Necesidad' },
  { n: 2, label: 'Contexto' },
  { n: 3, label: 'Prioridad y envío' },
];

const EMPTY = {
  category: '', title: '', description: '',
  areaSel: '', areaOtra: '',
  frecuencia: '', herramientas: '', dueDate: '',
  urgencia: 'media', impacto: '', impactoOtro: '',
  nombre: '', correos: '', file: null,
};

/* Validación por paso — devuelve el mensaje del primer problema, o null. */
function validate(step, f) {
  const area = f.areaSel === 'otra' ? f.areaOtra.trim() : f.areaSel;
  if (step === 1) {
    if (!f.category)             return 'Elige el tipo de solicitud.';
    if (f.title.trim().length < 5) return 'Dale un título claro al ticket (mínimo 5 caracteres).';
    if (f.description.trim().length < 20)
      return 'Describe la necesidad con un poco más de detalle — el equipo necesita entender el caso sin llamarte.';
  }
  if (step === 2) {
    if (!area)          return 'Indica la línea de servicio desde la que solicitas.';
    if (!f.frecuencia)  return 'Indica cada cuánto necesitas este trabajo.';
  }
  if (step === 3) {
    if (!f.impacto)     return 'Selecciona el impacto esperado.';
    if (f.impacto === 'otro' && !f.impactoOtro.trim()) return 'Describe el impacto esperado.';
    if (!f.nombre.trim()) return 'Falta tu nombre.';
    const mails = f.correos.split(',').map(c => c.trim()).filter(Boolean);
    if (!mails.length || mails.some(m => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)))
      return 'Ingresa al menos un correo de contacto válido.';
  }
  return null;
}

export default function NewTicketForm({ open, onClose, onSubmit, defaultName = '', defaultEmail = '' }) {
  const [step,   setStep]   = useState(1);
  const [form,   setForm]   = useState(EMPTY);
  const [error,  setError]  = useState('');
  const [saving, setSaving] = useState(false);
  const [drag,   setDrag]   = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setForm({ ...EMPTY, nombre: defaultName, correos: defaultEmail });
    setError(''); setSaving(false); setDrag(false);
  }, [open, defaultName, defaultEmail]);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

  const area    = form.areaSel === 'otra' ? form.areaOtra.trim() : form.areaSel;
  const impacto = form.impacto === 'otro' ? form.impactoOtro.trim() : form.impacto;
  const category = useMemo(() => CATEGORIES.find(c => c.value === form.category), [form.category]);

  const takeFile = (f) => {
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) { setError(`El archivo supera los ${MAX_FILE_MB} MB.`); return; }
    set('file', f);
  };

  const next = () => {
    const msg = validate(step, form);
    if (msg) return setError(msg);
    setError('');
    setStep(s => Math.min(3, s + 1));
  };

  const back = () => { setError(''); setStep(s => Math.max(1, s - 1)); };

  const submit = async () => {
    for (const s of [1, 2, 3]) {
      const msg = validate(s, form);
      if (msg) { setStep(s); return setError(msg); }
    }
    setSaving(true); setError('');
    try {
      const fd = new FormData();
      fd.append('title',             form.title.trim());
      fd.append('description',       form.description.trim());
      fd.append('type',              form.category);
      fd.append('area',              area);
      fd.append('priority',          form.urgencia);
      fd.append('urgencia',          form.urgencia);
      fd.append('frecuencia',        form.frecuencia);
      fd.append('herramientas',      form.herramientas.trim());
      fd.append('impacto',           impacto);
      fd.append('nombreSolicitante', form.nombre.trim());
      fd.append('correoSolicitante', form.correos.split(',').map(c => c.trim()).filter(Boolean).join(', '));
      if (form.dueDate) fd.append('dueDate', form.dueDate);
      if (form.file)    fd.append('file', form.file);
      await onSubmit(fd);
    } catch (err) {
      setError(err?.error || 'No se pudo enviar el ticket. Intenta de nuevo.');
      setSaving(false);
    }
  };

  const sla = priorityOf(form.urgencia);

  return (
    <Modal
      open={open} onClose={onClose} width={780}
      title="Nuevo ticket"
      subtitle="Cuéntanos qué necesitas. Tres pasos cortos, menos de dos minutos."
      footer={
        <>
          {step > 1 && <Button variant="ghost" icon="chevronLeft" onClick={back} disabled={saving}>Atrás</Button>}
          <span style={{ flex: 1 }} />
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          {step < 3
            ? <Button variant="primary" iconRight="arrowRight" onClick={next}>Continuar</Button>
            : <Button variant="primary" icon="send" onClick={submit} loading={saving}>
                {saving ? 'Enviando…' : 'Enviar ticket'}
              </Button>}
        </>
      }
    >
      {/* Indicador de progreso */}
      <div className="tk-steps-bar" style={{ marginBottom: 20 }}>
        {STEPS.map((s, i) => (
          <div key={s.n} style={{ display: 'contents' }}>
            {i > 0 && <span className="tk-sb-line" data-on={step > s.n - 1} />}
            <div className="tk-sb" data-state={step === s.n ? 'current' : step > s.n ? 'done' : 'pending'}>
              <i>{step > s.n ? <Icon name="check" size={11} stroke={3.5} /> : s.n}</i>
              <span>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {error && <div style={{ marginBottom: 16 }}><Alert tone="danger">{error}</Alert></div>}

      {/* ── Paso 1 · Necesidad ── */}
      {step === 1 && (
        <div className="tk-form">
          <div>
            <Field label="¿Qué tipo de apoyo necesitas?" required />
            <div className="tk-cats" style={{ marginTop: 8 }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.value} type="button" className="tk-cat"
                  aria-pressed={form.category === c.value}
                  onClick={() => set('category', c.value)}
                >
                  <div className="tk-cat-l">{c.label}</div>
                  <div className="tk-cat-d">{c.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <Field label="Título del ticket" required
            hint="Una línea que lo identifique en la bandeja. Ej: «Conciliación bancaria Bancolombia — cliente Alfa»">
            <input className="rb-input" value={form.title} maxLength={140} autoFocus
              placeholder="Resume la necesidad en una frase"
              onChange={e => set('title', e.target.value)} />
          </Field>

          <Field label="Descripción" required
            hint={`Qué haces hoy, dónde se traba y qué esperarías recibir. ${form.description.length}/${DESC_MAX}`}>
            <textarea className="rb-textarea" rows={6} maxLength={DESC_MAX}
              placeholder="Ejemplo: cada mes descargo el auxiliar de bancos del ERP y lo cruzo a mano contra el extracto. Son ~4 horas por cliente y se nos escapan partidas conciliatorias…"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </Field>
        </div>
      )}

      {/* ── Paso 2 · Contexto ── */}
      {step === 2 && (
        <div className="tk-form">
          <div className="tk-form-grid">
            <Field label="Línea de servicio" required>
              <select className="rb-select" value={form.areaSel} onChange={e => set('areaSel', e.target.value)}>
                <option value="">Selecciona…</option>
                {SERVICE_LINES.map(a => <option key={a} value={a}>{a}</option>)}
                <option value="otra">Otra…</option>
              </select>
              {form.areaSel === 'otra' && (
                <input className="rb-input" style={{ marginTop: 8 }} autoFocus
                  placeholder="Escribe el nombre del área"
                  value={form.areaOtra} onChange={e => set('areaOtra', e.target.value)} />
              )}
            </Field>

            <Field label="¿Cada cuánto lo necesitas?" required>
              <select className="rb-select" value={form.frecuencia} onChange={e => set('frecuencia', e.target.value)}>
                <option value="">Selecciona…</option>
                {FREQUENCY.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Fuentes y herramientas que usas hoy" optional
            hint="ERP, bancos, formatos. Ej: Siigo, extracto Bancolombia PDF, plantilla Excel de cédulas.">
            <input className="rb-input" value={form.herramientas}
              placeholder="Siigo, World Office, extractos PDF, Excel…"
              onChange={e => set('herramientas', e.target.value)} />
          </Field>

          <Field label="Fecha en que lo necesitas" optional
            hint="Si depende de un cierre o una entrega al cliente, indícalo aquí.">
            <input className="rb-input" type="date" value={form.dueDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => set('dueDate', e.target.value)} />
          </Field>

          <Field label="Archivos de apoyo" optional
            hint={`Formatos, muestras o pantallazos. PDF, Excel, Word o imagen, hasta ${MAX_FILE_MB} MB.`}>
            <label
              className={`rb-drop${drag ? ' rb-drop--over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); takeFile(e.dataTransfer.files?.[0]); }}
            >
              <input type="file" hidden accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg"
                onChange={e => takeFile(e.target.files?.[0])} />
              {form.file ? (
                <>
                  <Icon name="file" size={18} />
                  <span style={{ fontWeight: 650, color: 'var(--rb-text)', flex: 1, minWidth: 0 }} className="rb-truncate">
                    {form.file.name}
                  </span>
                  <button type="button" className="rb-btn rb-btn--ghost rb-btn--sm"
                    onClick={e => { e.preventDefault(); set('file', null); }}>Quitar</button>
                </>
              ) : (
                <>
                  <Icon name="upload" size={18} />
                  <div>
                    <div style={{ fontWeight: 650, color: 'var(--rb-text)' }}>Arrastra un archivo o haz clic para elegirlo</div>
                    <div className="rb-hint">PDF, Excel, Word o imagen · máx. {MAX_FILE_MB} MB</div>
                  </div>
                </>
              )}
            </label>
          </Field>
        </div>
      )}

      {/* ── Paso 3 · Prioridad, contacto y resumen ── */}
      {step === 3 && (
        <div className="tk-form">
          <Field label="Prioridad" required hint={`${sla.hint} Compromiso de primera respuesta: ${sla.slaDays} día${sla.slaDays > 1 ? 's' : ''} hábil${sla.slaDays > 1 ? 'es' : ''}.`}>
            <ChoiceGroup name="Prioridad" value={form.urgencia} onChange={v => set('urgencia', v)}
              options={PRIORITY_LIST.map(p => ({ value: p.value, label: p.label, tone: p.tone, hint: p.hint }))} />
          </Field>

          <Field label="Impacto esperado" required>
            <select className="rb-select" value={form.impacto} onChange={e => set('impacto', e.target.value)}>
              <option value="">Selecciona…</option>
              {IMPACT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {form.impacto === 'otro' && (
              <input className="rb-input" style={{ marginTop: 8 }} autoFocus
                placeholder="Describe el impacto esperado"
                value={form.impactoOtro} onChange={e => set('impactoOtro', e.target.value)} />
            )}
          </Field>

          <div className="tk-form-grid">
            <Field label="Tu nombre" required>
              <input className="rb-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
            </Field>
            <Field label="Correos de contacto" required
              hint="Separa varios con coma — todos reciben las respuestas y la invitación a la reunión.">
              <input className="rb-input" value={form.correos} onChange={e => set('correos', e.target.value)} />
            </Field>
          </div>

          <div>
            <div className="tk-section-title">Resumen antes de enviar</div>
            <div className="tk-review">
              <div className="tk-review-row"><b>Tipo</b><span>{category?.label || '—'}</span></div>
              <div className="tk-review-row"><b>Título</b><span>{form.title || '—'}</span></div>
              <div className="tk-review-row"><b>Línea de servicio</b><span>{area || '—'}</span></div>
              <div className="tk-review-row"><b>Frecuencia</b><span>{FREQUENCY.find(f => f.value === form.frecuencia)?.label || '—'}</span></div>
              <div className="tk-review-row"><b>Prioridad</b><span>{sla.label}</span></div>
              {form.dueDate && <div className="tk-review-row"><b>Fecha requerida</b><span>{fmtDate(form.dueDate)}</span></div>}
              {form.herramientas && <div className="tk-review-row"><b>Fuentes</b><span>{form.herramientas}</span></div>}
              {form.file && <div className="tk-review-row"><b>Adjunto</b><span>{form.file.name}</span></div>}
              <div className="tk-review-row"><b>Descripción</b><span>{form.description}</span></div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
