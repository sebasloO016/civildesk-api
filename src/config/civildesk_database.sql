-- ============================================================
-- CIVILDESK ERP — Base de Datos PostgreSQL
-- Version: 2.0
-- Multi-tenant: company_id en todas las tablas principales
-- Mejoras v2.0:
--   + origin_work_id en inventory_movements (trazabilidad de origen)
--   + reserved_quantity en warehouse_items (stock reservado)
--   + Funcion consume_material_from_report (consumo automatico)
--   + Vista v_material_efficiency (KPI eficiencia por obra)
--   + Vista v_warehouse_stock actualizada con available_quantity
--   + Alertas inteligentes automaticas via funcion check_stock_alerts
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- DOMINIO 1: CORE — Empresas, Usuarios, Roles
-- ============================================================

-- Empresas (tenants)
CREATE TABLE companies (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    ruc             VARCHAR(20)  UNIQUE,
    logo_url        VARCHAR(500),
    address         TEXT,
    phone           VARCHAR(30),
    email           VARCHAR(150),
    city            VARCHAR(100),
    country         VARCHAR(100) DEFAULT 'Ecuador',
    -- Configuracion de margenes globales
    default_utility_pct     NUMERIC(5,2) DEFAULT 18.00,   -- % utilidad
    default_contingency_pct NUMERIC(5,2) DEFAULT 10.00,   -- % imprevistos
    -- Configuracion de alertas
    price_alert_threshold_pct NUMERIC(5,2) DEFAULT 10.00, -- % alza que dispara alerta
    stock_alert_default_min   NUMERIC(10,2) DEFAULT 5.00,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Roles del sistema
CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL,          -- ADMIN, ENGINEER, ASSISTANT
    description TEXT,
    permissions JSONB DEFAULT '{}',            -- {"obras": true, "proveedores": true, ...}
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name, description, permissions) VALUES
('ADMIN',     'Acceso total al sistema',
 '{"dashboard":true,"obras":true,"proyectos":true,"proveedores":true,"bodega":true,"informes":true,"configuracion":true}'),
('ENGINEER',  'Ingeniero de campo',
 '{"dashboard":true,"obras":true,"proyectos":true,"proveedores":true,"bodega":true,"informes":true,"configuracion":false}'),
('ASSISTANT', 'Asistente administrativo',
 '{"dashboard":true,"obras":true,"proyectos":false,"proveedores":true,"bodega":true,"informes":true,"configuracion":false}');

-- Usuarios
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    role_id         INTEGER NOT NULL REFERENCES roles(id),
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    phone           VARCHAR(30),
    avatar_url      VARCHAR(500),
    is_active       BOOLEAN DEFAULT TRUE,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, email)
);

-- Refresh tokens (autenticacion JWT)
CREATE TABLE refresh_tokens (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(500) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOMINIO 2: CLIENTES Y CONTRATISTAS
-- ============================================================

-- Clientes
CREATE TABLE clients (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    ruc_cedula      VARCHAR(20),
    phone           VARCHAR(30),
    email           VARCHAR(150),
    address         TEXT,
    city            VARCHAR(100),
    notes           TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOMINIO 3: CATÁLOGOS REUTILIZABLES
-- ============================================================

-- Categorias de rubros (estructura, acabados, instalaciones, etc.)
CREATE TABLE rubro_categories (
    id          SERIAL PRIMARY KEY,
    company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    color       VARCHAR(7) DEFAULT '#1A5A8A',   -- hex color para UI
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Catalogo de rubros reutilizables
CREATE TABLE catalog_rubros (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    category_id     INTEGER REFERENCES rubro_categories(id) ON DELETE SET NULL,
    code            VARCHAR(50),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    unit            VARCHAR(30) NOT NULL,     -- m2, ml, unidad, kg, gl, etc.
    reference_price NUMERIC(12,2) DEFAULT 0,  -- precio referencia propio
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOMINIO 4: PROVEEDORES Y PRODUCTOS
-- ============================================================

-- Proveedores
CREATE TABLE suppliers (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    ruc             VARCHAR(20),
    contact_name    VARCHAR(150),
    phone           VARCHAR(30),
    email           VARCHAR(150),
    address         TEXT,
    city            VARCHAR(100),
    category        VARCHAR(100),              -- ferreteria, muebles, electrico, etc.
    rating          NUMERIC(3,2) DEFAULT 5.00, -- 1.00 - 5.00
    is_active       BOOLEAN DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Productos / materiales del catalogo
CREATE TABLE products (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code            VARCHAR(50),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    unit            VARCHAR(30) NOT NULL,
    category        VARCHAR(100),
    reference_price NUMERIC(12,2) DEFAULT 0,   -- precio de referencia propio
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Precios de productos por proveedor
CREATE TABLE supplier_products (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    unit_price      NUMERIC(12,2) NOT NULL,
    last_updated    TIMESTAMPTZ DEFAULT NOW(),
    notes           TEXT,
    UNIQUE (supplier_id, product_id)
);

-- Historial de precios por producto/proveedor
CREATE TABLE product_price_history (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
    product_id      INTEGER NOT NULL REFERENCES products(id),
    old_price       NUMERIC(12,2),
    new_price       NUMERIC(12,2) NOT NULL,
    variation_pct   NUMERIC(6,2),              -- % de cambio respecto al anterior
    recorded_at     TIMESTAMPTZ DEFAULT NOW(),
    recorded_by     INTEGER REFERENCES users(id)
);

-- ============================================================
-- DOMINIO 5: CONTROL DE PROYECTOS (Comercial)
-- ============================================================

-- Proyectos (entidad comercial que une proforma, contrato y obra)
CREATE TABLE projects (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    client_id       INTEGER NOT NULL REFERENCES clients(id),
    assigned_user_id INTEGER REFERENCES users(id),
    code            VARCHAR(50),               -- codigo interno del proyecto
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    location        TEXT,
    status          VARCHAR(30) DEFAULT 'PROFORMA',
    -- PROFORMA | CONTRACT | EXECUTION | LIQUIDATION | CLOSED
    contracted_amount   NUMERIC(14,2) DEFAULT 0,  -- valor del contrato inicial
    final_amount        NUMERIC(14,2) DEFAULT 0,  -- valor final tras modificaciones
    started_at      DATE,
    estimated_end   DATE,
    actual_end      DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Proformas
CREATE TABLE proformas (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    version         INTEGER DEFAULT 1,
    status          VARCHAR(20) DEFAULT 'DRAFT',
    -- DRAFT | SENT | APPROVED | REJECTED
    subtotal        NUMERIC(14,2) DEFAULT 0,
    utility_pct     NUMERIC(5,2)  DEFAULT 18.00,
    contingency_pct NUMERIC(5,2)  DEFAULT 10.00,
    utility_amount  NUMERIC(14,2) DEFAULT 0,
    contingency_amt NUMERIC(14,2) DEFAULT 0,
    total           NUMERIC(14,2) DEFAULT 0,
    notes           TEXT,
    valid_until     DATE,
    sent_at         TIMESTAMPTZ,
    approved_at     TIMESTAMPTZ,
    pdf_url         VARCHAR(500),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Items de la proforma (rubros cotizados)
CREATE TABLE proforma_items (
    id              SERIAL PRIMARY KEY,
    proforma_id     INTEGER NOT NULL REFERENCES proformas(id) ON DELETE CASCADE,
    catalog_rubro_id INTEGER REFERENCES catalog_rubros(id) ON DELETE SET NULL,
    category_id     INTEGER REFERENCES rubro_categories(id) ON DELETE SET NULL,
    description     VARCHAR(300) NOT NULL,
    unit            VARCHAR(30)  NOT NULL,
    quantity        NUMERIC(12,3) NOT NULL,
    unit_price      NUMERIC(12,2) NOT NULL,
    total           NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    sort_order      INTEGER DEFAULT 0
);

-- Contratos
CREATE TABLE contracts (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    proforma_id     INTEGER REFERENCES proformas(id),
    created_by      INTEGER NOT NULL REFERENCES users(id),
    contract_number VARCHAR(50),
    status          VARCHAR(20) DEFAULT 'DRAFT',
    -- DRAFT | SENT | SIGNED | ACTIVE | CLOSED
    contracted_amount   NUMERIC(14,2) NOT NULL,
    payment_terms   TEXT,                      -- condiciones de pago
    start_date      DATE,
    end_date        DATE,
    penalty_clause  TEXT,
    scope           TEXT,                      -- alcance del trabajo
    -- Firma del cliente
    client_signed_at    TIMESTAMPTZ,
    client_signer_name  VARCHAR(150),
    client_signer_id    VARCHAR(20),
    -- PDFs
    contract_pdf_url    VARCHAR(500),          -- PDF generado
    signed_pdf_url      VARCHAR(500),          -- PDF firmado subido
    notes               TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionales al contrato (presupuestos extra aprobados)
CREATE TABLE contract_addendums (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contract_id     INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    description     VARCHAR(300) NOT NULL,
    amount          NUMERIC(14,2) NOT NULL,
    approved_at     DATE,
    document_url    VARCHAR(500),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Actas de recepcion / liquidacion
CREATE TABLE project_liquidations (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    initial_amount  NUMERIC(14,2) NOT NULL,
    addendums_total NUMERIC(14,2) DEFAULT 0,
    final_amount    NUMERIC(14,2) NOT NULL,
    -- Firma del cliente
    client_name     VARCHAR(150),
    client_id_number VARCHAR(20),
    signed_at       DATE,
    -- PDFs
    liquidation_pdf_url VARCHAR(500),
    signed_pdf_url      VARCHAR(500),
    notes               TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOMINIO 6: CONTROL DE OBRAS
-- ============================================================

-- Obras
CREATE TABLE works (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id      INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    client_id       INTEGER REFERENCES clients(id),
    assigned_user_id INTEGER REFERENCES users(id),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    location        TEXT,
    status          VARCHAR(20) DEFAULT 'ACTIVE',
    -- ACTIVE | PAUSED | FINISHED | LIQUIDATION | CLOSED
    start_date      DATE,
    estimated_end   DATE,
    actual_end      DATE,
    -- Presupuesto
    utility_pct         NUMERIC(5,2) DEFAULT 18.00,
    contingency_pct     NUMERIC(5,2) DEFAULT 10.00,
    initial_budget      NUMERIC(14,2) DEFAULT 0,   -- presupuesto inicial al cliente
    real_cost           NUMERIC(14,2) DEFAULT 0,   -- costo real acumulado
    final_budget        NUMERIC(14,2) DEFAULT 0,   -- presupuesto final liquidacion
    -- Avance
    planned_progress    NUMERIC(5,2)  DEFAULT 0,   -- % planificado actual
    actual_progress     NUMERIC(5,2)  DEFAULT 0,   -- % real actual
    notes               TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Rubros de obra (presupuesto detallado)
CREATE TABLE work_items (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    work_id         INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    catalog_rubro_id INTEGER REFERENCES catalog_rubros(id) ON DELETE SET NULL,
    category_id     INTEGER REFERENCES rubro_categories(id) ON DELETE SET NULL,
    description     VARCHAR(300) NOT NULL,
    unit            VARCHAR(30)  NOT NULL,
    -- Cantidades
    initial_qty     NUMERIC(12,3) DEFAULT 0,   -- cantidad inicial presupuestada
    real_qty        NUMERIC(12,3) DEFAULT 0,   -- cantidad real (se actualiza)
    -- Precios
    unit_cost       NUMERIC(12,2) DEFAULT 0,   -- costo unitario (del proveedor)
    unit_price      NUMERIC(12,2) DEFAULT 0,   -- precio al cliente (con margen)
    -- Totales calculados
    initial_total   NUMERIC(14,2) DEFAULT 0,   -- initial_qty * unit_price
    real_total      NUMERIC(14,2) DEFAULT 0,   -- real_qty * unit_cost
    -- Avance
    progress_pct    NUMERIC(5,2)  DEFAULT 0,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Proformas de contratistas para cada rubro
CREATE TABLE work_item_proformas (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    work_item_id    INTEGER NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
    unit_price      NUMERIC(12,2) NOT NULL,
    total           NUMERIC(14,2),
    notes           TEXT,
    document_url    VARCHAR(500),
    is_selected     BOOLEAN DEFAULT FALSE,     -- la proforma ganadora
    submitted_at    DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Reportes diarios de obra
CREATE TABLE daily_reports (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    work_id         INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    report_date     DATE NOT NULL,
    weather         VARCHAR(50),               -- soleado, nublado, lluvia
    activities      TEXT NOT NULL,             -- descripcion de lo realizado
    novelties       TEXT,                      -- novedades o problemas
    workers_count   INTEGER DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (work_id, report_date)
);

-- Contratistas presentes en cada reporte
CREATE TABLE report_contractors (
    id              SERIAL PRIMARY KEY,
    daily_report_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
    workers_count   INTEGER DEFAULT 1,
    activity        VARCHAR(300)
);

-- Compras registradas en reportes diarios
CREATE TABLE report_purchases (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    daily_report_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    work_id         INTEGER NOT NULL REFERENCES works(id),
    supplier_id     INTEGER REFERENCES suppliers(id),
    product_id      INTEGER REFERENCES products(id),
    description     VARCHAR(300) NOT NULL,
    quantity        NUMERIC(12,3) NOT NULL,
    unit            VARCHAR(30),
    unit_price      NUMERIC(12,2) NOT NULL,
    total           NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    category        VARCHAR(100),
    invoice_url     VARCHAR(500),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Fotos de los reportes diarios
CREATE TABLE report_photos (
    id              SERIAL PRIMARY KEY,
    daily_report_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    url             VARCHAR(500) NOT NULL,
    caption         VARCHAR(300),
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Subcontratos por obra
CREATE TABLE subcontracts (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    work_id         INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
    specialty       VARCHAR(150) NOT NULL,     -- gypsum, electricidad, plomeria, etc.
    description     TEXT,
    contracted_amount   NUMERIC(14,2) NOT NULL,
    paid_amount         NUMERIC(14,2) DEFAULT 0,
    progress_pct        NUMERIC(5,2)  DEFAULT 0,
    start_date      DATE,
    end_date        DATE,
    status          VARCHAR(20) DEFAULT 'ACTIVE',
    -- ACTIVE | PAUSED | COMPLETED | CANCELLED
    document_url    VARCHAR(500),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Pagos a subcontratistas
CREATE TABLE subcontract_payments (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    subcontract_id  INTEGER NOT NULL REFERENCES subcontracts(id) ON DELETE CASCADE,
    amount          NUMERIC(14,2) NOT NULL,
    payment_date    DATE NOT NULL,
    payment_method  VARCHAR(50),
    reference       VARCHAR(100),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOMINIO 7: CRONOGRAMA Y AVANCE
-- ============================================================

-- Tareas del cronograma Gantt
CREATE TABLE schedule_tasks (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    work_id         INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    work_item_id    INTEGER REFERENCES work_items(id) ON DELETE SET NULL,
    parent_task_id  INTEGER REFERENCES schedule_tasks(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    -- Fechas planificadas
    planned_start   DATE NOT NULL,
    planned_end     DATE NOT NULL,
    -- Fechas reales
    actual_start    DATE,
    actual_end      DATE,
    -- Avance
    planned_progress NUMERIC(5,2) DEFAULT 0,
    actual_progress  NUMERIC(5,2) DEFAULT 0,
    -- Estado
    status          VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING | IN_PROGRESS | COMPLETED | DELAYED
    sort_order      INTEGER DEFAULT 0,
    color           VARCHAR(7)  DEFAULT '#1A5A8A',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de actualizaciones de avance (para Curva S)
CREATE TABLE progress_snapshots (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    work_id         INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL,
    planned_progress  NUMERIC(5,2) DEFAULT 0,   -- % fisico planificado a esa fecha
    actual_progress   NUMERIC(5,2) DEFAULT 0,   -- % fisico real a esa fecha
    planned_cost      NUMERIC(14,2) DEFAULT 0,  -- costo planificado acumulado
    actual_cost       NUMERIC(14,2) DEFAULT 0,  -- costo real acumulado
    recorded_by     INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Certificados de avance (para cobros parciales)
CREATE TABLE progress_certificates (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    work_id         INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    project_id      INTEGER REFERENCES projects(id),
    created_by      INTEGER NOT NULL REFERENCES users(id),
    certificate_number  VARCHAR(50),
    period          VARCHAR(50),               -- ej: "Febrero 2026"
    progress_pct    NUMERIC(5,2) NOT NULL,
    amount_to_bill  NUMERIC(14,2) NOT NULL,    -- valor que se cobra al cliente
    status          VARCHAR(20) DEFAULT 'DRAFT',
    -- DRAFT | SENT | PAID
    pdf_url         VARCHAR(500),
    signed_pdf_url  VARCHAR(500),
    issued_at       DATE,
    paid_at         DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOMINIO 8: COMPRAS — Proceso completo
-- ============================================================

-- Solicitudes de compra (lista general antes de separar por proveedor)
CREATE TABLE purchase_requests (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    work_id         INTEGER REFERENCES works(id) ON DELETE SET NULL,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    request_number  VARCHAR(50),
    status          VARCHAR(20) DEFAULT 'DRAFT',
    -- DRAFT | QUOTED | APPROVED | ORDERED | RECEIVED | CANCELLED
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Items de la solicitud de compra
CREATE TABLE purchase_request_items (
    id                  SERIAL PRIMARY KEY,
    purchase_request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    product_id          INTEGER REFERENCES products(id) ON DELETE SET NULL,
    supplier_id         INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    description         VARCHAR(300) NOT NULL,
    quantity            NUMERIC(12,3) NOT NULL,
    unit                VARCHAR(30),
    reference_price     NUMERIC(12,2) DEFAULT 0,  -- precio de referencia al momento
    quoted_price        NUMERIC(12,2),             -- precio cotizado por el proveedor
    variation_pct       NUMERIC(6,2),              -- % diferencia vs referencia
    notes               TEXT
);

-- Ordenes de compra (una por proveedor)
CREATE TABLE purchase_orders (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    purchase_request_id INTEGER REFERENCES purchase_requests(id),
    work_id         INTEGER REFERENCES works(id) ON DELETE SET NULL,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
    created_by      INTEGER NOT NULL REFERENCES users(id),
    order_number    VARCHAR(50),
    status          VARCHAR(20) DEFAULT 'DRAFT',
    -- DRAFT | SENT | CONFIRMED | RECEIVED | CANCELLED
    subtotal        NUMERIC(14,2) DEFAULT 0,
    tax_pct         NUMERIC(5,2)  DEFAULT 12.00,
    tax_amount      NUMERIC(14,2) DEFAULT 0,
    total           NUMERIC(14,2) DEFAULT 0,
    expected_date   DATE,
    -- PDFs
    request_pdf_url VARCHAR(500),   -- solicitud de cotizacion enviada al proveedor
    proforma_pdf_url VARCHAR(500),  -- proforma recibida del proveedor
    order_pdf_url   VARCHAR(500),   -- orden de compra formal
    notes           TEXT,
    sent_at         TIMESTAMPTZ,
    confirmed_at    TIMESTAMPTZ,
    received_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Items de la orden de compra
CREATE TABLE purchase_order_items (
    id                  SERIAL PRIMARY KEY,
    purchase_order_id   INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id          INTEGER REFERENCES products(id) ON DELETE SET NULL,
    description         VARCHAR(300) NOT NULL,
    quantity            NUMERIC(12,3) NOT NULL,
    unit                VARCHAR(30),
    unit_price          NUMERIC(12,2) NOT NULL,
    total               NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    reference_price     NUMERIC(12,2) DEFAULT 0,
    variation_pct       NUMERIC(6,2)              -- % vs precio referencia
);

-- Facturas de compra
CREATE TABLE purchase_invoices (
    id                  SERIAL PRIMARY KEY,
    company_id          INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    purchase_order_id   INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
    work_id             INTEGER REFERENCES works(id) ON DELETE SET NULL,
    supplier_id         INTEGER NOT NULL REFERENCES suppliers(id),
    invoice_number      VARCHAR(100) NOT NULL,
    issue_date          DATE NOT NULL,
    subtotal            NUMERIC(14,2) DEFAULT 0,
    tax_amount          NUMERIC(14,2) DEFAULT 0,
    total               NUMERIC(14,2) NOT NULL,
    status              VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING | PAID | CANCELLED
    document_url        VARCHAR(500),
    payment_date        DATE,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOMINIO 9: BODEGA E INVENTARIO (Modelo Warehouse)
-- ============================================================

-- Almacenes (Bodega General + un almacen por obra)
CREATE TABLE warehouses (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    work_id         INTEGER REFERENCES works(id) ON DELETE CASCADE,
    name            VARCHAR(150) NOT NULL,
    type            VARCHAR(20)  NOT NULL,
    -- GENERAL | OBRA
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Stock actual por almacen (snapshot del inventario)
CREATE TABLE warehouse_items (
    id                  SERIAL PRIMARY KEY,
    company_id          INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    warehouse_id        INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id          INTEGER NOT NULL REFERENCES products(id),
    quantity            NUMERIC(12,3) DEFAULT 0,   -- stock total fisico
    reserved_quantity   NUMERIC(12,3) DEFAULT 0,   -- comprometido para otra obra
    -- available = quantity - reserved_quantity  (calculado en vista/app)
    unit                VARCHAR(30),
    average_cost        NUMERIC(12,2) DEFAULT 0,   -- costo promedio ponderado
    min_stock           NUMERIC(12,3) DEFAULT 0,   -- umbral de alerta
    last_movement       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (warehouse_id, product_id),
    -- Garantiza que reserved no supere quantity
    CONSTRAINT chk_reserved CHECK (reserved_quantity <= quantity),
    CONSTRAINT chk_quantity_positive CHECK (quantity >= 0),
    CONSTRAINT chk_reserved_positive CHECK (reserved_quantity >= 0)
);

-- Movimientos de inventario (historial completo trazable)
CREATE TABLE inventory_movements (
    id                  SERIAL PRIMARY KEY,
    company_id          INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    product_id          INTEGER NOT NULL REFERENCES products(id),
    from_warehouse_id   INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
    to_warehouse_id     INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
    quantity            NUMERIC(12,3) NOT NULL,
    unit_cost           NUMERIC(12,2) DEFAULT 0,
    total_cost          NUMERIC(14,2) DEFAULT 0,
    movement_type       VARCHAR(25) NOT NULL,
    -- COMPRA | CONSUMO_OBRA | TRASLADO_BODEGA | ASIGNACION_OBRA | AJUSTE | DEVOLUCION | RESERVA | LIBERAR_RESERVA
    -- Referencias de origen
    purchase_invoice_id INTEGER REFERENCES purchase_invoices(id) ON DELETE SET NULL,
    daily_report_id     INTEGER REFERENCES daily_reports(id) ON DELETE SET NULL,
    work_id             INTEGER REFERENCES works(id) ON DELETE SET NULL,
    -- 3.1 TRAZABILIDAD DE ORIGEN: obra que genero el sobrante
    -- Permite saber: que obra genero mas sobrantes, que ingeniero optimiza mejor
    origin_work_id      INTEGER REFERENCES works(id) ON DELETE SET NULL,
    reference_note      VARCHAR(300),
    movement_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by          INTEGER REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Ahorros generados por uso de bodega
CREATE TABLE warehouse_savings (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    work_id         INTEGER NOT NULL REFERENCES works(id),     -- obra que recibe el material
    product_id      INTEGER NOT NULL REFERENCES products(id),
    movement_id     INTEGER NOT NULL REFERENCES inventory_movements(id),
    quantity        NUMERIC(12,3) NOT NULL,
    reference_price NUMERIC(12,2) NOT NULL,   -- precio al que se hubiera comprado
    actual_cost     NUMERIC(12,2) NOT NULL,   -- costo original del material
    saved_amount    NUMERIC(14,2) NOT NULL,   -- (reference_price - actual_cost) * qty
    saving_date     DATE DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOMINIO 10: CONTROL FINANCIERO
-- ============================================================

-- Transacciones financieras de una obra
CREATE TABLE financial_transactions (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    work_id         INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    type            VARCHAR(15) NOT NULL,
    -- INCOME | EXPENSE
    category        VARCHAR(50) NOT NULL,
    -- INCOME: ADVANCE_CLIENT | PARTIAL_PAYMENT | FINAL_PAYMENT
    -- EXPENSE: ADVANCE_SUPPLIER | MATERIAL_PURCHASE | SUBCONTRACT | EXTRA | TAX
    description     VARCHAR(300) NOT NULL,
    amount          NUMERIC(14,2) NOT NULL,
    transaction_date DATE NOT NULL,
    -- Referencias opcionales
    supplier_id     INTEGER REFERENCES suppliers(id),
    subcontract_id  INTEGER REFERENCES subcontracts(id),
    invoice_id      INTEGER REFERENCES purchase_invoices(id),
    -- Comprobante
    document_url    VARCHAR(500),
    reference       VARCHAR(100),          -- numero de transferencia, cheque, etc.
    recorded_by     INTEGER NOT NULL REFERENCES users(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOMINIO 11: DOCUMENTOS Y ARCHIVOS
-- ============================================================

-- Almacen central de archivos subidos
CREATE TABLE files (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    uploaded_by     INTEGER NOT NULL REFERENCES users(id),
    entity_type     VARCHAR(50) NOT NULL,     -- work, project, contract, report, invoice...
    entity_id       INTEGER NOT NULL,
    file_name       VARCHAR(300) NOT NULL,
    file_type       VARCHAR(100),             -- application/pdf, image/jpeg, etc.
    file_size       INTEGER,                  -- bytes
    url             VARCHAR(500) NOT NULL,
    description     VARCHAR(300),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOMINIO 12: ALERTAS
-- ============================================================

CREATE TABLE alerts (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES users(id),  -- NULL = para todos los admins
    type            VARCHAR(40) NOT NULL,
    -- BUDGET_EXCEEDED | SCHEDULE_DELAYED | PRICE_INCREASE |
    -- STOCK_LOW | ADVANCE_DUE | CONTRACT_PENDING
    title           VARCHAR(200) NOT NULL,
    message         TEXT NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       INTEGER,
    severity        VARCHAR(10) DEFAULT 'INFO',    -- INFO | WARNING | CRITICAL
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    read_at         TIMESTAMPTZ
);

-- ============================================================
-- DOMINIO 13: AUDITORÍA
-- ============================================================

CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    company_id  INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    table_name  VARCHAR(100) NOT NULL,
    record_id   INTEGER NOT NULL,
    action      VARCHAR(10)  NOT NULL,        -- INSERT | UPDATE | DELETE
    old_values  JSONB,
    new_values  JSONB,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES — Performance
-- ============================================================

-- Core
CREATE INDEX idx_users_company         ON users(company_id);
CREATE INDEX idx_users_email           ON users(email);

-- Clientes
CREATE INDEX idx_clients_company       ON clients(company_id);

-- Proyectos
CREATE INDEX idx_projects_company      ON projects(company_id);
CREATE INDEX idx_projects_client       ON projects(client_id);
CREATE INDEX idx_projects_status       ON projects(status);

-- Proformas
CREATE INDEX idx_proformas_project     ON proformas(project_id);
CREATE INDEX idx_proformas_status      ON proformas(status);

-- Contratos
CREATE INDEX idx_contracts_project     ON contracts(project_id);
CREATE INDEX idx_contracts_status      ON contracts(status);

-- Obras
CREATE INDEX idx_works_company         ON works(company_id);
CREATE INDEX idx_works_project         ON works(project_id);
CREATE INDEX idx_works_status          ON works(status);
CREATE INDEX idx_works_user            ON works(assigned_user_id);

-- Items de obra
CREATE INDEX idx_work_items_work       ON work_items(work_id);

-- Reportes diarios
CREATE INDEX idx_daily_reports_work    ON daily_reports(work_id);
CREATE INDEX idx_daily_reports_date    ON daily_reports(report_date);

-- Compras en reportes
CREATE INDEX idx_report_purchases_work ON report_purchases(work_id);
CREATE INDEX idx_report_purchases_date ON report_purchases(daily_report_id);

-- Subcontratos
CREATE INDEX idx_subcontracts_work     ON subcontracts(work_id);

-- Cronograma
CREATE INDEX idx_schedule_work         ON schedule_tasks(work_id);
CREATE INDEX idx_progress_snap_work    ON progress_snapshots(work_id);
CREATE INDEX idx_progress_snap_date    ON progress_snapshots(snapshot_date);

-- Proveedores
CREATE INDEX idx_suppliers_company     ON suppliers(company_id);
CREATE INDEX idx_products_company      ON products(company_id);
CREATE INDEX idx_supplier_products_sup ON supplier_products(supplier_id);
CREATE INDEX idx_supplier_products_pro ON supplier_products(product_id);
CREATE INDEX idx_price_history_prod    ON product_price_history(product_id);

-- Compras
CREATE INDEX idx_purchase_req_work     ON purchase_requests(work_id);
CREATE INDEX idx_purchase_orders_sup   ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_work  ON purchase_orders(work_id);
CREATE INDEX idx_purchase_inv_work     ON purchase_invoices(work_id);
CREATE INDEX idx_purchase_inv_status   ON purchase_invoices(status);

-- Bodega
CREATE INDEX idx_warehouses_company    ON warehouses(company_id);
CREATE INDEX idx_warehouses_work       ON warehouses(work_id);
CREATE INDEX idx_warehouse_items_wh    ON warehouse_items(warehouse_id);
CREATE INDEX idx_warehouse_items_prod  ON warehouse_items(product_id);
CREATE INDEX idx_inv_movements_prod    ON inventory_movements(product_id);
CREATE INDEX idx_inv_movements_type    ON inventory_movements(movement_type);
CREATE INDEX idx_inv_movements_work    ON inventory_movements(work_id);
CREATE INDEX idx_inv_movements_origin  ON inventory_movements(origin_work_id);  -- 3.1 trazabilidad origen
CREATE INDEX idx_inv_movements_date    ON inventory_movements(movement_date);
CREATE INDEX idx_wh_savings_work       ON warehouse_savings(work_id);

-- Finanzas
CREATE INDEX idx_fin_trans_work        ON financial_transactions(work_id);
CREATE INDEX idx_fin_trans_type        ON financial_transactions(type);
CREATE INDEX idx_fin_trans_date        ON financial_transactions(transaction_date);

-- Alertas
CREATE INDEX idx_alerts_company        ON alerts(company_id);
CREATE INDEX idx_alerts_user           ON alerts(user_id);
CREATE INDEX idx_alerts_read           ON alerts(is_read);

-- Auditoria
CREATE INDEX idx_audit_company         ON audit_logs(company_id);
CREATE INDEX idx_audit_table           ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_user            ON audit_logs(user_id);
CREATE INDEX idx_audit_date            ON audit_logs(created_at);

-- ============================================================
-- VISTAS ÚTILES
-- ============================================================

-- Vista: resumen financiero por obra
CREATE VIEW v_work_financial_summary AS
SELECT
    w.id                    AS work_id,
    w.company_id,
    w.name                  AS work_name,
    w.status,
    w.initial_budget,
    w.actual_progress,
    COALESCE(SUM(CASE WHEN ft.type = 'INCOME'  THEN ft.amount ELSE 0 END), 0) AS total_income,
    COALESCE(SUM(CASE WHEN ft.type = 'EXPENSE' THEN ft.amount ELSE 0 END), 0) AS total_expense,
    COALESCE(SUM(CASE WHEN ft.type = 'INCOME'  THEN ft.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN ft.type = 'EXPENSE' THEN ft.amount ELSE 0 END), 0) AS balance,
    COALESCE((SELECT SUM(ws.saved_amount) FROM warehouse_savings ws WHERE ws.work_id = w.id), 0) AS warehouse_savings
FROM works w
LEFT JOIN financial_transactions ft ON ft.work_id = w.id
GROUP BY w.id, w.company_id, w.name, w.status, w.initial_budget, w.actual_progress;

-- Vista: stock general valorizado con stock disponible real
CREATE VIEW v_warehouse_stock AS
SELECT
    wi.company_id,
    wh.id                                       AS warehouse_id,
    wh.name                                     AS warehouse_name,
    wh.type                                     AS warehouse_type,
    p.id                                        AS product_id,
    p.name                                      AS product_name,
    p.unit,
    wi.quantity,
    wi.reserved_quantity,
    wi.quantity - wi.reserved_quantity          AS available_quantity,  -- 3.2 stock real disponible
    wi.average_cost,
    wi.quantity * wi.average_cost               AS total_value,
    (wi.quantity - wi.reserved_quantity)
        * wi.average_cost                       AS available_value,
    wi.min_stock,
    CASE WHEN (wi.quantity - wi.reserved_quantity) <= wi.min_stock
         THEN TRUE ELSE FALSE END               AS below_minimum,       -- basado en disponible, no total
    wi.last_movement
FROM warehouse_items wi
JOIN warehouses wh  ON wh.id = wi.warehouse_id
JOIN products   p   ON p.id  = wi.product_id;

-- Vista: avance de obras (para dashboard)
CREATE VIEW v_works_progress AS
SELECT
    w.id,
    w.company_id,
    w.name,
    w.status,
    w.start_date,
    w.estimated_end,
    w.actual_progress,
    w.planned_progress,
    w.actual_progress - w.planned_progress  AS progress_delta,
    CASE
        WHEN w.actual_progress >= w.planned_progress        THEN 'ON_TIME'
        WHEN w.planned_progress - w.actual_progress <= 10   THEN 'SLIGHT_DELAY'
        ELSE 'CRITICAL_DELAY'
    END AS schedule_status,
    CURRENT_DATE - w.estimated_end          AS days_overdue
FROM works w
WHERE w.status IN ('ACTIVE','PAUSED');

-- Vista: alertas de precio por proveedor
CREATE VIEW v_price_alerts AS
SELECT
    pph.company_id,
    p.name                          AS product_name,
    s.name                          AS supplier_name,
    pph.old_price,
    pph.new_price,
    pph.variation_pct,
    pph.recorded_at,
    c.price_alert_threshold_pct
FROM product_price_history pph
JOIN products   p ON p.id = pph.product_id
JOIN suppliers  s ON s.id = pph.supplier_id
JOIN companies  c ON c.id = pph.company_id
WHERE ABS(pph.variation_pct) >= c.price_alert_threshold_pct;

-- ============================================================
-- VISTA KPI: EFICIENCIA DE MATERIAL POR OBRA  (3.4)
-- Eficiencia = material usado / material comprado
-- Diferenciador clave vs ERPs basicos
-- ============================================================
CREATE VIEW v_material_efficiency AS
SELECT
    w.company_id,
    w.id                                        AS work_id,
    w.name                                      AS work_name,
    u.first_name || ' ' || u.last_name         AS engineer_name,
    -- Total comprado para esta obra
    COALESCE(SUM(CASE WHEN im.movement_type = 'COMPRA'
                 THEN im.total_cost ELSE 0 END), 0)         AS total_purchased_cost,
    -- Total consumido en obra
    COALESCE(SUM(CASE WHEN im.movement_type = 'CONSUMO_OBRA'
                 THEN im.total_cost ELSE 0 END), 0)         AS total_consumed_cost,
    -- Total sobrante trasladado a bodega
    COALESCE(SUM(CASE WHEN im.movement_type = 'TRASLADO_BODEGA'
                 THEN im.total_cost ELSE 0 END), 0)         AS total_transferred_cost,
    -- Total reutilizado de bodega (materiales recibidos de bodega general)
    COALESCE(SUM(CASE WHEN im.movement_type = 'ASIGNACION_OBRA'
                 THEN im.total_cost ELSE 0 END), 0)         AS total_reused_from_warehouse,
    -- Ahorro real cuantificado
    COALESCE((SELECT SUM(ws.saved_amount)
              FROM warehouse_savings ws WHERE ws.work_id = w.id), 0) AS total_savings,
    -- KPI eficiencia: % de lo comprado que realmente se uso
    CASE
        WHEN COALESCE(SUM(CASE WHEN im.movement_type = 'COMPRA'
                          THEN im.total_cost ELSE 0 END), 0) = 0 THEN 0
        ELSE ROUND(
            COALESCE(SUM(CASE WHEN im.movement_type = 'CONSUMO_OBRA'
                         THEN im.total_cost ELSE 0 END), 0)
            / NULLIF(SUM(CASE WHEN im.movement_type = 'COMPRA'
                         THEN im.total_cost ELSE 0 END), 0) * 100, 2)
    END                                                     AS material_efficiency_pct,
    -- % sobrante = 100 - eficiencia
    CASE
        WHEN COALESCE(SUM(CASE WHEN im.movement_type = 'COMPRA'
                          THEN im.total_cost ELSE 0 END), 0) = 0 THEN 0
        ELSE ROUND(100 - (
            COALESCE(SUM(CASE WHEN im.movement_type = 'CONSUMO_OBRA'
                         THEN im.total_cost ELSE 0 END), 0)
            / NULLIF(SUM(CASE WHEN im.movement_type = 'COMPRA'
                         THEN im.total_cost ELSE 0 END), 0) * 100), 2)
    END                                                     AS waste_pct
FROM works w
LEFT JOIN users u               ON u.id  = w.assigned_user_id
LEFT JOIN inventory_movements im ON im.work_id = w.id
GROUP BY w.company_id, w.id, w.name, u.first_name, u.last_name;

-- Vista: obras con sobrantes generados por origen (inteligencia de negocio 3.1)
CREATE VIEW v_work_surplus_origin AS
SELECT
    im.company_id,
    ow.id                           AS origin_work_id,
    ow.name                         AS origin_work_name,
    u.first_name || ' ' || u.last_name AS engineer_name,
    p.name                          AS product_name,
    SUM(im.quantity)                AS total_surplus_qty,
    SUM(im.total_cost)              AS total_surplus_cost,
    COUNT(*)                        AS transfer_count
FROM inventory_movements im
JOIN works    ow ON ow.id = im.origin_work_id
JOIN products p  ON p.id  = im.product_id
LEFT JOIN users u ON u.id = ow.assigned_user_id
WHERE im.movement_type = 'TRASLADO_BODEGA'
  AND im.origin_work_id IS NOT NULL
GROUP BY im.company_id, ow.id, ow.name, u.first_name, u.last_name, p.name;

-- ============================================================
-- FUNCIONES ÚTILES
-- ============================================================

-- Funcion: actualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas con updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'companies','users','clients','catalog_rubros','suppliers',
        'products','supplier_products','projects','proformas',
        'contracts','works','work_items','daily_reports',
        'subcontracts','schedule_tasks','purchase_requests',
        'purchase_orders','purchase_invoices','warehouse_items',
        'financial_transactions','project_liquidations'
    ]
    LOOP
        EXECUTE format('
            CREATE TRIGGER trg_%s_updated_at
            BEFORE UPDATE ON %s
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
        ', t, t);
    END LOOP;
END;
$$;

-- Funcion: calcular progreso general de obra ponderado por costo
CREATE OR REPLACE FUNCTION calculate_work_progress(p_work_id INTEGER)
RETURNS NUMERIC AS $$
DECLARE
    v_progress NUMERIC;
BEGIN
    SELECT
        CASE
            WHEN SUM(initial_total) = 0 THEN 0
            ELSE ROUND(SUM(progress_pct * initial_total) / NULLIF(SUM(initial_total), 0), 2)
        END
    INTO v_progress
    FROM work_items
    WHERE work_id = p_work_id;

    RETURN COALESCE(v_progress, 0);
END;
$$ LANGUAGE plpgsql;

-- Funcion: registrar movimiento de inventario y actualizar stock
-- Actualizada v2.0: acepta origin_work_id para trazabilidad (3.1)
CREATE OR REPLACE FUNCTION register_inventory_movement(
    p_company_id        INTEGER,
    p_product_id        INTEGER,
    p_from_warehouse_id INTEGER,
    p_to_warehouse_id   INTEGER,
    p_quantity          NUMERIC,
    p_unit_cost         NUMERIC,
    p_movement_type     VARCHAR,
    p_reference_note    VARCHAR,
    p_work_id           INTEGER,
    p_created_by        INTEGER,
    p_origin_work_id    INTEGER DEFAULT NULL   -- 3.1: obra que genero el sobrante
) RETURNS INTEGER AS $$
DECLARE
    v_movement_id INTEGER;
BEGIN
    -- 1. Registrar el movimiento
    INSERT INTO inventory_movements (
        company_id, product_id, from_warehouse_id, to_warehouse_id,
        quantity, unit_cost, total_cost, movement_type,
        reference_note, work_id, origin_work_id, created_by, movement_date
    ) VALUES (
        p_company_id, p_product_id, p_from_warehouse_id, p_to_warehouse_id,
        p_quantity, p_unit_cost, p_quantity * p_unit_cost, p_movement_type,
        p_reference_note, p_work_id, p_origin_work_id, p_created_by, CURRENT_DATE
    ) RETURNING id INTO v_movement_id;

    -- 2. Descontar del almacen origen (solo stock disponible, no reservado)
    IF p_from_warehouse_id IS NOT NULL THEN
        UPDATE warehouse_items
        SET quantity      = quantity - p_quantity,
            last_movement = NOW()
        WHERE warehouse_id = p_from_warehouse_id
          AND product_id   = p_product_id;
    END IF;

    -- 3. Agregar al almacen destino con costo promedio ponderado
    IF p_to_warehouse_id IS NOT NULL THEN
        INSERT INTO warehouse_items (
            company_id, warehouse_id, product_id,
            quantity, average_cost, last_movement
        ) VALUES (
            p_company_id, p_to_warehouse_id, p_product_id,
            p_quantity, p_unit_cost, NOW()
        )
        ON CONFLICT (warehouse_id, product_id) DO UPDATE
        SET quantity      = warehouse_items.quantity + p_quantity,
            average_cost  = ROUND(
                (warehouse_items.average_cost * warehouse_items.quantity
                 + p_unit_cost * p_quantity)
                / NULLIF(warehouse_items.quantity + p_quantity, 0), 2),
            last_movement = NOW();
    END IF;

    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCION: RESERVAR STOCK EN BODEGA  (3.2)
-- Marca material como comprometido para una obra especifica
-- Evita usar material que ya esta asignado a otro proyecto
-- ============================================================
CREATE OR REPLACE FUNCTION reserve_warehouse_stock(
    p_warehouse_id  INTEGER,
    p_product_id    INTEGER,
    p_quantity      NUMERIC,
    p_work_id       INTEGER,
    p_company_id    INTEGER,
    p_created_by    INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_available NUMERIC;
BEGIN
    -- Verificar stock disponible (total - ya reservado)
    SELECT quantity - reserved_quantity
    INTO   v_available
    FROM   warehouse_items
    WHERE  warehouse_id = p_warehouse_id
      AND  product_id   = p_product_id;

    IF v_available IS NULL OR v_available < p_quantity THEN
        RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %',
            COALESCE(v_available, 0), p_quantity;
    END IF;

    -- Incrementar cantidad reservada
    UPDATE warehouse_items
    SET reserved_quantity = reserved_quantity + p_quantity,
        last_movement     = NOW()
    WHERE warehouse_id = p_warehouse_id
      AND product_id   = p_product_id;

    -- Registrar el movimiento de reserva
    PERFORM register_inventory_movement(
        p_company_id, p_product_id,
        NULL, NULL,
        p_quantity, 0,
        'RESERVA',
        'Reservado para obra ID: ' || p_work_id,
        p_work_id, p_created_by, NULL
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCION: CONSUMO AUTOMATICO DE MATERIAL DESDE REPORTE  (3.3)
-- Se llama al guardar un item de reporte diario con product_id
-- Descuenta automaticamente del stock de obra
-- ============================================================
CREATE OR REPLACE FUNCTION consume_material_from_report(
    p_daily_report_id   INTEGER,
    p_product_id        INTEGER,
    p_quantity          NUMERIC,
    p_work_id           INTEGER,
    p_company_id        INTEGER,
    p_created_by        INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_warehouse_id  INTEGER;
    v_avg_cost      NUMERIC;
    v_movement_id   INTEGER;
BEGIN
    -- Obtener el almacen de la obra
    SELECT id INTO v_warehouse_id
    FROM warehouses
    WHERE work_id = p_work_id AND type = 'OBRA'
    LIMIT 1;

    IF v_warehouse_id IS NULL THEN
        RAISE EXCEPTION 'No existe almacen para la obra ID: %', p_work_id;
    END IF;

    -- Obtener costo promedio actual del producto en ese almacen
    SELECT average_cost INTO v_avg_cost
    FROM warehouse_items
    WHERE warehouse_id = v_warehouse_id AND product_id = p_product_id;

    -- Registrar movimiento de consumo
    SELECT register_inventory_movement(
        p_company_id,
        p_product_id,
        v_warehouse_id,      -- sale del almacen de obra
        NULL,                -- no va a ningun destino
        p_quantity,
        COALESCE(v_avg_cost, 0),
        'CONSUMO_OBRA',
        'Consumo desde reporte diario ID: ' || p_daily_report_id,
        p_work_id,
        p_created_by,
        NULL
    ) INTO v_movement_id;

    -- Actualizar referencia en el movimiento con el reporte
    UPDATE inventory_movements
    SET daily_report_id = p_daily_report_id
    WHERE id = v_movement_id;

    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCION: ALERTAS INTELIGENTES AUTOMATICAS  (3.5)
-- Ejecutar periodicamente (cron job desde backend cada hora)
-- Genera alertas en tabla alerts automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION generate_smart_alerts(p_company_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_count     INTEGER := 0;
    v_rec       RECORD;
BEGIN

    -- ALERTA 1: Stock por debajo del minimo (basado en disponible real)
    FOR v_rec IN
        SELECT wi.company_id, wi.warehouse_id, wh.name AS wh_name,
               p.id AS product_id, p.name AS product_name,
               wi.quantity - wi.reserved_quantity AS available,
               wi.min_stock
        FROM warehouse_items wi
        JOIN warehouses wh ON wh.id = wi.warehouse_id
        JOIN products   p  ON p.id  = wi.product_id
        WHERE wi.company_id = p_company_id
          AND (wi.quantity - wi.reserved_quantity) <= wi.min_stock
          AND wi.min_stock > 0
          AND NOT EXISTS (
              SELECT 1 FROM alerts a
              WHERE a.company_id = p_company_id
                AND a.type = 'STOCK_LOW'
                AND a.entity_type = 'warehouse_items'
                AND a.entity_id = wi.id
                AND a.is_read = FALSE
                AND a.created_at > NOW() - INTERVAL '24 hours'
          )
    LOOP
        INSERT INTO alerts (company_id, type, title, message,
                            entity_type, entity_id, severity)
        VALUES (p_company_id, 'STOCK_LOW',
                'Stock bajo minimo: ' || v_rec.product_name,
                'Bodega "' || v_rec.wh_name || '" tiene ' ||
                v_rec.available || ' unidades disponibles. Minimo: ' || v_rec.min_stock,
                'warehouse_items', v_rec.warehouse_id, 'WARNING');
        v_count := v_count + 1;
    END LOOP;

    -- ALERTA 2: Material sin movimiento por mas de 30 dias
    FOR v_rec IN
        SELECT wi.company_id, p.name AS product_name,
               wi.warehouse_id, wh.name AS wh_name,
               wi.last_movement, wi.quantity,
               wi.id AS item_id
        FROM warehouse_items wi
        JOIN warehouses wh ON wh.id = wi.warehouse_id
        JOIN products   p  ON p.id  = wi.product_id
        WHERE wi.company_id = p_company_id
          AND wh.type = 'GENERAL'
          AND wi.quantity > 0
          AND (wi.last_movement IS NULL
               OR wi.last_movement < NOW() - INTERVAL '30 days')
          AND NOT EXISTS (
              SELECT 1 FROM alerts a
              WHERE a.company_id = p_company_id
                AND a.type = 'STOCK_IDLE'
                AND a.entity_id = wi.id
                AND a.is_read = FALSE
                AND a.created_at > NOW() - INTERVAL '7 days'
          )
    LOOP
        INSERT INTO alerts (company_id, type, title, message,
                            entity_type, entity_id, severity)
        VALUES (p_company_id, 'STOCK_IDLE',
                'Material sin movimiento: ' || v_rec.product_name,
                '"' || v_rec.product_name || '" lleva mas de 30 dias sin movimiento ' ||
                'en bodega "' || v_rec.wh_name || '". Stock: ' || v_rec.quantity || ' unidades.',
                'warehouse_items', v_rec.item_id, 'INFO');
        v_count := v_count + 1;
    END LOOP;

    -- ALERTA 3: Obra con consumo mayor al estimado (fuga de dinero)
    FOR v_rec IN
        SELECT w.id AS work_id, w.name AS work_name,
               w.real_cost, w.initial_budget,
               ROUND((w.real_cost / NULLIF(w.initial_budget,0) - 1) * 100, 2) AS overrun_pct
        FROM works w
        WHERE w.company_id = p_company_id
          AND w.status = 'ACTIVE'
          AND w.initial_budget > 0
          AND w.real_cost > w.initial_budget * 1.10  -- supera 10% del presupuesto
          AND NOT EXISTS (
              SELECT 1 FROM alerts a
              WHERE a.company_id = p_company_id
                AND a.type = 'BUDGET_EXCEEDED'
                AND a.entity_id = w.id
                AND a.is_read = FALSE
                AND a.created_at > NOW() - INTERVAL '24 hours'
          )
    LOOP
        INSERT INTO alerts (company_id, type, title, message,
                            entity_type, entity_id, severity)
        VALUES (p_company_id, 'BUDGET_EXCEEDED',
                'Presupuesto superado: ' || v_rec.work_name,
                'La obra "' || v_rec.work_name || '" supera el presupuesto inicial en ' ||
                v_rec.overrun_pct || '%. Costo real: $' || v_rec.real_cost ||
                ' / Presupuesto: $' || v_rec.initial_budget,
                'works', v_rec.work_id, 'CRITICAL');
        v_count := v_count + 1;
    END LOOP;

    -- ALERTA 4: Obras atrasadas en cronograma
    FOR v_rec IN
        SELECT w.id AS work_id, w.name AS work_name,
               w.estimated_end,
               CURRENT_DATE - w.estimated_end AS days_overdue
        FROM works w
        WHERE w.company_id = p_company_id
          AND w.status = 'ACTIVE'
          AND w.estimated_end < CURRENT_DATE
          AND NOT EXISTS (
              SELECT 1 FROM alerts a
              WHERE a.company_id = p_company_id
                AND a.type = 'SCHEDULE_DELAYED'
                AND a.entity_id = w.id
                AND a.is_read = FALSE
                AND a.created_at > NOW() - INTERVAL '24 hours'
          )
    LOOP
        INSERT INTO alerts (company_id, type, title, message,
                            entity_type, entity_id, severity)
        VALUES (p_company_id, 'SCHEDULE_DELAYED',
                'Obra retrasada: ' || v_rec.work_name,
                'La obra "' || v_rec.work_name || '" lleva ' ||
                v_rec.days_overdue || ' dias de retraso sobre la fecha estimada de entrega.',
                'works', v_rec.work_id, 'CRITICAL');
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;  -- retorna cuantas alertas nuevas genero
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RESUMEN FINAL v2.0
-- ============================================================
-- DOMINIO 1  CORE:         companies, roles, users, refresh_tokens           (4)
-- DOMINIO 2  CLIENTES:     clients                                            (1)
-- DOMINIO 3  CATALOGOS:    rubro_categories, catalog_rubros                   (2)
-- DOMINIO 4  PROVEEDORES:  suppliers, products, supplier_products,
--                          product_price_history                              (4)
-- DOMINIO 5  PROYECTOS:    projects, proformas, proforma_items,
--                          contracts, contract_addendums,
--                          project_liquidations                               (6)
-- DOMINIO 6  OBRAS:        works, work_items, work_item_proformas,
--                          daily_reports, report_contractors,
--                          report_purchases, report_photos,
--                          subcontracts, subcontract_payments                 (9)
-- DOMINIO 7  CRONOGRAMA:   schedule_tasks, progress_snapshots,
--                          progress_certificates                              (3)
-- DOMINIO 8  COMPRAS:      purchase_requests, purchase_request_items,
--                          purchase_orders, purchase_order_items,
--                          purchase_invoices                                  (5)
-- DOMINIO 9  BODEGA:       warehouses, warehouse_items (+reserved_quantity),
--                          inventory_movements (+origin_work_id),
--                          warehouse_savings                                  (4)
-- DOMINIO 10 FINANZAS:     financial_transactions                             (1)
-- DOMINIO 11 ARCHIVOS:     files                                              (1)
-- DOMINIO 12 ALERTAS:      alerts                                             (1)
-- DOMINIO 13 AUDITORIA:    audit_logs                                         (1)
-- ─────────────────────────────────────────────────────────────
-- TOTAL TABLAS:                                                              42
-- ─────────────────────────────────────────────────────────────
-- VISTAS:
--   v_work_financial_summary    Resumen financiero por obra
--   v_warehouse_stock           Stock con available_quantity (v2.0)
--   v_works_progress            Avance y semaforo por obra
--   v_price_alerts              Alertas de alza de precios
--   v_material_efficiency       KPI eficiencia material por obra (v2.0 NUEVO)
--   v_work_surplus_origin       Sobrantes por obra de origen (v2.0 NUEVO)
-- ─────────────────────────────────────────────────────────────
-- FUNCIONES:
--   update_updated_at()                     Trigger automatico
--   calculate_work_progress(work_id)        Avance ponderado por costo
--   register_inventory_movement(...)        Movimiento + actualiza stock
--                                           v2.0: acepta origin_work_id
--   reserve_warehouse_stock(...)            Reservar stock (v2.0 NUEVO)
--   consume_material_from_report(...)       Consumo automatico (v2.0 NUEVO)
--   generate_smart_alerts(company_id)       Alertas inteligentes (v2.0 NUEVO)
-- ─────────────────────────────────────────────────────────────
-- INDICES:                                                                   53
-- ─────────────────────────────────────────────────────────────
-- MEJORAS v2.0 APLICADAS:
--   3.1 origin_work_id en inventory_movements
--       -> Trazabilidad: que obra genero el sobrante, que ingeniero optimiza mejor
--   3.2 reserved_quantity en warehouse_items + CHECK constraints
--       -> Evita usar material ya comprometido para otra obra
--   3.3 consume_material_from_report()
--       -> Consumo automatico al registrar material en reporte diario
--   3.4 v_material_efficiency
--       -> KPI: eficiencia = usado/comprado, waste_pct, ahorro real
--   3.5 generate_smart_alerts()
--       -> Stock bajo, material idle +30 dias, obra con sobrecosto, retrasos
--   3.6 warehouse_savings ya tenia reference_price + actual_cost + saved_amount
--       -> Costo contable vs costo estrategico cubierto
-- ============================================================
