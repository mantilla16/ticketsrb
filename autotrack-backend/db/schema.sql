-- AutoTrack Database Schema

CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  password     VARCHAR(255) NOT NULL,
  initials     VARCHAR(5) NOT NULL,
  color_index  INTEGER DEFAULT 0,
  role         VARCHAR(20) DEFAULT 'engineer',
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id           VARCHAR(50) PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  client       VARCHAR(100),
  status       VARCHAR(20) DEFAULT 'backlog'
               CHECK (status IN ('backlog','progress','standby','testing','done')),
  priority     VARCHAR(10) DEFAULT 'mid'
               CHECK (priority IN ('high','mid','low')),
  assignee_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  start_date   DATE,
  due_date     DATE,
  progress     INTEGER DEFAULT 0
               CHECK (progress >= 0 AND progress <= 100),
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_logs (
  id           SERIAL PRIMARY KEY,
  project_id   VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
  author_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  text         TEXT NOT NULL,
  progress     INTEGER,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- Index for faster project queries
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_assignee ON projects(assignee_id);
CREATE INDEX IF NOT EXISTS idx_logs_project ON project_logs(project_id);
