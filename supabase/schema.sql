-- ============================================================
-- OBRA MANAGER - Schema completo para Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================


-- ============================================================
-- 1. PROFILES (extiende auth.users con datos extra del usuario)
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'supervisor' CHECK (role IN ('owner', 'architect', 'supervisor')),
  phone       TEXT,
  address     TEXT,
  bio         TEXT,
  birth_date  TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: crea un perfil automáticamente cuando un usuario se registra
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- 2. PROJECTS
-- ============================================================
CREATE TABLE projects (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name               TEXT NOT NULL,
  address            TEXT NOT NULL DEFAULT '',
  client             TEXT NOT NULL DEFAULT '',
  start_date         TEXT NOT NULL,
  end_date           TEXT,
  status             TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'paused', 'completed')),
  budget_estimated   NUMERIC NOT NULL DEFAULT 0,
  budget_real        NUMERIC NOT NULL DEFAULT 0,
  invite_code        TEXT UNIQUE,
  created_by         UUID REFERENCES profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 3. PROJECT MEMBERS
-- ============================================================
CREATE TABLE project_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'supervisor' CHECK (role IN ('owner', 'architect', 'supervisor')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);


-- ============================================================
-- 4. JOIN REQUESTS
-- ============================================================
CREATE TABLE join_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  assigned_role TEXT CHECK (assigned_role IN ('owner', 'architect', 'supervisor')),
  reviewed_at   TIMESTAMPTZ
);


-- ============================================================
-- 5. DAILY BUDGET (disponible en caja por día)
-- ============================================================
CREATE TABLE daily_budget (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  amount      NUMERIC NOT NULL DEFAULT 0,
  note        TEXT,
  UNIQUE(project_id, date)
);


-- ============================================================
-- 6. STAGES (etapas de la obra)
-- ============================================================
CREATE TABLE stages (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  code            TEXT NOT NULL,
  "order"         INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  assigned_to     TEXT,
  start_date      TEXT,
  end_date        TEXT,
  week_start      INTEGER,
  week_end        INTEGER,
  estimated_days  INTEGER,
  estimated_cost  NUMERIC,
  materials_count INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 7. TASKS (tareas por etapa)
-- ============================================================
CREATE TABLE tasks (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  stage_id         TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  category         TEXT NOT NULL DEFAULT '',
  title            TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  responsible_role TEXT NOT NULL DEFAULT 'supervisor' CHECK (responsible_role IN ('owner', 'architect', 'supervisor')),
  responsible_id   TEXT,
  week_start       INTEGER,
  week_end         INTEGER,
  start_date       TEXT,
  end_date         TEXT,
  observations     TEXT,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 8. PHOTOS (fotos por tarea)
-- ============================================================
CREATE TABLE photos (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  stage_id     TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  caption      TEXT,
  uploaded_by  TEXT NOT NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 9. SUPPLY ITEMS (insumos / materiales)
-- ============================================================
CREATE TABLE supply_items (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  stage_id                 TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  task_id                  TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  name                     TEXT NOT NULL,
  unit                     TEXT NOT NULL DEFAULT '',
  planned_qty              NUMERIC NOT NULL DEFAULT 0,
  real_qty                 NUMERIC NOT NULL DEFAULT 0,
  current_stock            NUMERIC,
  weekly_consumption       NUMERIC,
  delivery_days            INTEGER,
  provider_id              TEXT,
  estimated_unit_cost      NUMERIC,
  real_unit_cost           NUMERIC,
  auto_discount_on_complete BOOLEAN DEFAULT FALSE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 10. AUDIT ALERTS (alertas de desvío de stock)
-- ============================================================
CREATE TABLE audit_alerts (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  supply_item_id  TEXT NOT NULL REFERENCES supply_items(id) ON DELETE CASCADE,
  supply_name     TEXT NOT NULL,
  task_id         TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  stage_id        TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  planned_qty     NUMERIC NOT NULL,
  real_qty        NUMERIC NOT NULL,
  deviation_pct   NUMERIC NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved'))
);


-- ============================================================
-- 11. PURCHASE SCHEDULE (programación de compras / logística)
-- ============================================================
CREATE TABLE purchase_schedule (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  stage_id        TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  task_id         TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  material        TEXT NOT NULL,
  unit            TEXT NOT NULL DEFAULT '',
  quantity        NUMERIC NOT NULL DEFAULT 0,
  delivery_week   INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'delivered', 'critical')),
  supplier_id     TEXT,
  estimated_cost  NUMERIC NOT NULL DEFAULT 0,
  real_cost       NUMERIC,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 12. PURCHASE REQUESTS (solicitudes de aprobación)
-- ============================================================
CREATE TABLE purchase_requests (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  amount          NUMERIC NOT NULL,
  requested_by    TEXT NOT NULL,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected')),
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  rejection_note  TEXT
);


-- ============================================================
-- 13. BUDGET MOVEMENTS (movimientos de presupuesto)
-- ============================================================
CREATE TABLE budget_movements (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description          TEXT NOT NULL,
  amount               NUMERIC NOT NULL,
  date                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purchase_request_id  TEXT REFERENCES purchase_requests(id) ON DELETE SET NULL
);


-- ============================================================
-- 14. CALENDAR EVENTS
-- ============================================================
CREATE TABLE calendar_events (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date                 TEXT NOT NULL,
  title                TEXT NOT NULL,
  type                 TEXT NOT NULL CHECK (type IN ('buy', 'need', 'note', 'delivery')),
  material             TEXT,
  amount               NUMERIC,
  purchase_request_id  TEXT REFERENCES purchase_requests(id) ON DELETE SET NULL,
  purchase_id          TEXT REFERENCES purchase_schedule(id) ON DELETE SET NULL,
  supply_id            TEXT REFERENCES supply_items(id) ON DELETE SET NULL,
  delivery_days        INTEGER,
  created_by           TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Solo podés ver/editar datos de proyectos donde sos miembro
-- ============================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_budget      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_alerts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events   ENABLE ROW LEVEL SECURITY;

-- Función helper: devuelve los project_ids donde el usuario logueado es miembro
CREATE OR REPLACE FUNCTION my_project_ids()
RETURNS TABLE(project_id TEXT) AS $$
  SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- profiles: cada usuario ve y edita solo su propio perfil
CREATE POLICY "profiles: ver propio" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles: editar propio" ON profiles FOR UPDATE USING (id = auth.uid());

-- projects: miembros del proyecto
CREATE POLICY "projects: ver si soy miembro" ON projects FOR SELECT
  USING (id IN (SELECT project_id FROM my_project_ids()));
CREATE POLICY "projects: crear" ON projects FOR INSERT
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "projects: editar si soy miembro" ON projects FOR UPDATE
  USING (id IN (SELECT project_id FROM my_project_ids()));

-- project_members
CREATE POLICY "members: ver de mis proyectos" ON project_members FOR SELECT
  USING (project_id IN (SELECT project_id FROM my_project_ids()));
CREATE POLICY "members: insertar en mis proyectos" ON project_members FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM my_project_ids()));
CREATE POLICY "members: editar en mis proyectos" ON project_members FOR UPDATE
  USING (project_id IN (SELECT project_id FROM my_project_ids()));
CREATE POLICY "members: eliminar en mis proyectos" ON project_members FOR DELETE
  USING (project_id IN (SELECT project_id FROM my_project_ids()));

-- join_requests
CREATE POLICY "join_requests: ver de mis proyectos" ON join_requests FOR SELECT
  USING (project_id IN (SELECT project_id FROM my_project_ids()));
CREATE POLICY "join_requests: insertar" ON join_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "join_requests: editar en mis proyectos" ON join_requests FOR UPDATE
  USING (project_id IN (SELECT project_id FROM my_project_ids()));

-- daily_budget
CREATE POLICY "daily_budget: mis proyectos" ON daily_budget FOR ALL
  USING (project_id IN (SELECT project_id FROM my_project_ids()));

-- stages
CREATE POLICY "stages: mis proyectos" ON stages FOR ALL
  USING (project_id IN (SELECT project_id FROM my_project_ids()));

-- tasks (a través de stage)
CREATE POLICY "tasks: mis proyectos" ON tasks FOR ALL
  USING (stage_id IN (SELECT id FROM stages WHERE project_id IN (SELECT project_id FROM my_project_ids())));

-- photos
CREATE POLICY "photos: mis proyectos" ON photos FOR ALL
  USING (stage_id IN (SELECT id FROM stages WHERE project_id IN (SELECT project_id FROM my_project_ids())));

-- supply_items
CREATE POLICY "supply_items: mis proyectos" ON supply_items FOR ALL
  USING (stage_id IN (SELECT id FROM stages WHERE project_id IN (SELECT project_id FROM my_project_ids())));

-- audit_alerts
CREATE POLICY "audit_alerts: mis proyectos" ON audit_alerts FOR ALL
  USING (stage_id IN (SELECT id FROM stages WHERE project_id IN (SELECT project_id FROM my_project_ids())));

-- purchase_schedule
CREATE POLICY "purchase_schedule: mis proyectos" ON purchase_schedule FOR ALL
  USING (stage_id IN (SELECT id FROM stages WHERE project_id IN (SELECT project_id FROM my_project_ids())));

-- purchase_requests
CREATE POLICY "purchase_requests: mis proyectos" ON purchase_requests FOR ALL
  USING (project_id IN (SELECT project_id FROM my_project_ids()));

-- budget_movements
CREATE POLICY "budget_movements: mis proyectos" ON budget_movements FOR ALL
  USING (project_id IN (SELECT project_id FROM my_project_ids()));

-- calendar_events
CREATE POLICY "calendar_events: mis proyectos" ON calendar_events FOR ALL
  USING (project_id IN (SELECT project_id FROM my_project_ids()));
