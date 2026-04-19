sap.ui.define([
    "./BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog", "sap/m/Button", "sap/m/Label", "sap/m/Input",
    "sap/m/ComboBox", "sap/ui/core/Item", "sap/m/VBox"
], function (Base, Filter, FilterOperator, JSONModel, Dialog, Button, Label, Input, ComboBox, Item, VBox) {
    "use strict";

    return Base.extend("p2p.app.controller.PRList", {

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
            var oCounts = new JSONModel({
                Draft: 0,
                Submitted: 0,
                Approved: 0,
                Rejected: 0,
                Converted: 0
            });
            this.getOwnerComponent().setModel(oCounts, "prCounts");
            this.getRouter().getRoute("prList").attachMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            this._loadStatusCounts();
        },

        _loadStatusCounts: function () {
            var oCountsModel = this.getOwnerComponent().getModel("prCounts");
            var oDataModel = this.getOwnerComponent().getModel();
            var statuses = ["Draft", "Submitted", "Approved", "Rejected", "Converted"];
            statuses.forEach(function (status) {
                var oList = oDataModel.bindList("/PurchaseRequisitions", null, null, [
                    new Filter("status", FilterOperator.EQ, status)
                ], { $count: true });
                oList.requestContexts(0, 0).then(function () {
                    oCountsModel.setProperty("/" + status, oList.getCount());
                });
            });
        },

        onOpen: function (oEvt) {
            var oCtx = (oEvt.getSource().getBindingContext && oEvt.getSource().getBindingContext())
                      || oEvt.getParameter("listItem").getBindingContext();
            var sId = oCtx.getObject().ID;
            this.navTo("prDetail", { id: sId });
        },

        onSearch: function (oEvt) {
            var q = oEvt.getParameter("newValue");
            var oBinding = this.byId("tbl").getBinding("items");
            if (!q) { oBinding.filter([]); return; }
            oBinding.filter(new Filter({
                filters: [
                    new Filter("prNumber",     FilterOperator.Contains, q),
                    new Filter("materialName", FilterOperator.Contains, q),
                    new Filter("vendorName",   FilterOperator.Contains, q)
                ], and: false
            }));
        },

        onFilterSelect: function (oEvt) {
            var sKey = oEvt.getParameter("key");
            var oBinding = this.byId("tbl").getBinding("items");
            if (sKey === "All") {
                oBinding.filter([]);
            } else {
                oBinding.filter(new Filter("status", FilterOperator.EQ, sKey));
            }
        },

        onCreate: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel();

            var oMatInput = new Input({ placeholder: "e.g. Lithium-Ion Cell 18650" });
            var oQtyInput = new Input({ type: "Number", value: "1" });
            var oVenInput = new Input({ placeholder: "e.g. Acme Supplies Ltd." });
            var oReqInput = new Input({ placeholder: "Your name" });
            var oDateInput = new Input({ placeholder: "2026-05-01" });
            var oRemInput = new Input();

            var oDialog = new Dialog({
                title: "Create Purchase Requisition",
                contentWidth: "28rem",
                content: [
                    new VBox({ items: [
                        new Label({ text: "Material Name", required: true }),
                        oMatInput,
                        new Label({ text: "Quantity", required: true }),
                        oQtyInput,
                        new Label({ text: "Vendor Name" }),
                        oVenInput,
                        new Label({ text: "Requested By" }),
                        oReqInput,
                        new Label({ text: "Needed By (YYYY-MM-DD)" }),
                        oDateInput,
                        new Label({ text: "Remarks" }),
                        oRemInput
                    ]}).addStyleClass("sapUiSmallMargin")
                ],
                beginButton: new Button({
                    text: "Create", type: "Emphasized",
                    press: function () {
                        var payload = {
                            materialName: oMatInput.getValue(),
                            quantity:     parseInt(oQtyInput.getValue() || "0", 10),
                            vendorName:   oVenInput.getValue(),
                            requestedBy:  oReqInput.getValue(),
                            neededBy:     oDateInput.getValue() || null,
                            remarks:      oRemInput.getValue(),
                            status:       "Draft"
                        };
                        if (!payload.materialName || !payload.quantity) {
                            that.error("Material name and quantity are required");
                            return;
                        }
                        var oList = oModel.bindList("/PurchaseRequisitions");
                        oList.create(payload).created().then(function () {
                            that.toast("PR created");
                            that.byId("tbl").getBinding("items").refresh();
                            that._loadStatusCounts();
                        }).catch(function (err) {
                            that.error(err.message || "Create failed");
                        });
                        oDialog.close();
                    }
                }),
                endButton: new Button({ text: "Cancel", press: function () { oDialog.close(); } }),
                afterClose: function () { oDialog.destroy(); }
            });
            this.getView().addDependent(oDialog);
            oDialog.open();
        }
    });
});
