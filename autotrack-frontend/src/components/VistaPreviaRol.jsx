/**
 * Ver la aplicación como otro rol, sin cambiar de cuenta.
 *
 * Sirve para comprobar qué encuentra cada persona al entrar —qué menú, qué
 * pantalla de inicio, qué datos— sin tener que crearle una cuenta de Microsoft
 * ni degradarse uno mismo y perder el acceso mientras tanto.
 *
 * IMPORTANTE, y por eso el aviso es permanente y no se puede ocultar: esto
 * cambia SOLO la interfaz. El token de sesión sigue siendo el real, así que el
 * servidor sigue aplicando los permisos de quien mira. No es una suplantación
 * ni una forma de probar que un rol esté bien restringido: para eso está la
 * comprobación del lado del servidor.
 */

import { ROLE, roleOf } from '../lib/tickets';
import { Icon } from './ui';

/* Se ofrecen todos salvo el propio administrador: previsualizarse a uno mismo
   no aporta nada. */
const ROLES_PREVISUALIZABLES = Object.entries(ROLE)
  .filter(([valor]) => valor !== 'admin')
  .map(([valor, r]) => ({ valor, label: r.label }));

/** Selector para la barra superior. Solo lo monta App si el rol lo permite. */
export function SelectorVistaPrevia({ valor, onChange }) {
  return (
    <label className="vp-selector" title="Ver la aplicación como otro rol">
      <Icon name="target" size={14} />
      <select
        className="rb-select"
        value={valor || ''}
        onChange={e => onChange(e.target.value || null)}
        aria-label="Ver como"
      >
        <option value="">Ver como…</option>
        {ROLES_PREVISUALIZABLES.map(r => (
          <option key={r.valor} value={r.valor}>{r.label}</option>
        ))}
      </select>
    </label>
  );
}

/** Franja permanente mientras la vista previa está activa. */
export function AvisoVistaPrevia({ rol, onSalir }) {
  if (!rol) return null;
  return (
    <div className="vp-aviso" role="status">
      <Icon name="alert" size={15} />
      <span>
        Estás viendo la aplicación como <strong>{roleOf(rol).label}</strong>.
        Solo cambia lo que se muestra: tus permisos reales siguen intactos.
      </span>
      <button className="vp-salir" onClick={onSalir}>Salir de la vista previa</button>
    </div>
  );
}
