const { sequelize } = require('../config/database');

// ── Importar todos los modelos ────────────────────────────────
const Company    = require('./Company');
const Role       = require('./Role');
const User       = require('./User');
const RefreshToken = require('./RefreshToken');
const Client     = require('./Client');

const RubroCategory = require('./RubroCategory');
const CatalogRubro  = require('./CatalogRubro');

const Supplier        = require('./Supplier');
const Product         = require('./Product');
const SupplierProduct = require('./SupplierProduct');
const PriceHistory    = require('./PriceHistory');

const Project            = require('./Project');
const Proforma           = require('./Proforma');
const ProformaItem       = require('./ProformaItem');
const Contract           = require('./Contract');
const ContractAddendum   = require('./ContractAddendum');
const ProjectLiquidation = require('./ProjectLiquidation');

const Work              = require('./Work');
const WorkItem          = require('./WorkItem');
const WorkItemProforma  = require('./WorkItemProforma');
const DailyReport       = require('./DailyReport');
const ReportContractor  = require('./ReportContractor');
const ReportPurchase    = require('./ReportPurchase');
const ReportPhoto       = require('./ReportPhoto');
const Subcontract       = require('./Subcontract');
const SubcontractPayment= require('./SubcontractPayment');

const ScheduleTask          = require('./ScheduleTask');
const ProgressSnapshot      = require('./ProgressSnapshot');
const ProgressCertificate   = require('./ProgressCertificate');

const PurchaseRequest     = require('./PurchaseRequest');
const PurchaseRequestItem = require('./PurchaseRequestItem');
const PurchaseOrder       = require('./PurchaseOrder');
const PurchaseOrderItem   = require('./PurchaseOrderItem');
const PurchaseInvoice     = require('./PurchaseInvoice');

const Warehouse            = require('./Warehouse');
const WarehouseItem        = require('./WarehouseItem');
const InventoryMovement    = require('./InventoryMovement');
const WarehouseSaving      = require('./WarehouseSaving');

const FinancialTransaction = require('./FinancialTransaction');
const File                 = require('./File');
const Alert                = require('./Alert');
const AuditLog             = require('./AuditLog');

// ── ASOCIACIONES ─────────────────────────────────────────────

// Company → todo
Company.hasMany(User,    { foreignKey: 'company_id', as: 'users' });
Company.hasMany(Client,  { foreignKey: 'company_id', as: 'clients' });
Company.hasMany(Project, { foreignKey: 'company_id', as: 'projects' });
Company.hasMany(Work,    { foreignKey: 'company_id', as: 'works' });

// User
User.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
User.belongsTo(Role,    { foreignKey: 'role_id',    as: 'role' });
User.hasMany(RefreshToken, { foreignKey: 'user_id', as: 'refreshTokens' });
Role.hasMany(User,      { foreignKey: 'role_id',    as: 'users' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Client
Client.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
Client.hasMany(Project,   { foreignKey: 'client_id',  as: 'projects' });
Client.hasMany(Work,      { foreignKey: 'client_id',  as: 'works' });

// Catalogos
RubroCategory.belongsTo(Company,      { foreignKey: 'company_id',  as: 'company' });
RubroCategory.hasMany(CatalogRubro,   { foreignKey: 'category_id', as: 'rubros' });
CatalogRubro.belongsTo(RubroCategory, { foreignKey: 'category_id', as: 'category' });
CatalogRubro.belongsTo(Company,       { foreignKey: 'company_id',  as: 'company' });

// Proveedores y Productos
Supplier.belongsTo(Company,       { foreignKey: 'company_id',  as: 'company' });
Product.belongsTo(Company,        { foreignKey: 'company_id',  as: 'company' });
Supplier.belongsToMany(Product,   { through: SupplierProduct, foreignKey: 'supplier_id', otherKey: 'product_id', as: 'products' });
Product.belongsToMany(Supplier,   { through: SupplierProduct, foreignKey: 'product_id',  otherKey: 'supplier_id', as: 'suppliers' });
SupplierProduct.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
SupplierProduct.belongsTo(Product,  { foreignKey: 'product_id',  as: 'product' });
PriceHistory.belongsTo(Supplier,  { foreignKey: 'supplier_id', as: 'supplier' });
PriceHistory.belongsTo(Product,   { foreignKey: 'product_id',  as: 'product' });

// Proyectos
Project.belongsTo(Company, { foreignKey: 'company_id',   as: 'company' });
Project.belongsTo(Client,  { foreignKey: 'client_id',    as: 'client' });
Project.belongsTo(User,    { foreignKey: 'assigned_user_id', as: 'assignedUser' });
Project.hasMany(Proforma,  { foreignKey: 'project_id',   as: 'proformas' });
Project.hasOne(Contract,   { foreignKey: 'project_id',   as: 'contract' });
Project.hasOne(ProjectLiquidation, { foreignKey: 'project_id', as: 'liquidation' });
Project.hasMany(Work,      { foreignKey: 'project_id',   as: 'works' });

// Proformas
Proforma.belongsTo(Project,  { foreignKey: 'project_id',  as: 'project' });
Proforma.belongsTo(User,     { foreignKey: 'created_by',  as: 'creator' });
Proforma.hasMany(ProformaItem,{ foreignKey: 'proforma_id', as: 'items' });
ProformaItem.belongsTo(Proforma, { foreignKey: 'proforma_id', as: 'proforma' });

// Contratos
Contract.belongsTo(Project,  { foreignKey: 'project_id',  as: 'project' });
Contract.belongsTo(Proforma, { foreignKey: 'proforma_id', as: 'proforma' });
Contract.hasMany(ContractAddendum, { foreignKey: 'contract_id', as: 'addendums' });

// Obras
Work.belongsTo(Company,  { foreignKey: 'company_id',      as: 'company' });
Work.belongsTo(Project,  { foreignKey: 'project_id',      as: 'project' });
Work.belongsTo(Client,   { foreignKey: 'client_id',       as: 'client' });
Work.belongsTo(User,     { foreignKey: 'assigned_user_id',as: 'assignedUser' });
Work.hasMany(WorkItem,   { foreignKey: 'work_id',         as: 'items' });
Work.hasMany(DailyReport,{ foreignKey: 'work_id',         as: 'dailyReports' });
Work.hasMany(Subcontract,{ foreignKey: 'work_id',         as: 'subcontracts' });
Work.hasMany(ScheduleTask,{ foreignKey: 'work_id',        as: 'scheduleTasks' });
Work.hasOne(Warehouse,   { foreignKey: 'work_id',         as: 'warehouse' });

// WorkItems
WorkItem.belongsTo(Work,         { foreignKey: 'work_id',         as: 'work' });
WorkItem.belongsTo(CatalogRubro, { foreignKey: 'catalog_rubro_id',as: 'catalogRubro' });
WorkItem.hasMany(WorkItemProforma,{ foreignKey: 'work_item_id',   as: 'proformas' });

// Reportes diarios
DailyReport.belongsTo(Work, { foreignKey: 'work_id',     as: 'work' });
DailyReport.belongsTo(User, { foreignKey: 'created_by',  as: 'creator' });
DailyReport.hasMany(ReportContractor,{ foreignKey: 'daily_report_id', as: 'contractors' });
DailyReport.hasMany(ReportPurchase,  { foreignKey: 'daily_report_id', as: 'purchases' });
DailyReport.hasMany(ReportPhoto,     { foreignKey: 'daily_report_id', as: 'photos' });
ReportPurchase.belongsTo(DailyReport,{ foreignKey: 'daily_report_id', as: 'report' });
ReportPurchase.belongsTo(Work,       { foreignKey: 'work_id',         as: 'work' });
ReportPurchase.belongsTo(Product,    { foreignKey: 'product_id',      as: 'product' });

// Subcontratos
Subcontract.belongsTo(Work,     { foreignKey: 'work_id',    as: 'work' });
Subcontract.belongsTo(Supplier, { foreignKey: 'supplier_id',as: 'supplier' });
Subcontract.hasMany(SubcontractPayment, { foreignKey: 'subcontract_id', as: 'payments' });

// Cronograma
ScheduleTask.belongsTo(Work,         { foreignKey: 'work_id',      as: 'work' });
ScheduleTask.belongsTo(ScheduleTask, { foreignKey: 'parent_task_id',as: 'parentTask' });
ScheduleTask.hasMany(ScheduleTask,   { foreignKey: 'parent_task_id',as: 'subtasks' });
ProgressSnapshot.belongsTo(Work,     { foreignKey: 'work_id',      as: 'work' });
ProgressCertificate.belongsTo(Work,  { foreignKey: 'work_id',      as: 'work' });

// Compras
PurchaseRequest.belongsTo(Work,    { foreignKey: 'work_id',    as: 'work' });
PurchaseRequest.belongsTo(User,    { foreignKey: 'created_by', as: 'creator' });
PurchaseRequest.hasMany(PurchaseRequestItem, { foreignKey: 'purchase_request_id', as: 'items' });
PurchaseRequestItem.belongsTo(PurchaseRequest, { foreignKey: 'purchase_request_id', as: 'request' });
PurchaseRequestItem.belongsTo(Product,  { foreignKey: 'product_id',  as: 'product' });
PurchaseRequestItem.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
PurchaseOrder.belongsTo(Supplier,  { foreignKey: 'supplier_id',as: 'supplier' });
PurchaseOrder.belongsTo(Work,      { foreignKey: 'work_id',    as: 'work' });
PurchaseOrder.belongsTo(PurchaseRequest, { foreignKey: 'purchase_request_id', as: 'request' });
PurchaseOrder.hasMany(PurchaseOrderItem, { foreignKey: 'purchase_order_id', as: 'items' });
PurchaseOrderItem.belongsTo(PurchaseOrder, { foreignKey: 'purchase_order_id', as: 'order' });
PurchaseOrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
PurchaseInvoice.belongsTo(Supplier,{ foreignKey: 'supplier_id',as: 'supplier' });
PurchaseInvoice.belongsTo(Work,    { foreignKey: 'work_id',    as: 'work' });
PurchaseInvoice.belongsTo(PurchaseOrder, { foreignKey: 'purchase_order_id', as: 'order' });

// Bodega
Warehouse.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
Warehouse.belongsTo(Work,    { foreignKey: 'work_id',    as: 'work' });
Warehouse.hasMany(WarehouseItem, { foreignKey: 'warehouse_id', as: 'items' });
WarehouseItem.belongsTo(Warehouse,{ foreignKey: 'warehouse_id', as: 'warehouse' });
WarehouseItem.belongsTo(Product,  { foreignKey: 'product_id',  as: 'product' });
InventoryMovement.belongsTo(Product,  { foreignKey: 'product_id',         as: 'product' });
InventoryMovement.belongsTo(Warehouse,{ foreignKey: 'from_warehouse_id',  as: 'fromWarehouse' });
InventoryMovement.belongsTo(Warehouse,{ foreignKey: 'to_warehouse_id',    as: 'toWarehouse' });
InventoryMovement.belongsTo(Work,     { foreignKey: 'work_id',            as: 'work' });
InventoryMovement.belongsTo(Work,     { foreignKey: 'origin_work_id',     as: 'originWork' });
WarehouseSaving.belongsTo(Work,       { foreignKey: 'work_id',            as: 'work' });
WarehouseSaving.belongsTo(Product,    { foreignKey: 'product_id',         as: 'product' });

// Finanzas
FinancialTransaction.belongsTo(Work,    { foreignKey: 'work_id',    as: 'work' });
FinancialTransaction.belongsTo(User,    { foreignKey: 'recorded_by',as: 'recordedBy' });
FinancialTransaction.belongsTo(Supplier,{ foreignKey: 'supplier_id',as: 'supplier' });

module.exports = {
  sequelize,
  Company, Role, User, RefreshToken, Client,
  RubroCategory, CatalogRubro,
  Supplier, Product, SupplierProduct, PriceHistory,
  Project, Proforma, ProformaItem, Contract, ContractAddendum, ProjectLiquidation,
  Work, WorkItem, WorkItemProforma, DailyReport, ReportContractor,
  ReportPurchase, ReportPhoto, Subcontract, SubcontractPayment,
  ScheduleTask, ProgressSnapshot, ProgressCertificate,
  PurchaseRequest, PurchaseRequestItem, PurchaseOrder, PurchaseOrderItem, PurchaseInvoice,
  Warehouse, WarehouseItem, InventoryMovement, WarehouseSaving,
  FinancialTransaction, File, Alert, AuditLog,
};
