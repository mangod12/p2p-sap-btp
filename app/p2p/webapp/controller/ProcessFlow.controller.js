sap.ui.define([
    "./BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Base, Filter, FilterOperator) {
    "use strict";

    return Base.extend("p2p.app.controller.ProcessFlow", {

        onSearch: function (oEvt) {
            var q = oEvt.getParameter("newValue");
            var oBinding = this.byId("tbl").getBinding("items");
            if (!q) {
                oBinding.filter(this._getActiveTabFilter());
                return;
            }
            var aSearchFilters = new Filter({
                filters: [
                    new Filter("entityType", FilterOperator.Contains, q),
                    new Filter("entityNumber", FilterOperator.Contains, q),
                    new Filter("actor", FilterOperator.Contains, q)
                ],
                and: false
            });
            var aTabFilter = this._getActiveTabFilter();
            if (aTabFilter.length > 0) {
                oBinding.filter(new Filter({
                    filters: [aTabFilter[0], aSearchFilters],
                    and: true
                }));
            } else {
                oBinding.filter(aSearchFilters);
            }
        },

        onFilterSelect: function (oEvt) {
            var sKey = oEvt.getParameter("key");
            var oBinding = this.byId("tbl").getBinding("items");
            if (sKey === "All") {
                oBinding.filter([]);
            } else {
                oBinding.filter(new Filter("entityType", FilterOperator.EQ, sKey));
            }
        },

        _getActiveTabFilter: function () {
            var sKey = this.byId("flowTabBar").getSelectedKey();
            if (!sKey || sKey === "All") {
                return [];
            }
            return [new Filter("entityType", FilterOperator.EQ, sKey)];
        }
    });
});
