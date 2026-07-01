# AutoTrack — Gestión de Proyectos

Sistema full-stack de seguimiento de proyectos para equipos de automatización.

## Stack

- **Backend**: Node.js + Express + PostgreSQL
- **Frontend**: React + Vite
- **Auth**: JWT

---

## Estructura del proyecto

```
SEGUIMIENTO_PROYECTOS/
├── autotrack-backend/    ← API REST (Node.js + Express)
└── autotrack-frontend/   ← SPA React
```

---

## Requisitos previos

- Node.js 18+
- PostgreSQL 14+
- npm

---

## 1. Configurar la base de datos

```sql
-- En psql o pgAdmin, crear la base de datos:
CREATE DATABASE autotrack;

-- Luego ejecutar el schema:
-- psql -d autotrack -f autotrack-backend/db/schema.sql
```

---

## 2. Configurar el Backend

```bash
cd autotrack-backend

# Instalar dependencias
npm install

# Crear archivo de entorno
cp .env.example .env

# Editar .env con tus datos:
#   DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/autotrack
#   JWT_SECRET=un_secreto_largo_y_seguro

# Ejecutar en modo desarrollo
npm run dev
```

El API correrá en: **http://localhost:3001**

---

## 3. Configurar el Frontend

```bash
cd autotrack-frontend

# Instalar dependencias
npm install

# (Opcional) Crear .env.local si el backend no está en localhost:3001
# VITE_API_URL=http://localhost:3001/api

# Ejecutar en modo desarrollo
npm run dev
```

La app correrá en: **http://localhost:5173**

---

## Funcionalidades

- **Login / Registro** — cada ingeniero tiene su cuenta
- **Dashboard ejecutivo** — KPIs, gráficos por estado y prioridad, carga por ingeniero
- **Mi Kanban** — tablero personal con 5 columnas (Por hacer → Finalizado)
- **Kanban del equipo** — vista de proyectos agrupados por ingeniero
- **Diagrama de Gantt** — línea de tiempo interactiva con barra "Hoy"
- **Gestión de proyectos** — crear, editar, eliminar con asignación y fechas
- **Seguimiento semanal** — logs de avance con actualización de progreso

---

## Endpoints del API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/auth/register | Registro de usuario |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Usuario actual |
| GET | /api/users | Lista de ingenieros |
| GET | /api/projects | Todos los proyectos |
| POST | /api/projects | Crear proyecto |
| PUT | /api/projects/:id | Actualizar proyecto |
| DELETE | /api/projects/:id | Eliminar proyecto |
| POST | /api/projects/:id/logs | Registrar avance |
