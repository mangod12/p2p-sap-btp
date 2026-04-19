sap.ui.define([
    "./BaseController",
    "sap/m/MessageBox"
], function (Base, MessageBox) {
    "use strict";

    return Base.extend("p2p.app.controller.PRDetail", {

        formatter: {
            statusState: function (s) {
                switch (s) {
                    case "Approved": case "Converted": return "Success";
                    case "Rejected": return "Error";
                    case "Submitted": return "Warning";
                    default: return "None";
                }
            }
        },

        onInit: function () {
            this.getRouter().getRoute("prDetail").attachMatched(this._bind, this);
        },

        _bind: function (oEvt) {
            const sId = oEvt.getParameter("arguments").id;
            this.getView().bindElement({
                path: `/PurchaseRequisitions(ID=${sId})`,
                parameters: { $$updateGroupId: "pr" }
            });
        },

        _ctxPath: function () {
            return this.getView().getBindingContext().getPath();
        },

        onSubmit: function () {
            this.callAction(`${this._ctxPath()}/P2PService.submit`)
                .then(() => { this.success("PR submitted"); this._refresh(); })
                .catch(e => this.error(e.message || "Submit failed"));
        },
        onApprove: function () {
            this.callAction(`${this._ctxPath()}/P2PService.approve`)
                .then(() => { this.success("PR approved"); this._refresh(); })
                .catch(e => this.error(e.message || "Approve failed"));
        },
        onReject: function () {
            MessageBox.confirm("Reject this PR?", {
                onClose: (a) => {
                    if (a !== MessageBox.Action.OK) return;
                    this.callAction(`${this._ctxPath()}/P2PService.rejectPR`, { reason: "Rejected by user" })
                        .then(() => { this.success("PR rejected"); this._refresh(); })
                        .catch(e => this.error(e.message || "Reject failed"));
                }
            });
        },
        onConvert: function () {
            this.callAction(`${this._ctxPath()}/P2PService.convertToPO`)
                .then((po) => {
                    this.success(`Converted to ${po.poNumber || "PO"}`);
                    this.navTo("poList");
                })
                .catch(e => this.error(e.message || "Convert failed"));
        },

        _refresh: function () {
            this.getView().getBindingContext().refresh();
        }
    });
});
