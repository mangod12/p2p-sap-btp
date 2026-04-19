namespace p2p;

using { cuid, managed } from '@sap/cds/common';

/**
 * Master data: Vendors
 */
entity Vendors : cuid, managed {
  name        : String(100) not null;
  contact     : String(100);
  email       : String(100);
  phone       : String(30);
  address     : String(255);
  rating      : Decimal(3,2) default 0.0;
  pos         : Composition of many PurchaseOrders on pos.vendor = $self;
}

/**
 * Master data: Materials
 */
entity Materials : cuid, managed {
  materialName : String(100) not null;
  description  : String(255);
  unit         : String(10) default 'EA';
  unitPrice    : Decimal(15,2) default 0.0;
}

/**
 * Status code-lists. Keeps transitions explicit and UI friendly.
 */
type PRStatus      : String(20) enum { Draft; Submitted; Approved; Rejected; Converted; }
type POStatus      : String(20) enum { Open; Sent; PartiallyReceived; Received; Cancelled; }
type GRStatus      : String(20) enum { Pending; Completed; }
type InvoiceStatus : String(20) enum { Pending; Verified; Rejected; Paid; }
type PaymentStatus : String(20) enum { Scheduled; Processing; Completed; Failed; }

/**
 * 1. Purchase Requisition
 */
entity PurchaseRequisitions : cuid, managed {
  prNumber     : String(20);
  material     : Association to Materials;
  materialName : String(100);
  quantity     : Integer not null;
  vendor       : Association to Vendors;
  vendorName   : String(100);
  requestedBy  : String(100);
  requestDate  : Date default $now;
  neededBy     : Date;
  remarks      : String(255);
  status       : PRStatus default 'Draft';
  po           : Association to PurchaseOrders;
}

/**
 * 2. Purchase Order
 */
entity PurchaseOrders : cuid, managed {
  poNumber     : String(20);
  pr           : Association to PurchaseRequisitions;
  vendor       : Association to Vendors;
  vendorName   : String(100);
  material     : Association to Materials;
  materialName : String(100);
  quantity     : Integer not null;
  unitPrice    : Decimal(15,2);
  totalAmount  : Decimal(15,2);
  orderDate    : Date default $now;
  deliveryDate : Date;
  status       : POStatus default 'Open';
  grs          : Composition of many GoodsReceipts on grs.po = $self;
  invoices     : Composition of many Invoices      on invoices.po = $self;
}

/**
 * 3. Goods Receipt
 */
entity GoodsReceipts : cuid, managed {
  grNumber       : String(20);
  po             : Association to PurchaseOrders;
  poNumber       : String(20);
  receivedBy     : String(100);
  receivedDate   : Date default $now;
  quantityReceived : Integer not null;
  quantityOrdered  : Integer;
  remarks        : String(255);
  status         : GRStatus default 'Pending';
}

/**
 * 4. Invoice Verification
 */
entity Invoices : cuid, managed {
  invoiceNumber : String(20);
  po            : Association to PurchaseOrders;
  poNumber      : String(20);
  vendorName    : String(100);
  invoiceDate   : Date default $now;
  dueDate       : Date;
  amount        : Decimal(15,2) not null;
  verifiedBy    : String(100);
  status        : InvoiceStatus default 'Pending';
  payments      : Composition of many Payments on payments.invoice = $self;
}

/**
 * 5. Payment Tracking
 */
entity Payments : cuid, managed {
  paymentNumber : String(20);
  invoice       : Association to Invoices;
  invoiceNumber : String(20);
  amount        : Decimal(15,2) not null;
  paymentDate   : Date default $now;
  method        : String(20) default 'BankTransfer';
  reference     : String(50);
  processedBy   : String(100);
  status        : PaymentStatus default 'Scheduled';
}

/**
 * Process-flow / audit trail, consumed by the "Track Process Flow" tile
 */
entity ProcessFlow : cuid, managed {
  entityType : String(30);      // PR, PO, GR, Invoice, Payment
  entityId   : String(50);
  entityNumber : String(30);
  fromStatus : String(20);
  toStatus   : String(20);
  actor      : String(100);
  remarks    : String(255);
  timestamp  : DateTime default $now;
}
