sap.ui.define([
    "./BaseController", "sap/m/MessageBox"
], function (Base, MessageBox) {
    "use strict";
    return Base.extend("p2p.app.controller.InvoiceList", {

        _ctx: function (oEvt) { return oEvt.getSource().getBindingContext().getObject(); },
        _refresh: function () { this.byId("tbl").getBinding("items").refresh(); },

        onVerify: function (oEvt) {
            const inv = this._ctx(oEvt);
            this.callAction(`/Invoices(ID=${inv.ID})/P2PService.verify`)
                .then(() => { this.success("Invoice verified"); this._refresh(); })
                .catch(e => this.error(e.message || "Verify failed"));
        },

        onReject: function (oEvt) {
            const inv = this._ctx(oEvt);
            MessageBox.confirm("Reject this invoice?", {
                onClose: a => {
                    if (a !== MessageBox.Action.OK) return;
                    this.callAction(`/Invoices(ID=${inv.ID})/P2PService.rejectInvoice`, { reason: "Rejected" })
                        .then(() => { this.success("Invoice rejected"); this._refresh(); })
                        .catch(e => this.error(e.message || "Reject failed"));
                }
            });
        },

        onPay: function (oEvt) {
            const inv = this._ctx(oEvt);
            const oModel = this.getOwnerComponent().getModel();
            const payload = {
                invoice_ID:    inv.ID,
                invoiceNumber: inv.invoiceNumber,
                amount:        inv.amount,
                method:        "BankTransfer",
                status:        "Scheduled"
            };
            oModel.bindList("/Payments").create(payload).created().then(ctx => {
                const p = ctx.getObject();
                return this.callAction(`/Payments(ID=${p.ID})/P2PService.process`);
            }).then(() => {
                this.success("Payment processed");
                this.navTo("payList");
            }).catch(e => this.error(e.message || "Payment failed"));
        }
    });
});
