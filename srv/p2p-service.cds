using p2p from '../db/schema';

/**
 * Main P2P service — exposes all entities and a set of workflow actions
 * that advance a document through its lifecycle.
 */
@path: '/p2p'
service P2PService @(requires: 'authenticated-user') {

  @(requires: 'ProcurementOfficer')
  entity PurchaseRequisitions as projection on p2p.PurchaseRequisitions actions {
    action submit()  returns PurchaseRequisitions;
    action approve() returns PurchaseRequisitions;
    action rejectPR(reason: String) returns PurchaseRequisitions;
    action convertToPO() returns PurchaseOrders;
  };

  @(requires: 'ProcurementOfficer')
  entity PurchaseOrders       as projection on p2p.PurchaseOrders actions {
    action sendToVendor() returns PurchaseOrders;
    action cancel()       returns PurchaseOrders;
  };

  @(requires: 'WarehouseManager')
  entity GoodsReceipts        as projection on p2p.GoodsReceipts actions {
    action complete() returns GoodsReceipts;
  };

  @(requires: 'FinanceOfficer')
  entity Invoices             as projection on p2p.Invoices actions {
    action verify()  returns Invoices;
    action rejectInvoice(reason: String) returns Invoices;
  };

  @(requires: 'FinanceOfficer')
  entity Payments             as projection on p2p.Payments actions {
    action process()  returns Payments;
  };

  @readonly
  entity Vendors              as projection on p2p.Vendors;
  @readonly
  entity Materials            as projection on p2p.Materials;

  @readonly
  entity ProcessFlow          as projection on p2p.ProcessFlow
    order by timestamp desc;

  /** Dashboard KPIs used by the Fiori launchpad tiles */
  type KPIs {
    openPRs         : Integer;
    openPOs         : Integer;
    pendingGRs      : Integer;
    pendingInvoices : Integer;
    scheduledPayments: Integer;
    totalSpend      : Decimal(15,2);
  }
  function getKPIs() returns KPIs;
}
