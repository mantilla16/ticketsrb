/**
 * Ruta a un archivo de `public/`, respetando la base del despliegue.
 *
 * Vite reescribe con la base las referencias que encuentra en `index.html`,
 * pero no las cadenas escritas dentro del JSX: un `src="/logo.svg"` se queda
 * apuntando a la raíz del dominio. Cuando la aplicación vive bajo una ruta
 * —https://host/mesa— esa petición se va fuera y la sirve otra cosa.
 *
 * `import.meta.env.BASE_URL` es la base real con la que se compiló y siempre
 * termina en «/», así que basta con quitar la barra inicial del nombre.
 */
export const asset = (nombre) =>
  `${import.meta.env.BASE_URL}${String(nombre).replace(/^\/+/, '')}`;
