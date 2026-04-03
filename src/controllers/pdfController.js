const {
  generateProformaPdf,
  generateContractPdf,
  generateLiquidationPdf,
  generateCertificatePdf,
  generateQuotationRequestPdf,
} = require('../services/pdf/pdfService');

const {
  Proforma, ProformaItem, Project, Contract, ContractAddendum,
  ProjectLiquidation, Client, Company, Work,
  ProgressCertificate, PurchaseOrder, PurchaseOrderItem, Supplier,
} = require('../models');

const { createError } = require('../middlewares/errorHandler');

const getCompany = async (company_id) => {
  const company = await Company.findByPk(company_id);
  if (!company) throw createError('Empresa no encontrada', 404);
  return company;
};

const streamPdf = (res, buffer, filename) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
};

// ── GET /pdf/proformas/:id ────────────────────────────────────
const proformaPdf = async (req, res, next) => {
  try {
    const proforma = await Proforma.findOne({
      where:   { id: req.params.id, company_id: req.company_id },
      include: [
        { model: ProformaItem, as: 'items' },
        { model: Project, as: 'project',
          include: [{ model: Client, as: 'client' }] },
      ],
    });
    if (!proforma) throw createError('Proforma no encontrada', 404);

    const company = await getCompany(req.company_id);

    const buffer = await generateProformaPdf({
      proforma: proforma.toJSON(),
      project:  proforma.project.toJSON(),
      client:   proforma.project.client.toJSON(),
      company:  company.toJSON(),
      items:    proforma.items.map(i => i.toJSON()),
    });

    streamPdf(res, buffer, `Proforma-${proforma.id}-v${proforma.version}.pdf`);
  } catch (err) { next(err); }
};

// ── GET /pdf/contracts/:projectId ────────────────────────────
const contractPdf = async (req, res, next) => {
  try {
    const contract = await Contract.findOne({
      where:   { project_id: req.params.projectId, company_id: req.company_id },
      include: [
        { model: ContractAddendum, as: 'addendums' },
        { model: Project, as: 'project',
          include: [{ model: Client, as: 'client' }] },
      ],
    });
    if (!contract) throw createError('Contrato no encontrado', 404);

    const company = await getCompany(req.company_id);

    const buffer = await generateContractPdf({
      contract:  contract.toJSON(),
      project:   contract.project.toJSON(),
      client:    contract.project.client.toJSON(),
      company:   company.toJSON(),
      addendums: contract.addendums.map(a => a.toJSON()),
    });

    streamPdf(res, buffer, `Contrato-${contract.contract_number}.pdf`);
  } catch (err) { next(err); }
};

// ── GET /pdf/liquidations/:projectId ─────────────────────────
const liquidationPdf = async (req, res, next) => {
  try {
    const liq = await ProjectLiquidation.findOne({
      where: { project_id: req.params.projectId, company_id: req.company_id },
    });
    if (!liq) throw createError('Liquidación no encontrada', 404);

    const project = await Project.findOne({
      where:   { id: req.params.projectId, company_id: req.company_id },
      include: [
        { model: Client, as: 'client' },
        { model: Contract, as: 'contract',
          include: [{ model: ContractAddendum, as: 'addendums' }] },
      ],
    });

    const company = await getCompany(req.company_id);

    const buffer = await generateLiquidationPdf({
      liquidation: liq.toJSON(),
      project:     project.toJSON(),
      client:      project.client.toJSON(),
      company:     company.toJSON(),
      contract:    project.contract?.toJSON(),
      addendums:   project.contract?.addendums?.map(a => a.toJSON()) || [],
    });

    streamPdf(res, buffer, `Acta-Liquidacion-${project.name.replace(/\s+/g,'-')}.pdf`);
  } catch (err) { next(err); }
};

// ── GET /pdf/certificates/:id ─────────────────────────────────
const certificatePdf = async (req, res, next) => {
  try {
    const cert = await ProgressCertificate.findOne({
      where:   { id: req.params.id, company_id: req.company_id },
      include: [{ model: Work, as: 'work',
        include: [{ model: Client, as: 'client' }] }],
    });
    if (!cert) throw createError('Certificado no encontrado', 404);

    const company = await getCompany(req.company_id);

    const buffer = await generateCertificatePdf({
      certificate: cert.toJSON(),
      work:        cert.work.toJSON(),
      client:      cert.work.client?.toJSON(),
      company:     company.toJSON(),
    });

    streamPdf(res, buffer, `Certificado-Avance-${cert.certificate_number}.pdf`);
  } catch (err) { next(err); }
};

// ── GET /pdf/purchase-orders/:id ──────────────────────────────
const purchaseOrderPdf = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findOne({
      where:   { id: req.params.id, company_id: req.company_id },
      include: [
        { model: Supplier,          as: 'supplier' },
        { model: PurchaseOrderItem, as: 'items' },
      ],
    });
    if (!order) throw createError('Orden de compra no encontrada', 404);

    const company = await getCompany(req.company_id);

    const buffer = await generateQuotationRequestPdf({
      order:    order.toJSON(),
      supplier: order.supplier.toJSON(),
      company:  company.toJSON(),
      items:    order.items.map(i => i.toJSON()),
    });

    streamPdf(res, buffer, `OC-${order.order_number}.pdf`);
  } catch (err) { next(err); }
};

module.exports = { proformaPdf, contractPdf, liquidationPdf, certificatePdf, purchaseOrderPdf };
