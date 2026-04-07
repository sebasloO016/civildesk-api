/**
 * CIVILDESK — PDF Service
 * Genera PDFs profesionales con Puppeteer
 */

const puppeteer = require('puppeteer');

let browser = null;
const getBrowser = async () => {
  if (browser) {
    try {
      // Verificar que el browser sigue vivo
      await browser.pages();
    } catch {
      browser = null;
    }
  }
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    // Limpiar referencia si el browser se cierra inesperadamente
    browser.on('disconnected', () => { browser = null; });
  }
  return browser;
};

const htmlToPdf = async (html) => {
  const b    = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({
      format:          'A4',
      printBackground: true,
      margin: { top: '20mm', right: '18mm', bottom: '20mm', left: '18mm' },
    });
    return buffer;
  } finally {
    await page.close();
  }
};

const BASE_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, -apple-system, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.5; }
  .header { background: #0B1E33; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; }
  .header-logo { color: white; font-size: 18pt; font-weight: 700; }
  .header-logo span { color: #F0A500; }
  .header-right { text-align: right; color: #8AAEC8; font-size: 8pt; }
  .header-right strong { color: white; font-size: 10pt; display: block; margin-bottom: 2px; }
  .company-strip { background: #1A3D5E; padding: 10px 24px; color: #C8DFF5; font-size: 8pt; display: flex; justify-content: space-between; }
  .doc-title-section { padding: 20px 24px 12px; border-bottom: 2px solid #F0A500; margin-bottom: 16px; }
  .doc-title { font-size: 16pt; font-weight: 700; color: #0B1E33; }
  .doc-number { font-size: 9pt; color: #555; margin-top: 3px; }
  .doc-meta { display: flex; gap: 24px; margin-top: 10px; }
  .doc-meta-label { font-size: 7.5pt; color: #888; text-transform: uppercase; }
  .doc-meta-value { font-size: 9pt; font-weight: 600; color: #1a1a1a; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 0 24px 16px; }
  .party-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px; }
  .party-label { font-size: 7.5pt; font-weight: 600; color: #1E5C8E; text-transform: uppercase; margin-bottom: 6px; }
  .party-name { font-size: 11pt; font-weight: 700; color: #0B1E33; }
  .party-detail { font-size: 8.5pt; color: #555; margin-top: 2px; }
  .section { padding: 0 24px 16px; }
  .section-title { font-size: 10pt; font-weight: 700; color: #0B1E33; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #E2E8F0; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  thead tr { background: #0B1E33; color: white; }
  thead th { padding: 8px 10px; text-align: left; font-weight: 600; font-size: 8pt; }
  tbody tr { border-bottom: 1px solid #F1F5F9; }
  tbody tr:nth-child(even) { background: #F8FAFC; }
  tbody td { padding: 7px 10px; }
  tfoot tr { background: #0B1E33; color: white; }
  tfoot td { padding: 8px 10px; font-weight: 600; }
  tfoot td:last-child { text-align: right; font-size: 12pt; }
  .totals-box { margin: 0 24px 16px; display: flex; justify-content: flex-end; }
  .totals-table { width: 280px; }
  .totals-table tr td { padding: 5px 10px; font-size: 9pt; }
  .totals-table tr td:last-child { text-align: right; font-weight: 600; }
  .totals-table tr.total-final { background: #0B1E33; color: white; }
  .totals-table tr.total-final td { padding: 8px 10px; font-size: 11pt; }
  .totals-table tr.highlight td { background: #FFF8E0; color: #0B1E33; }
  .conditions { padding: 0 24px 16px; }
  .conditions p { font-size: 8.5pt; color: #444; margin-bottom: 6px; text-align: justify; }
  .clause { margin-bottom: 10px; }
  .signatures { margin: 24px 24px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .sig-block { border-top: 1.5px solid #0B1E33; padding-top: 8px; }
  .sig-name { font-size: 9pt; font-weight: 700; color: #0B1E33; }
  .sig-title { font-size: 8pt; color: #555; }
  .sig-date { font-size: 8pt; color: #888; margin-top: 4px; }
  .sig-space { height: 40px; }
  .footer { margin-top: 20px; padding: 10px 24px; background: #F8FAFC; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; font-size: 7.5pt; color: #999; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 7.5pt; font-weight: 600; }
  .badge-approved { background: #DCFCE7; color: #166534; }
  .badge-signed { background: #DBEAFE; color: #1E40AF; }
  .alert-box { margin: 0 24px 16px; padding: 10px 14px; border-radius: 6px; font-size: 8.5pt; }
  .alert-info { background: #EFF6FF; border-left: 3px solid #3B82F6; color: #1E40AF; }
  .progress-bar { background: #E2E8F0; border-radius: 4px; height: 8px; overflow: hidden; }
  .progress-fill { height: 100%; background: #10B981; border-radius: 4px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

const fmt = (n) => {
  if (n == null || isNaN(n)) return '$0.00';
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
};
const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(d)); }
  catch { return String(d); }
};
const fmtNum = (n, dec = 2) => n != null ? parseFloat(n).toFixed(dec) : '0.00';

// ── 1. PROFORMA ──────────────────────────────────────────────
const generateProformaPdf = async ({ proforma, project, client, company, items }) => {
  const itemRows = items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.description}</td>
      <td style="text-align:center">${item.unit}</td>
      <td style="text-align:right">${fmtNum(item.quantity)}</td>
      <td style="text-align:right">${fmt(item.unit_price)}</td>
      <td style="text-align:right;font-weight:600">${fmt(item.total || item.quantity * item.unit_price)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>${BASE_STYLES}</style></head><body>
  <div class="header">
    <div class="header-logo">Civil<span>Desk</span></div>
    <div class="header-right">
      <strong>${company.name}</strong>
      ${company.ruc ? `RUC: ${company.ruc}` : ''}<br>
      ${company.phone || ''} · ${company.email || ''}
    </div>
  </div>
  <div class="company-strip">
    <span>${company.address || ''} · ${company.city || ''}</span>
    <span>Fecha: ${fmtDate(new Date())}</span>
  </div>
  <div class="doc-title-section">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div class="doc-title">PROFORMA</div>
        <div class="doc-number">N° ${String(proforma.id).padStart(4,'0')} · Versión ${proforma.version}</div>
      </div>
      <span class="badge badge-approved">${proforma.status}</span>
    </div>
    <div class="doc-meta">
      <div><div class="doc-meta-label">Proyecto</div><div class="doc-meta-value">${project.name}</div></div>
      <div><div class="doc-meta-label">Válida hasta</div><div class="doc-meta-value">${fmtDate(proforma.valid_until)}</div></div>
      <div><div class="doc-meta-label">Creada</div><div class="doc-meta-value">${fmtDate(proforma.created_at)}</div></div>
    </div>
  </div>
  <div class="parties">
    <div class="party-card">
      <div class="party-label">Contratista</div>
      <div class="party-name">${company.name}</div>
      <div class="party-detail">RUC: ${company.ruc || '—'}</div>
      <div class="party-detail">${company.address || ''}</div>
      <div class="party-detail">${company.phone || ''} · ${company.email || ''}</div>
    </div>
    <div class="party-card">
      <div class="party-label">Cliente</div>
      <div class="party-name">${client.name}</div>
      <div class="party-detail">RUC/Cédula: ${client.ruc_cedula || '—'}</div>
      <div class="party-detail">${client.address || ''}</div>
      <div class="party-detail">${client.phone || ''} · ${client.email || ''}</div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Detalle de Rubros</div>
    <table>
      <thead>
        <tr>
          <th style="width:30px">#</th>
          <th>Descripción</th>
          <th style="width:60px;text-align:center">Unidad</th>
          <th style="width:70px;text-align:right">Cantidad</th>
          <th style="width:90px;text-align:right">P. Unitario</th>
          <th style="width:100px;text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>
  <div class="totals-box">
    <table class="totals-table">
      <tr><td>Subtotal</td><td>${fmt(proforma.subtotal)}</td></tr>
      <tr class="highlight"><td>Utilidad (${proforma.utility_pct}%)</td><td>${fmt(proforma.utility_amount)}</td></tr>
      <tr class="highlight"><td>Imprevistos (${proforma.contingency_pct}%)</td><td>${fmt(proforma.contingency_amt)}</td></tr>
      <tr class="total-final"><td>TOTAL</td><td>${fmt(proforma.total)}</td></tr>
    </table>
  </div>
  <div class="conditions">
    <div class="section-title" style="padding:0 0 4px;margin:0 24px 8px">Condiciones Generales</div>
    <div class="clause"><p>• Esta proforma tiene validez hasta <strong>${fmtDate(proforma.valid_until)}</strong>.</p></div>
    <div class="clause"><p>• Los precios incluyen mano de obra, materiales y dirección técnica según se detalla.</p></div>
    <div class="clause"><p>• Cualquier trabajo adicional será presupuestado por separado.</p></div>
    ${proforma.notes ? `<div class="clause"><p><strong>Notas:</strong> ${proforma.notes}</p></div>` : ''}
  </div>
  <div class="signatures">
    <div class="sig-block">
      <div class="sig-space"></div>
      <div class="sig-name">${company.name}</div>
      <div class="sig-title">Contratista</div>
    </div>
    <div class="sig-block">
      <div class="sig-space"></div>
      <div class="sig-name">${client.name}</div>
      <div class="sig-title">Cliente — Acepta proforma</div>
      <div class="sig-date">Fecha: _________________</div>
    </div>
  </div>
  <div class="footer">
    <span>CivilDesk — Sistema de Gestión para Ingeniería Civil</span>
    <span>Generado el ${fmtDate(new Date())}</span>
  </div>
  </body></html>`;

  return htmlToPdf(html);
};

// ── 2. CONTRATO ──────────────────────────────────────────────
const generateContractPdf = async ({ contract, project, client, company, addendums = [] }) => {
  const addendumRows = addendums.map(a => `
    <tr><td>${fmtDate(a.created_at)}</td><td>${a.description}</td><td style="text-align:right">${fmt(a.amount)}</td></tr>
  `).join('');

  const totalWithAddendums = parseFloat(contract.contracted_amount || 0) +
    addendums.reduce((s, a) => s + parseFloat(a.amount || 0), 0);

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>${BASE_STYLES}</style></head><body>
  <div class="header">
    <div class="header-logo">Civil<span>Desk</span></div>
    <div class="header-right">
      <strong>${company.name}</strong>
      RUC: ${company.ruc || '—'}<br>${company.phone || ''} · ${company.email || ''}
    </div>
  </div>
  <div class="company-strip">
    <span>${company.address || ''} · ${company.city || ''}, Ecuador</span>
    <span>Contrato N° ${contract.contract_number || '—'}</span>
  </div>
  <div class="doc-title-section">
    <div class="doc-title">CONTRATO DE SERVICIOS DE CONSTRUCCIÓN</div>
    <div class="doc-number">N° ${contract.contract_number || '—'}</div>
    <div class="doc-meta">
      <div><div class="doc-meta-label">Fecha inicio</div><div class="doc-meta-value">${fmtDate(contract.start_date)}</div></div>
      <div><div class="doc-meta-label">Fecha fin</div><div class="doc-meta-value">${fmtDate(contract.end_date)}</div></div>
      <div><div class="doc-meta-label">Valor total</div><div class="doc-meta-value" style="color:#F0A500;font-size:13pt">${fmt(contract.contracted_amount)}</div></div>
      <div><div class="doc-meta-label">Estado</div><div class="doc-meta-value"><span class="badge badge-signed">${contract.status}</span></div></div>
    </div>
  </div>
  <div class="parties">
    <div class="party-card">
      <div class="party-label">Contratista (Prestador)</div>
      <div class="party-name">${company.name}</div>
      <div class="party-detail">RUC: ${company.ruc || '—'}</div>
      <div class="party-detail">${company.address || ''}, ${company.city || ''}</div>
    </div>
    <div class="party-card">
      <div class="party-label">Contratante (Cliente)</div>
      <div class="party-name">${client.name}</div>
      <div class="party-detail">C.I./RUC: ${client.ruc_cedula || '—'}</div>
      <div class="party-detail">${client.address || ''}</div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Cláusulas del Contrato</div>
    <div class="conditions">
      <div class="clause"><p><strong>PRIMERA — OBJETO:</strong> El Contratista se compromete a ejecutar la obra denominada <strong>"${project.name}"</strong>, ubicada en ${project.location || '—'}, conforme a las especificaciones técnicas acordadas.</p></div>
      <div class="clause"><p><strong>SEGUNDA — VALOR Y FORMA DE PAGO:</strong> El valor total es <strong>${fmt(contract.contracted_amount)}</strong>. ${contract.payment_terms || ''}</p></div>
      <div class="clause"><p><strong>TERCERA — PLAZO:</strong> Desde el <strong>${fmtDate(contract.start_date)}</strong> hasta el <strong>${fmtDate(contract.end_date)}</strong>.</p></div>
      <div class="clause"><p><strong>CUARTA — MODIFICACIONES:</strong> Cualquier modificación deberá ser acordada por escrito mediante adenda firmada por ambas partes.</p></div>
      <div class="clause"><p><strong>QUINTA — JURISDICCIÓN:</strong> Las partes se someten a la jurisdicción de los Tribunales de ${company.city || 'Ecuador'}.</p></div>
      ${contract.notes ? `<div class="clause"><p><strong>Notas:</strong> ${contract.notes}</p></div>` : ''}
    </div>
  </div>
  ${addendums.length > 0 ? `
  <div class="section">
    <div class="section-title">Adendas / Trabajos Adicionales</div>
    <table>
      <thead><tr><th>Fecha</th><th>Descripción</th><th style="text-align:right">Monto</th></tr></thead>
      <tbody>${addendumRows}</tbody>
      <tfoot>
        <tr><td colspan="2">Valor contrato original</td><td style="text-align:right">${fmt(contract.contracted_amount)}</td></tr>
        <tr><td colspan="2"><strong>TOTAL ACTUALIZADO</strong></td><td style="text-align:right;font-size:12pt">${fmt(totalWithAddendums)}</td></tr>
      </tfoot>
    </table>
  </div>` : ''}
  <div class="alert-box alert-info">En señal de conformidad, las partes suscriben el presente contrato en dos ejemplares de igual valor y efecto.</div>
  <div class="signatures">
    <div class="sig-block">
      <div class="sig-space"></div>
      <div class="sig-name">${company.name}</div>
      <div class="sig-title">Contratista</div>
      <div class="sig-date">Firma: ___________________</div>
    </div>
    <div class="sig-block">
      <div class="sig-space"></div>
      <div class="sig-name">${client.name}</div>
      <div class="sig-title">Contratante · C.I. ${client.ruc_cedula || '—'}</div>
      <div class="sig-date">Firma: ___________________</div>
      ${contract.client_signed_at ? `<div class="sig-date" style="color:#166534;font-weight:600">✓ Firmado el ${fmtDate(contract.client_signed_at)}</div>` : ''}
    </div>
  </div>
  <div class="footer">
    <span>CivilDesk — Documento generado digitalmente</span>
    <span>${fmtDate(new Date())}</span>
  </div>
  </body></html>`;

  return htmlToPdf(html);
};

// ── 3. ACTA DE LIQUIDACIÓN ───────────────────────────────────
const generateLiquidationPdf = async ({ liquidation, project, client, company, contract, addendums = [] }) => {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>${BASE_STYLES}</style></head><body>
  <div class="header">
    <div class="header-logo">Civil<span>Desk</span></div>
    <div class="header-right">
      <strong>${company.name}</strong>
      RUC: ${company.ruc || '—'}<br>${company.phone || ''}
    </div>
  </div>
  <div class="company-strip">
    <span>${company.address || ''} · ${company.city || ''}</span>
    <span>Acta de Recepción y Liquidación</span>
  </div>
  <div class="doc-title-section">
    <div class="doc-title">ACTA DE RECEPCIÓN Y LIQUIDACIÓN FINAL</div>
    <div class="doc-number">Proyecto: ${project.name}</div>
    <div class="doc-meta">
      <div><div class="doc-meta-label">Fecha</div><div class="doc-meta-value">${fmtDate(liquidation.signed_at || new Date())}</div></div>
      <div><div class="doc-meta-label">Contrato N°</div><div class="doc-meta-value">${contract?.contract_number || '—'}</div></div>
      <div><div class="doc-meta-label">Valor final</div><div class="doc-meta-value" style="color:#F0A500;font-size:13pt">${fmt(liquidation.final_amount)}</div></div>
    </div>
  </div>
  <div class="parties">
    <div class="party-card">
      <div class="party-label">Contratista (Entrega)</div>
      <div class="party-name">${company.name}</div>
      <div class="party-detail">RUC: ${company.ruc || '—'}</div>
    </div>
    <div class="party-card">
      <div class="party-label">Cliente (Recibe)</div>
      <div class="party-name">${liquidation.client_name || client.name}</div>
      <div class="party-detail">C.I.: ${liquidation.client_id_number || client.ruc_cedula || '—'}</div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Resumen Económico Final</div>
    <table>
      <thead><tr><th>Concepto</th><th style="text-align:right">Valor</th></tr></thead>
      <tbody>
        <tr><td>Valor original del contrato</td><td style="text-align:right">${fmt(liquidation.initial_amount)}</td></tr>
        ${liquidation.addendums_total > 0 ? `<tr><td>Total adicionales</td><td style="text-align:right">${fmt(liquidation.addendums_total)}</td></tr>` : ''}
      </tbody>
      <tfoot><tr><td>VALOR FINAL A CANCELAR</td><td>${fmt(liquidation.final_amount)}</td></tr></tfoot>
    </table>
  </div>
  <div class="section">
    <div class="conditions">
      <p>El suscrito <strong>${liquidation.client_name || client.name}</strong>, declara haber recibido a su entera satisfacción la obra denominada <strong>"${project.name}"</strong>, ejecutada por <strong>${company.name}</strong>.</p>
      <p style="margin-top:8px">Con la firma del presente documento, el Contratante declara su conformidad total con los trabajos realizados y el valor final de <strong>${fmt(liquidation.final_amount)}</strong>.</p>
      ${liquidation.notes ? `<p style="margin-top:8px"><strong>Observaciones:</strong> ${liquidation.notes}</p>` : ''}
    </div>
  </div>
  <div class="signatures" style="margin-top:30px">
    <div class="sig-block">
      <div class="sig-space"></div>
      <div class="sig-name">${company.name}</div>
      <div class="sig-title">Contratista — Entrega obra</div>
    </div>
    <div class="sig-block">
      <div class="sig-space"></div>
      <div class="sig-name">${liquidation.client_name || client.name}</div>
      <div class="sig-title">Contratante — Recibe conforme</div>
      ${liquidation.signed_at ? `<div class="sig-date" style="color:#166534;font-weight:600">✓ Firmado el ${fmtDate(liquidation.signed_at)}</div>` : '<div class="sig-date">Firma: ___________________ / Fecha: _______</div>'}
    </div>
  </div>
  <div class="footer">
    <span>CivilDesk — Acta generada digitalmente</span>
    <span>${fmtDate(new Date())}</span>
  </div>
  </body></html>`;

  return htmlToPdf(html);
};

// ── 4. CERTIFICADO DE AVANCE ─────────────────────────────────
const generateCertificatePdf = async ({ certificate, work, client, company, subcontractsTotal = 0, totalObra }) => {
  const pct      = parseFloat(certificate.progress_pct);
  const budget   = parseFloat(work.initial_budget || 0);
  const subTotal = parseFloat(subcontractsTotal || 0);
  const total    = totalObra || (budget + subTotal);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>${BASE_STYLES}</style></head><body>
  <div class="header">
    <div class="header-logo">Civil<span>Desk</span></div>
    <div class="header-right"><strong>${company.name}</strong> RUC: ${company.ruc || '—'}<br>${company.phone || ''}</div>
  </div>
  <div class="company-strip">
    <span>${company.address || ''} · ${company.city || ''}</span>
    <span>Certificado N° ${certificate.certificate_number || '—'}</span>
  </div>
  <div class="doc-title-section">
    <div class="doc-title">CERTIFICADO DE AVANCE DE OBRA</div>
    <div class="doc-number">N° ${certificate.certificate_number || '—'} · Período: ${certificate.period || '—'}</div>
    <div class="doc-meta">
      <div><div class="doc-meta-label">Obra</div><div class="doc-meta-value">${work.name}</div></div>
      <div><div class="doc-meta-label">% Avance</div><div class="doc-meta-value" style="color:#10B981;font-size:16pt;font-weight:800">${pct.toFixed(1)}%</div></div>
      <div><div class="doc-meta-label">Monto a cobrar</div><div class="doc-meta-value" style="color:#F0A500;font-size:13pt">${fmt(certificate.amount_to_bill)}</div></div>
    </div>
  </div>
  <div style="padding:0 24px 20px">
    <div style="font-size:8.5pt;color:#555;margin-bottom:6px">Avance acumulado de obra</div>
    <div class="progress-bar" style="height:16px">
      <div class="progress-fill" style="width:${Math.min(pct,100)}%;background:${pct>=80?'#10B981':pct>=50?'#F59E0B':'#EF4444'}"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:8pt;color:#888;margin-top:4px">
      <span>0%</span><span style="font-weight:700;color:#1a1a1a">${pct.toFixed(1)}% completado</span><span>100%</span>
    </div>
  </div>
  <div class="parties">
    <div class="party-card"><div class="party-label">Contratista</div><div class="party-name">${company.name}</div></div>
    <div class="party-card"><div class="party-label">Cliente</div><div class="party-name">${client?.name || '—'}</div><div class="party-detail">C.I./RUC: ${client?.ruc_cedula || '—'}</div></div>
  </div>
  <div class="section">
    <div class="section-title">Liquidación del Período</div>
    <table>
      <thead><tr><th>Concepto</th><th style="text-align:right">Valor</th></tr></thead>
      <tbody>
<tr><td>Recursos propios (presupuesto obra)</td><td style="text-align:right">${fmt(budget)}</td></tr>
        ${subTotal > 0 ? `<tr><td>Subcontratos</td><td style="text-align:right">${fmt(subTotal)}</td></tr>` : ''}
        <tr style="background:#f8f9fa;font-weight:700"><td>Presupuesto total de la obra</td><td style="text-align:right">${fmt(total)}</td></tr>
        <tr><td>Avance acumulado certificado (${pct.toFixed(1)}%)</td><td style="text-align:right">${fmt(total * pct / 100)}</td></tr>      </tbody>
      <tfoot><tr><td>MONTO A FACTURAR</td><td>${fmt(certificate.amount_to_bill)}</td></tr></tfoot>
    </table>
  </div>
  <div class="signatures">
    <div class="sig-block">
      <div class="sig-space"></div>
      <div class="sig-name">${company.name}</div>
      <div class="sig-title">Director de Obra — Emite certificado</div>
    </div>
    <div class="sig-block">
      <div class="sig-space"></div>
      <div class="sig-name">${client?.name || 'Cliente'}</div>
      <div class="sig-title">Contratante — Aprueba certificado</div>
      <div class="sig-date">Fecha: _________________</div>
    </div>
  </div>
  <div class="footer">
    <span>CivilDesk — Certificado de Avance</span>
    <span>${fmtDate(new Date())}</span>
  </div>
  </body></html>`;

  return htmlToPdf(html);
};

// ── 5. SOLICITUD DE COTIZACIÓN / ORDEN DE COMPRA ─────────────
const generateQuotationRequestPdf = async ({ order, supplier, company, items }) => {
  const itemRows = items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.description}</td>
      <td style="text-align:center">${item.unit || '—'}</td>
      <td style="text-align:right">${fmtNum(item.quantity)}</td>
      <td style="text-align:right">${item.unit_price > 0 ? fmt(item.unit_price) : '—'}</td>
      <td style="text-align:right">${item.unit_price > 0 ? fmt(item.quantity * item.unit_price) : '—'}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>${BASE_STYLES}</style></head><body>
  <div class="header">
    <div class="header-logo">Civil<span>Desk</span></div>
    <div class="header-right"><strong>${company.name}</strong> RUC: ${company.ruc || '—'}<br>${company.phone || ''}</div>
  </div>
  <div class="company-strip">
    <span>${company.address || ''} · ${company.city || ''}</span>
    <span>Orden N° ${order.order_number || '—'} · ${fmtDate(new Date())}</span>
  </div>
  <div class="doc-title-section">
    <div class="doc-title">ORDEN DE COMPRA / SOLICITUD DE COTIZACIÓN</div>
    <div class="doc-number">N° ${order.order_number || '—'}</div>
    <div class="doc-meta">
      <div><div class="doc-meta-label">Fecha</div><div class="doc-meta-value">${fmtDate(new Date())}</div></div>
      <div><div class="doc-meta-label">Entrega requerida</div><div class="doc-meta-value">${fmtDate(order.expected_date)}</div></div>
      <div><div class="doc-meta-label">Total</div><div class="doc-meta-value" style="color:#F0A500">${fmt(order.total)}</div></div>
    </div>
  </div>
  <div class="parties">
    <div class="party-card">
      <div class="party-label">Solicitante</div>
      <div class="party-name">${company.name}</div>
      <div class="party-detail">RUC: ${company.ruc || '—'}</div>
      <div class="party-detail">${company.phone || ''} · ${company.email || ''}</div>
    </div>
    <div class="party-card">
      <div class="party-label">Proveedor</div>
      <div class="party-name">${supplier.name}</div>
      <div class="party-detail">RUC: ${supplier.ruc || '—'}</div>
      <div class="party-detail">Contacto: ${supplier.contact_name || '—'}</div>
      <div class="party-detail">${supplier.phone || ''} · ${supplier.email || ''}</div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Listado de Materiales / Servicios</div>
    <table>
      <thead>
        <tr>
          <th style="width:30px">#</th>
          <th>Descripción</th>
          <th style="width:70px;text-align:center">Unidad</th>
          <th style="width:80px;text-align:right">Cantidad</th>
          <th style="width:100px;text-align:right">P. Unitario</th>
          <th style="width:100px;text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr><td colspan="5">TOTAL</td><td>${fmt(order.total)}</td></tr>
      </tfoot>
    </table>
  </div>
  ${order.notes ? `<div class="section"><div class="conditions"><p><strong>Notas:</strong> ${order.notes}</p></div></div>` : ''}
  <div class="signatures">
    <div class="sig-block">
      <div class="sig-space"></div>
      <div class="sig-name">${company.name}</div>
      <div class="sig-title">Solicitante</div>
    </div>
    <div class="sig-block">
      <div class="sig-space"></div>
      <div class="sig-name">${supplier.name}</div>
      <div class="sig-title">Proveedor — Sello y firma</div>
    </div>
  </div>
  <div class="footer">
    <span>CivilDesk — Orden de Compra</span>
    <span>${fmtDate(new Date())}</span>
  </div>
  </body></html>`;

  return htmlToPdf(html);
};

module.exports = {
  generateProformaPdf,
  generateContractPdf,
  generateLiquidationPdf,
  generateCertificatePdf,
  generateQuotationRequestPdf,
};
