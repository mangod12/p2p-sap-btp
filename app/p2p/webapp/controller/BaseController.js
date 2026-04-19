sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("p2p.app.controller.BaseController", {

        getRouter: function () {
            return this.getOwnerComponent().getRouter();
        },

        navTo: function (route, params) {
            this.getRouter().navTo(route, params || {});
        },

        onNavBack: function () {
            const oHistory = sap.ui.core.routing.History.getInstance();
            const sPrev = oHistory.getPreviousHash();
            if (sPrev !== undefined) window.history.go(-1);
            else this.getRouter().navTo("home", {}, true);
        },

        toast: function (msg) { MessageToast.show(msg); },
        error: function (msg) { MessageBox.error(msg); },
        info:  function (msg) { MessageBox.information(msg); },
        success: function (msg) { MessageToast.show(msg); },

        /**
         * Invoke a bound action on the OData V4 model.
         * e.g. this.callAction("/PurchaseRequisitions('xyz')/P2PService.submit", {})
         */
        callAction: function (sPath, oArgs) {
            const oModel = this.getOwnerComponent().getModel();
            const oCtx = oModel.bindContext(sPath, null, { $$inheritExpandSelect: true });
            Object.keys(oArgs || {}).forEach(k => oCtx.setParameter(k, oArgs[k]));
            return oCtx.execute().then(() => oCtx.getBoundContext().getObject());
        },

        /**
         * Pretty status → UI5 semantic state
         */
        statusState: function (s) {
            switch (s) {
                case "Approved":
                case "Verified":
                case "Completed":
                case "Received":
                case "Paid":
                case "Sent":
                    return "Success";
                case "Rejected":
                case "Cancelled":
                case "Failed":
                    return "Error";
                case "Draft":
                case "Pending":
                case "Scheduled":
                case "Open":
                case "PartiallyReceived":
                case "Processing":
                case "Submitted":
                    return "Warning";
                default:
                    return "None";
            }
        }
    });
});
