sap.ui.define([
    "./BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Base, Filter, FilterOperator) {
    "use strict";

    return Base.extend("p2p.app.controller.Materials", {

        onSearch: function (oEvt) {
            var q = oEvt.getParameter("newValue");
            var oBinding = this.byId("materialTable").getBinding("items");
            if (!q) {
                oBinding.filter([]);
                return;
            }
            oBinding.filter(new Filter({
                filters: [
                    new Filter("materialName", FilterOperator.Contains, q),
                    new Filter("description", FilterOperator.Contains, q)
                ],
                and: false
            }));
        }
    });
});
