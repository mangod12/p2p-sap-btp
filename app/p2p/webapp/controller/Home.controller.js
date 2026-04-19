sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel"
], function (BaseController, JSONModel) {
    "use strict";

    return BaseController.extend("p2p.app.controller.Home", {

        onInit: function () {
            this.getRouter().getRoute("home").attachMatched(this._loadKPIs, this);
            this._loadKPIs();
        },

        _loadKPIs: function () {
            const oKpi = this.getOwnerComponent().getModel("kpi");
            fetch("/p2p/getKPIs()")
                .then(r => r.ok ? r.json() : {})
                .then(d => oKpi.setData(d || {}))
                .catch(() => oKpi.setData({}));
        },

        onRefresh: function () {
            this._loadKPIs();
            this.toast("KPIs refreshed");
        },

        onLaunchpad: function () {
            window.location.href = "../../launchpad/index.html";
        },

        onNav: function (oEvt) {
            const sTarget = oEvt.getSource().getTooltip();
            const map = {
                PurchaseRequisitions: "prList",
                PurchaseOrders:       "poList",
                GoodsReceipts:        "grList",
                Invoices:             "invList",
                Payments:             "payList",
                ProcessFlow:          "flow",
                Vendors:              "vendors",
                Materials:            "materials"
            };
            if (map[sTarget]) this.navTo(map[sTarget]);
        }
    });
});
