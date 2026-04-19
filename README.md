# Procure-to-Pay (P2P) on SAP BTP

A full-stack Procure-to-Pay application built on the SAP Business Technology Platform using the SAP Cloud Application Programming Model (CAP).

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Test Credentials](#test-credentials)
- [P2P Workflow](#p2p-workflow)
- [Application Routes](#application-routes)
- [Data Model](#data-model)
- [Service Actions & API](#service-actions--api)
- [API Examples (curl)](#api-examples-curl)
- [Seed Data](#seed-data)
- [Security Roles](#security-roles)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [BTP Deployment](#btp-deployment)

---

## Overview

This application models the complete Procure-to-Pay lifecycle:

**Requisition → Purchase Order → Goods Receipt → Invoice Verification → Payment**

It includes a dashboard with KPI tiles, workflow actions with status transitions, an audit trail (Process Flow), and master data management for Vendors and Materials.

---

## Quick Start

### Prerequisites

- Node.js >= 18
- npm >= 9

### Install & Run

```bash
cd p2p-sap-btp
npm install
npm install --save-dev @sap/cds-dk@^7
npx cds deploy --to sqlite:db/p2p.db
npx cds watch
```

Open **http://localhost:4004** in your browser. You'll be prompted for credentials — use any from the table below.

The CAP welcome page shows all available service endpoints. Navigate to the Fiori app at:
```
http://localhost:4004/p2p/webapp/index.html
```

---

## Test Credentials

| User | Password | Role | Access |
|------|----------|------|--------|
| `admin` | `initial` | All Roles | Full access to all modules |
| `proc.officer` | `initial` | ProcurementOfficer | Create/manage Purchase Requisitions and Purchase Orders |
| `wh.manager` | `initial` | WarehouseManager | Record and complete Goods Receipts |
| `fin.officer` | `initial` | FinanceOfficer | Verify invoices and process payments |

> **Note:** These credentials are for local development only. In production, authentication is handled by SAP XSUAA.

---

## P2P Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Purchase    │    │  Purchase   │    │   Goods     │    │   Invoice   │    │   Payment   │
│ Requisition │───▶│   Order     │───▶│  Receipt    │───▶│ Verification│───▶│  Processing │
│   (PR)      │    │   (PO)      │    │   (GR)      │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
  Draft             Open               Pending            Pending            Scheduled
  → Submitted       → Sent             → Completed        → Verified         → Processing
  → Approved        → PartiallyRecvd                      → Rejected         → Completed
  → Rejected        → Received                            → Paid             → Failed
  → Converted       → Cancelled
```

### Happy Path (Step-by-Step)

1. **Create PR** → Draft status. Fill in material, quantity, vendor, needed-by date.
2. **Submit PR** → Changes to "Submitted" for approval.
3. **Approve PR** → Changes to "Approved", ready for conversion.
4. **Convert PR to PO** → Creates a new Purchase Order, PR becomes "Converted".
5. **Send PO to Vendor** → PO changes to "Sent".
6. **Record Goods Receipt** → Create a GR against the PO. Complete it to update PO status.
7. **Create Invoice** → Create an invoice against the PO for the received goods.
8. **Verify Invoice** → Finance officer verifies the invoice amount matches the PO.
9. **Process Payment** → Creates and processes payment, invoice becomes "Paid".

---

## Application Routes

| Route | Page | Description |
|-------|------|-------------|
| `#/` | Home | Dashboard with KPI tiles and navigation |
| `#/PurchaseRequisitions` | PR List | List with create, search, and status filter |
| `#/PurchaseRequisitions/{id}` | PR Detail | Detail view with Submit/Approve/Reject/Convert actions |
| `#/PurchaseOrders` | PO List | List with search |
| `#/PurchaseOrders/{id}` | PO Detail | Detail with Send/Receive/Invoice/Cancel actions |
| `#/GoodsReceipts` | GR List | List with Complete action |
| `#/Invoices` | Invoice List | List with Verify/Reject/Pay actions |
| `#/Payments` | Payment List | List with Process action |
| `#/ProcessFlow` | Audit Trail | All status changes across the P2P lifecycle |
| `#/Vendors` | Vendors | Vendor master data (read-only) |
| `#/Materials` | Materials | Material master data (read-only) |

---

## Data Model

### Entity Relationship

```
Vendors ──┐
           ├──▶ PurchaseRequisitions ──▶ PurchaseOrders ──▶ GoodsReceipts
Materials ─┘                                    │
                                                ├──▶ Invoices ──▶ Payments
                                                │
                                         ProcessFlow (audit trail)
```

### Entities

| Entity | Key Fields | Status Values |
|--------|-----------|---------------|
| **Vendors** | name, contact, email, phone, address, rating | — (master data) |
| **Materials** | materialName, description, unit, unitPrice | — (master data) |
| **PurchaseRequisitions** | prNumber, material, quantity, vendor, requestedBy, neededBy | Draft, Submitted, Approved, Rejected, Converted |
| **PurchaseOrders** | poNumber, vendor, material, quantity, unitPrice, totalAmount | Open, Sent, PartiallyReceived, Received, Cancelled |
| **GoodsReceipts** | grNumber, po, quantityReceived, quantityOrdered, receivedBy | Pending, Completed |
| **Invoices** | invoiceNumber, po, vendorName, amount, dueDate, verifiedBy | Pending, Verified, Rejected, Paid |
| **Payments** | paymentNumber, invoice, amount, method, reference, processedBy | Scheduled, Processing, Completed, Failed |
| **ProcessFlow** | entityType, entityNumber, fromStatus, toStatus, actor, timestamp | — (audit log) |

---

## Service Actions & API

The OData V4 service is exposed at `/p2p/`.

### Bound Actions

| Entity | Action | Description |
|--------|--------|-------------|
| PurchaseRequisitions | `submit()` | Move PR from Draft to Submitted |
| PurchaseRequisitions | `approve()` | Approve a Submitted/Draft PR |
| PurchaseRequisitions | `rejectPR(reason)` | Reject a PR with a reason |
| PurchaseRequisitions | `convertToPO()` | Convert an Approved PR into a new PO |
| PurchaseOrders | `sendToVendor()` | Send an Open PO to the vendor |
| PurchaseOrders | `cancel()` | Cancel a PO |
| GoodsReceipts | `complete()` | Mark a GR as completed (cascades to PO status) |
| Invoices | `verify()` | Verify a Pending invoice |
| Invoices | `rejectInvoice(reason)` | Reject an invoice with a reason |
| Payments | `process()` | Process a payment (cascades to invoice Paid status) |

### Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `getKPIs()` | KPIs object | Dashboard counts: openPRs, openPOs, pendingGRs, pendingInvoices, scheduledPayments, totalSpend |

---

## API Examples (curl)

```bash
# Get all Purchase Requisitions
curl -u admin:initial http://localhost:4004/p2p/PurchaseRequisitions

# Get dashboard KPIs
curl -u admin:initial http://localhost:4004/p2p/getKPIs()

# Get a specific PR
curl -u admin:initial \
  http://localhost:4004/p2p/PurchaseRequisitions\(ID=33333333-3333-3333-3333-333333333001\)

# Create a new PR
curl -X POST -u proc.officer:initial \
  -H "Content-Type: application/json" \
  -d '{"materialName":"Test Material","quantity":10,"vendorName":"Acme Supplies Ltd.","requestedBy":"proc.officer"}' \
  http://localhost:4004/p2p/PurchaseRequisitions

# Submit a Draft PR
curl -X POST -u proc.officer:initial \
  -H "Content-Type: application/json" \
  http://localhost:4004/p2p/PurchaseRequisitions\(ID=33333333-3333-3333-3333-333333333003\)/P2PService.submit

# Approve a Submitted PR
curl -X POST -u proc.officer:initial \
  -H "Content-Type: application/json" \
  http://localhost:4004/p2p/PurchaseRequisitions\(ID=33333333-3333-3333-3333-333333333002\)/P2PService.approve

# Convert an Approved PR to PO
curl -X POST -u proc.officer:initial \
  -H "Content-Type: application/json" \
  http://localhost:4004/p2p/PurchaseRequisitions\(ID=33333333-3333-3333-3333-333333333001\)/P2PService.convertToPO

# Get all Purchase Orders
curl -u admin:initial http://localhost:4004/p2p/PurchaseOrders

# Get all Vendors
curl -u admin:initial http://localhost:4004/p2p/Vendors

# Get Process Flow (audit trail)
curl -u admin:initial http://localhost:4004/p2p/ProcessFlow
```

---

## Seed Data

The app ships with pre-loaded data to demonstrate the full lifecycle:

### Vendors (4)
| Name | Contact | Rating |
|------|---------|--------|
| Acme Supplies Ltd. | John Carter | 4.50 |
| Globex Manufacturing | Priya Shah | 4.20 |
| Initech Components | Peter Gibbons | 3.90 |
| Umbrella Traders | Alice Wesker | 4.80 |

### Materials (5)
| Material | Unit Price | Unit |
|----------|-----------|------|
| Lithium-Ion Cell 18650 | $3.75 | EA |
| Battery Management System | $42.00 | EA |
| Nickel Strip 0.2mm | $18.50 | ROLL |
| Heat Shrink Wrap | $0.90 | MTR |
| Copper Busbar | $6.25 | EA |

### Pre-loaded Transactions
- **3 Purchase Requisitions**: PR-1001 (Approved), PR-1002 (Submitted), PR-1003 (Draft)
- **2 Purchase Orders**: PO-1001 (Sent), PO-1002 (Open)
- **1 Goods Receipt**: GR-1001 (Completed, for PO-1001)
- **1 Invoice**: INV-1001 (Verified, for PO-1001)
- **1 Payment**: PAY-1001 (Completed, for INV-1001)
- **8 Process Flow entries**: Full audit trail for the PR-1001 → PO-1001 → GR-1001 → INV-1001 → PAY-1001 lifecycle

---

## Security Roles

| Role | Scope | Permissions |
|------|-------|-------------|
| **ProcurementOfficer** | PRs & POs | Create, submit, approve, reject PRs; create, send, cancel POs |
| **WarehouseManager** | Goods Receipts | Create and complete goods receipts |
| **FinanceOfficer** | Invoices & Payments | Verify/reject invoices; create and process payments |

All authenticated users can view Vendors, Materials, and the Process Flow audit trail.

### XSUAA Configuration

Role templates and role collections are defined in `xs-security.json`:
- `P2P_Procurement` → ProcurementOfficer
- `P2P_Warehouse` → WarehouseManager
- `P2P_Finance` → FinanceOfficer

---

## Project Structure

```
p2p-sap-btp/
├── db/
│   ├── schema.cds                        # Data model (9 entities + status enums)
│   └── data/                             # CSV seed data (semicolon-delimited)
│       ├── p2p-Vendors.csv               # 4 vendors
│       ├── p2p-Materials.csv             # 5 materials
│       ├── p2p-PurchaseRequisitions.csv  # 3 PRs
│       ├── p2p-PurchaseOrders.csv        # 2 POs
│       ├── p2p-GoodsReceipts.csv         # 1 GR
│       ├── p2p-Invoices.csv              # 1 invoice
│       ├── p2p-Payments.csv              # 1 payment
│       └── p2p-ProcessFlow.csv           # 8 audit entries
├── srv/
│   ├── p2p-service.cds                   # Service definition with actions & role annotations
│   └── p2p-service.js                    # Service implementation (validation, workflows)
├── app/p2p/webapp/
│   ├── Component.js                      # UI5 component initialization
│   ├── manifest.json                     # App descriptor with OData model & routing
│   ├── css/style.css                     # Custom Fiori styles
│   ├── i18n/i18n.properties              # Internationalization strings
│   ├── controller/
│   │   ├── BaseController.js             # Shared utilities (nav, toast, callAction)
│   │   ├── Home.controller.js            # Dashboard KPI loading
│   │   ├── PRList.controller.js          # PR list with create, search, status filters
│   │   ├── PRDetail.controller.js        # PR detail with workflow actions
│   │   ├── POList.controller.js          # PO list with search
│   │   ├── PODetail.controller.js        # PO detail with GR/Invoice dialogs
│   │   ├── GRList.controller.js          # GR list with complete action
│   │   ├── InvoiceList.controller.js     # Invoice verify/reject/pay
│   │   ├── PaymentList.controller.js     # Payment process action
│   │   ├── Vendors.controller.js         # Vendor master data
│   │   ├── Materials.controller.js       # Material master data
│   │   └── ProcessFlow.controller.js     # Audit trail viewer
│   └── view/                             # Matching XML views for each controller
├── mta.yaml                              # MTA deployment descriptor (Cloud Foundry)
├── xs-security.json                      # XSUAA security configuration
└── package.json                          # Dependencies, scripts & CDS config
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | SAP Cloud Application Programming Model (CAP) 7.x, Node.js |
| **Frontend** | SAP UI5 1.120+, Fiori Design Guidelines, XML Views |
| **Database (Dev)** | SQLite via `@cap-js/sqlite` |
| **Database (Prod)** | SAP HANA HDI Container |
| **Authentication** | SAP XSUAA (mocked locally with Basic Auth) |
| **Deployment** | Multi-Target Application (MTA) on Cloud Foundry |
| **OData** | OData V4 |

---

## BTP Deployment

### Prerequisites

- Cloud Foundry CLI (`cf`)
- MTA Build Tool (`mbt`) — `npm install -g mbt`
- SAP BTP subaccount with HANA and XSUAA service instances

### Build & Deploy

```bash
# Build the MTA archive
npx cds build --production
mbt build

# Login to Cloud Foundry
cf login -a <api-endpoint> -o <org> -s <space>

# Deploy
cf deploy mta_archives/p2p-sap-btp_1.0.0.mtar
```

### Post-Deployment

1. Assign role collections (`P2P_Procurement`, `P2P_Warehouse`, `P2P_Finance`) to users in the SAP BTP Cockpit
2. Access the application via the Approuter URL

---

## License

MIT
