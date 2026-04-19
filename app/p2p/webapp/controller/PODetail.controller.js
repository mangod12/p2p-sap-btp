sap.ui.define([
    "./BaseController",
    "sap/m/MessageBox",
    "sap/m/Dialog", "sap/m/Button", "sap/m/Label", "sap/m/Input", "sap/m/VBox"
], function (Base, MessageBox, Dialog, Button, Label, Input, VBox) {
    "use strict";

    return Base.extend("p2p.app.controller.PODetail", {
        formatter: {
            statusState: function (s) {
                switch (s) {
                    case "Received": case "Sent": return "Success";
                    case "Cancelled": return "Error";
                    case "Open": case "PartiallyReceived": return "Warning";
                    default: return "None";
                }
            }
        },

        onInit: function () {
            this.getRouter().getRoute("poDetail").attachMatched(this._bind, this);
        },

        _bind: function (oEvt) {
            const id = oEvt.getParameter("arguments").id;
            this.getView().bindElement({ path: `/PurchaseOrders(ID=${id})` });
        },

        _path: function () { return this.getView().getBindingContext().getPath(); },
        _po:   function () { return this.getView().getBindingContext().getObject(); },

        onSend: function () {
            this.callAction(`${this._path()}/P2PService.sendToVendor`)
                .then(() => { this.success("PO sent to vendor"); this.getView().getBindingContext().refresh(); })
                .catch(e => this.error(e.message || "Send failed"));
        },

        onCancel: function () {
            MessageBox.confirm("Cancel this PO?", {
                onClose: a => {
                    if (a !== MessageBox.Action.OK) return;
                    this.callAction(`${this._path()}/P2PService.cancel`)
                        .then(() => { this.success("PO cancelled"); this.getView().getBindingContext().refresh(); })
                        .catch(e => this.error(e.message || "Cancel failed"));
                }
            });
        },

        onReceive: function () {
            const po = this._po();
            const oModel = this.getOwnerComponent().getModel();
            const oDialog = new Dialog({
                title: "Record Goods Receipt",
                content: [ new VBox({ items: [
                    new Label({ text: "PO Number" }),      new Input({ value: po.poNumber, editable: false }),
                    new Label({ text: "Received Quantity", required: true }),
                    new Input("grQty", { type: "Number", value: po.quantity }),
                    new Label({ text: "Received By" }),    new Input("grBy", { placeholder: "Warehouse user" }),
                    new Label({ text: "Remarks" }),        new Input("grRem")
                ]}).addStyleClass("sapUiSmallMargin")],
                beginButton: new Button({
                    text: "Record", type: "Emphasized",
                    press: () => {
                        const payload = {
                            po_ID:            po.ID,
                            poNumber:         po.poNumber,
                            quantityReceived: parseInt(sap.ui.getCore().byId("grQty").getValue() || "0", 10),
                            quantityOrdered:  po.quantity,
                            receivedBy:       sap.ui.getCore().byId("grBy").getValue(),
                            remarks:          sap.ui.getCore().byId("grRem").getValue(),
                            status:           "Pending"
                        };
                        const oList = oModel.bindList("/GoodsReceipts");
                        oList.create(payload).created().then(grCtx => {
                            const grObj = grCtx.getObject();
                            // auto-complete GR
                            return this.callAction(`/GoodsReceipts(ID=${grObj.ID})/P2PService.complete`);
                        }).then(() => {
                            this.success("Goods receipt recorded");
                            this.getView().getBindingContext().refresh();
                        }).catch(err => this.error(err.message || "GR failed"));
                        oDialog.close();
                    }
                }),
                endButton: new Button({ text: "Cancel", press: () => oDialog.close() }),
                afterClose: () => oDialog.destroy()
            });
            this.getView().addDependent(oDialog);
            oDialog.open();
        },

        onInvoice: function () {
            const po = this._po();
            const oModel = this.getOwnerComponent().getModel();
            const oDialog = new Dialog({
                title: "Create Invoice",
                content: [ new VBox({ items: [
                    new Label({ text: "PO Number" }), new Input({ value: po.poNumber, editable: false }),
                    new Label({ text: "Amount", required: true }),
                    new Input("invAmt", { type: "Number", value: po.totalAmount }),
                    new Label({ text: "Due Date (YYYY-MM-DD)" }), new Input("invDue")
                ]}).addStyleClass("sapUiSmallMargin")],
                beginButton: new Button({
                    text: "Create", type: "Emphasized",
                    press: () => {
                        const payload = {
                            po_ID:      po.ID,
                            poNumber:   po.poNumber,
                            vendorName: po.vendorName,
                            amount:     parseFloat(sap.ui.getCore().byId("invAmt").getValue() || "0"),
                            dueDate:    sap.ui.getCore().byId("invDue").getValue() || null,
                            status:     "Pending"
                        };
                        oModel.bindList("/Invoices").create(payload).created().then(() => {
                            this.success("Invoice created");
                            this.navTo("invList");
                        }).catch(err => this.error(err.message || "Invoice create failed"));
                        oDialog.close();
                    }
                }),
                endButton: new Button({ text: "Cancel", press: () => oDialog.close() }),
                afterClose: () => oDialog.destroy()
            });
            this.getView().addDependent(oDialog);
            oDialog.open();
        }
    });
});
