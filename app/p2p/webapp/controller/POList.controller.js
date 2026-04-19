sap.ui.define([
    "./BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Base, Filter, FilterOperator) {
    "use strict";

    return Base.extend("p2p.app.controller.POList", {
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
        onOpen: function (oEvt) {
            const id = oEvt.getSource().getBindingContext().getObject().ID;
            this.navTo("poDetail", { id });
        },
        onSearch: function (oEvt) {
            const q = oEvt.getParameter("newValue");
            const b = this.byId("tbl").getBinding("items");
            if (!q) return b.filter([]);
            b.filter(new Filter({
                filters: [
                    new Filter("poNumber",     FilterOperator.Contains, q),
                    new Filter("vendorName",   FilterOperator.Contains, q),
                    new Filter("materialName", FilterOperator.Contains, q)
                ], and: false
            }));
        }
    });
});
