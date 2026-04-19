sap.ui.define([
    "./BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Base, Filter, FilterOperator) {
    "use strict";

    return Base.extend("p2p.app.controller.Vendors", {

        onSearch: function (oEvt) {
            var q = oEvt.getParameter("newValue");
            var oBinding = this.byId("vendorTable").getBinding("items");
            if (!q) {
                oBinding.filter([]);
                return;
            }
            oBinding.filter(new Filter({
                filters: [
                    new Filter("name", FilterOperator.Contains, q),
                    new Filter("contact", FilterOperator.Contains, q),
                    new Filter("email", FilterOperator.Contains, q)
                ],
                and: false
            }));
        }
    });
});
