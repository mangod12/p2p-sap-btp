const cds = require('@sap/cds');

/**
 * P2P Service implementation.
 *
 * Each action advances a document through its lifecycle and writes an entry
 * to the ProcessFlow audit table so the "Track Process Flow" screen can
 * visualise the end-to-end journey.
 */
module.exports = cds.service.impl(async function () {

  const {
    PurchaseRequisitions,
    PurchaseOrders,
    GoodsReceipts,
    Invoices,
    Payments,
    ProcessFlow
  } = this.entities;

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Generate the next document number using MAX + 1 pattern.
   * Falls back to 1001 if no rows exist yet.
   */
  const nextNumber = async (prefix, entity, field) => {
    const col = field || `${prefix.toLowerCase()}Number`;
    // Extract the numeric suffix from existing numbers like "PR-1005"
    const rows = await SELECT.from(entity).columns(col);
    let max = 1000;
    for (const row of rows) {
      const val = row[col];
      if (val) {
        const num = parseInt(val.split('-').pop(), 10);
        if (!isNaN(num) && num > max) max = num;
      }
    }
    return `${prefix}-${max + 1}`;
  };

  const logFlow = (tx, req, entityType, row, fromStatus, toStatus, remarks) =>
    tx.run(INSERT.into(ProcessFlow).entries({
      entityType,
      entityId:     row.ID,
      entityNumber: row.prNumber || row.poNumber || row.grNumber || row.invoiceNumber || row.paymentNumber,
      fromStatus,
      toStatus,
      actor:        req.user.id,
      remarks
    }));

  // -------------------------------------------------------------------------
  // Input validation on CREATE
  // -------------------------------------------------------------------------
  this.before('CREATE', 'PurchaseRequisitions', async (req) => {
    if (!req.data.prNumber) req.data.prNumber = await nextNumber('PR', PurchaseRequisitions, 'prNumber');
    if (!req.data.status)   req.data.status = 'Draft';

    if (!req.data.materialName || !req.data.materialName.trim()) {
      return req.error(400, 'Material name is required', 'materialName');
    }
    if (!req.data.quantity || req.data.quantity <= 0) {
      return req.error(400, 'Quantity must be greater than zero', 'quantity');
    }
  });

  this.before('CREATE', 'PurchaseOrders', async (req) => {
    if (!req.data.poNumber) req.data.poNumber = await nextNumber('PO', PurchaseOrders, 'poNumber');
    if (!req.data.status)   req.data.status = 'Open';

    if (!req.data.quantity || req.data.quantity <= 0) {
      return req.error(400, 'Quantity must be greater than zero', 'quantity');
    }
    if (req.data.quantity && req.data.unitPrice) {
      req.data.totalAmount = Number(req.data.quantity) * Number(req.data.unitPrice);
    }
  });

  this.before('CREATE', 'GoodsReceipts', async (req) => {
    if (!req.data.grNumber) req.data.grNumber = await nextNumber('GR', GoodsReceipts, 'grNumber');
    if (!req.data.status)   req.data.status = 'Pending';

    if (!req.data.quantityReceived || req.data.quantityReceived <= 0) {
      return req.error(400, 'Received quantity must be greater than zero', 'quantityReceived');
    }
    if (req.data.po_ID && !req.data.quantityOrdered) {
      const po = await SELECT.one.from(PurchaseOrders).where({ ID: req.data.po_ID });
      if (po) {
        req.data.quantityOrdered = po.quantity;
        req.data.poNumber = po.poNumber;
      }
    }
  });

  this.before('CREATE', 'Invoices', async (req) => {
    if (!req.data.invoiceNumber) req.data.invoiceNumber = await nextNumber('INV', Invoices, 'invoiceNumber');
    if (!req.data.status)        req.data.status = 'Pending';

    if (!req.data.amount || req.data.amount <= 0) {
      return req.error(400, 'Invoice amount must be greater than zero', 'amount');
    }
    if (req.data.po_ID) {
      const po = await SELECT.one.from(PurchaseOrders).where({ ID: req.data.po_ID });
      if (po) {
        req.data.poNumber = req.data.poNumber || po.poNumber;
        req.data.vendorName = req.data.vendorName || po.vendorName;
        if (!req.data.amount) req.data.amount = po.totalAmount;
      }
    }
  });

  this.before('CREATE', 'Payments', async (req) => {
    if (!req.data.paymentNumber) req.data.paymentNumber = await nextNumber('PAY', Payments, 'paymentNumber');
    if (!req.data.status)        req.data.status = 'Scheduled';

    if (!req.data.amount || req.data.amount <= 0) {
      return req.error(400, 'Payment amount must be greater than zero', 'amount');
    }
    if (req.data.invoice_ID) {
      const inv = await SELECT.one.from(Invoices).where({ ID: req.data.invoice_ID });
      if (inv) {
        req.data.invoiceNumber = req.data.invoiceNumber || inv.invoiceNumber;
        if (!req.data.amount) req.data.amount = inv.amount;
      }
    }
  });

  // -------------------------------------------------------------------------
  // PR actions
  // -------------------------------------------------------------------------
  this.on('submit', 'PurchaseRequisitions', async (req) => {
    const tx = cds.tx(req);
    const pr = await tx.run(SELECT.one.from(req.subject));
    if (!pr) return req.error(404, 'Purchase Requisition not found');
    if (pr.status !== 'Draft') {
      return req.error(400, `Cannot submit: PR ${pr.prNumber} is in status "${pr.status}" (expected "Draft")`);
    }
    await tx.run(UPDATE(PurchaseRequisitions).set({ status: 'Submitted' }).where({ ID: pr.ID }));
    await logFlow(tx, req, 'PR', pr, 'Draft', 'Submitted', 'PR submitted for approval');
    return { ...pr, status: 'Submitted' };
  });

  this.on('approve', 'PurchaseRequisitions', async (req) => {
    const tx = cds.tx(req);
    const pr = await tx.run(SELECT.one.from(req.subject));
    if (!pr) return req.error(404, 'Purchase Requisition not found');
    if (!['Submitted', 'Draft'].includes(pr.status)) {
      return req.error(400, `Cannot approve: PR ${pr.prNumber} is in status "${pr.status}" (expected "Submitted" or "Draft")`);
    }
    await tx.run(UPDATE(PurchaseRequisitions).set({ status: 'Approved' }).where({ ID: pr.ID }));
    await logFlow(tx, req, 'PR', pr, pr.status, 'Approved', 'PR approved');
    return { ...pr, status: 'Approved' };
  });

  this.on('rejectPR', 'PurchaseRequisitions', async (req) => {
    const tx = cds.tx(req);
    const pr = await tx.run(SELECT.one.from(req.subject));
    if (!pr) return req.error(404, 'Purchase Requisition not found');
    if (pr.status === 'Rejected' || pr.status === 'Converted') {
      return req.error(400, `Cannot reject: PR ${pr.prNumber} is already "${pr.status}"`);
    }
    const reason = req.data.reason;
    if (!reason || !reason.trim()) {
      return req.error(400, 'A rejection reason is required');
    }
    await tx.run(UPDATE(PurchaseRequisitions).set({ status: 'Rejected' }).where({ ID: pr.ID }));
    await logFlow(tx, req, 'PR', pr, pr.status, 'Rejected', reason);
    return { ...pr, status: 'Rejected' };
  });

  this.on('convertToPO', 'PurchaseRequisitions', async (req) => {
    const tx = cds.tx(req);
    const pr = await tx.run(SELECT.one.from(req.subject));
    if (!pr) return req.error(404, 'Purchase Requisition not found');
    if (pr.status !== 'Approved') {
      return req.error(400, `Cannot convert: PR ${pr.prNumber} must be "Approved" (currently "${pr.status}")`);
    }

    // Pull unit price off the material
    const mat = pr.material_ID
      ? await tx.run(SELECT.one.from('p2p.Materials').where({ ID: pr.material_ID }))
      : null;
    const unitPrice = mat ? Number(mat.unitPrice) : 0;
    const total = unitPrice * Number(pr.quantity);

    const poNumber = await nextNumber('PO', PurchaseOrders, 'poNumber');
    const po = {
      ID: cds.utils.uuid(),
      poNumber,
      pr_ID: pr.ID,
      vendor_ID: pr.vendor_ID,
      vendorName: pr.vendorName,
      material_ID: pr.material_ID,
      materialName: pr.materialName,
      quantity: pr.quantity,
      unitPrice,
      totalAmount: total,
      status: 'Open'
    };
    await tx.run(INSERT.into(PurchaseOrders).entries(po));
    await tx.run(UPDATE(PurchaseRequisitions).set({ status: 'Converted', po_ID: po.ID }).where({ ID: pr.ID }));
    await logFlow(tx, req, 'PR', pr, pr.status, 'Converted', `Converted to ${poNumber}`);
    await logFlow(tx, req, 'PO', po, null, 'Open', `Created from ${pr.prNumber}`);
    return po;
  });

  // -------------------------------------------------------------------------
  // PO actions
  // -------------------------------------------------------------------------
  this.on('sendToVendor', 'PurchaseOrders', async (req) => {
    const tx = cds.tx(req);
    const po = await tx.run(SELECT.one.from(req.subject));
    if (!po) return req.error(404, 'Purchase Order not found');
    if (po.status !== 'Open') {
      return req.error(400, `Cannot send: PO ${po.poNumber} is in status "${po.status}" (expected "Open")`);
    }
    await tx.run(UPDATE(PurchaseOrders).set({ status: 'Sent' }).where({ ID: po.ID }));
    await logFlow(tx, req, 'PO', po, 'Open', 'Sent', 'PO dispatched to vendor');
    return { ...po, status: 'Sent' };
  });

  this.on('cancel', 'PurchaseOrders', async (req) => {
    const tx = cds.tx(req);
    const po = await tx.run(SELECT.one.from(req.subject));
    if (!po) return req.error(404, 'Purchase Order not found');
    if (po.status === 'Cancelled') {
      return req.error(400, `PO ${po.poNumber} is already cancelled`);
    }
    if (po.status === 'Received') {
      return req.error(400, `Cannot cancel: PO ${po.poNumber} has already been fully received`);
    }
    await tx.run(UPDATE(PurchaseOrders).set({ status: 'Cancelled' }).where({ ID: po.ID }));
    await logFlow(tx, req, 'PO', po, po.status, 'Cancelled', 'PO cancelled');
    return { ...po, status: 'Cancelled' };
  });

  // -------------------------------------------------------------------------
  // GR actions (plus cascade to PO status)
  // -------------------------------------------------------------------------
  this.on('complete', 'GoodsReceipts', async (req) => {
    const tx = cds.tx(req);
    const gr = await tx.run(SELECT.one.from(req.subject));
    if (!gr) return req.error(404, 'Goods Receipt not found');
    if (gr.status === 'Completed') {
      return req.error(400, `GR ${gr.grNumber} is already completed`);
    }
    await tx.run(UPDATE(GoodsReceipts).set({ status: 'Completed' }).where({ ID: gr.ID }));
    await logFlow(tx, req, 'GR', gr, 'Pending', 'Completed', `Received ${gr.quantityReceived} units`);

    if (gr.po_ID) {
      const po = await tx.run(SELECT.one.from(PurchaseOrders).where({ ID: gr.po_ID }));
      if (po) {
        const newPoStatus =
          Number(gr.quantityReceived) >= Number(po.quantity) ? 'Received' : 'PartiallyReceived';
        await tx.run(UPDATE(PurchaseOrders).set({ status: newPoStatus }).where({ ID: po.ID }));
        await logFlow(tx, req, 'PO', po, po.status, newPoStatus, `Goods receipt ${gr.grNumber}`);
      }
    }
    return { ...gr, status: 'Completed' };
  });

  // -------------------------------------------------------------------------
  // Invoice actions
  // -------------------------------------------------------------------------
  this.on('verify', 'Invoices', async (req) => {
    const tx = cds.tx(req);
    const inv = await tx.run(SELECT.one.from(req.subject));
    if (!inv) return req.error(404, 'Invoice not found');
    if (inv.status !== 'Pending') {
      return req.error(400, `Cannot verify: Invoice ${inv.invoiceNumber} is in status "${inv.status}" (expected "Pending")`);
    }
    await tx.run(UPDATE(Invoices).set({
      status: 'Verified',
      verifiedBy: req.user.id
    }).where({ ID: inv.ID }));
    await logFlow(tx, req, 'Invoice', inv, 'Pending', 'Verified', 'Invoice verified');
    return { ...inv, status: 'Verified' };
  });

  this.on('rejectInvoice', 'Invoices', async (req) => {
    const tx = cds.tx(req);
    const inv = await tx.run(SELECT.one.from(req.subject));
    if (!inv) return req.error(404, 'Invoice not found');
    if (inv.status === 'Paid') {
      return req.error(400, `Cannot reject: Invoice ${inv.invoiceNumber} has already been paid`);
    }
    const reason = req.data.reason;
    if (!reason || !reason.trim()) {
      return req.error(400, 'A rejection reason is required');
    }
    await tx.run(UPDATE(Invoices).set({ status: 'Rejected' }).where({ ID: inv.ID }));
    await logFlow(tx, req, 'Invoice', inv, inv.status, 'Rejected', reason);
    return { ...inv, status: 'Rejected' };
  });

  // -------------------------------------------------------------------------
  // Payment actions (cascade to invoice)
  // -------------------------------------------------------------------------
  this.on('process', 'Payments', async (req) => {
    const tx = cds.tx(req);
    const pay = await tx.run(SELECT.one.from(req.subject));
    if (!pay) return req.error(404, 'Payment not found');
    if (pay.status === 'Completed') {
      return req.error(400, `Payment ${pay.paymentNumber} has already been completed`);
    }
    if (pay.status === 'Failed') {
      return req.error(400, `Payment ${pay.paymentNumber} has failed — create a new payment instead`);
    }

    await tx.run(UPDATE(Payments).set({
      status: 'Completed',
      processedBy: req.user.id,
      reference: pay.reference || `TXN-${Date.now()}`
    }).where({ ID: pay.ID }));
    await logFlow(tx, req, 'Payment', pay, pay.status, 'Completed', `Paid ${pay.amount}`);

    if (pay.invoice_ID) {
      const inv = await tx.run(SELECT.one.from(Invoices).where({ ID: pay.invoice_ID }));
      if (inv) {
        await tx.run(UPDATE(Invoices).set({ status: 'Paid' }).where({ ID: inv.ID }));
        await logFlow(tx, req, 'Invoice', inv, inv.status, 'Paid', `Settled by ${pay.paymentNumber}`);
      }
    }
    return { ...pay, status: 'Completed' };
  });

  // -------------------------------------------------------------------------
  // KPI function for launchpad tiles
  // -------------------------------------------------------------------------
  this.on('getKPIs', async () => {
    const [prs, pos, grs, invs, pays, spendRow] = await Promise.all([
      SELECT.one`count(*) as c`.from(PurchaseRequisitions).where({ status: { in: ['Draft', 'Submitted'] } }),
      SELECT.one`count(*) as c`.from(PurchaseOrders).where({ status: { in: ['Open', 'Sent', 'PartiallyReceived'] } }),
      SELECT.one`count(*) as c`.from(GoodsReceipts).where({ status: 'Pending' }),
      SELECT.one`count(*) as c`.from(Invoices).where({ status: { in: ['Pending', 'Verified'] } }),
      SELECT.one`count(*) as c`.from(Payments).where({ status: { in: ['Scheduled', 'Processing'] } }),
      SELECT.one`sum(totalAmount) as s`.from(PurchaseOrders).where({ status: { '!=': 'Cancelled' } })
    ]);
    return {
      openPRs:          (prs && prs.c)  || 0,
      openPOs:          (pos && pos.c)  || 0,
      pendingGRs:       (grs && grs.c)  || 0,
      pendingInvoices:  (invs && invs.c) || 0,
      scheduledPayments:(pays && pays.c) || 0,
      totalSpend:       (spendRow && spendRow.s) || 0
    };
  });
});
