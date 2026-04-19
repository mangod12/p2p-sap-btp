sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "sap/ui/model/json/JSONModel"
], function (UIComponent, Device, JSONModel) {
    "use strict";

    return UIComponent.extend("p2p.app.Component", {

        metadata: { manifest: "json" },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            // device model
            const deviceModel = new JSONModel(Device);
            deviceModel.setDefaultBindingMode("OneWay");
            this.setModel(deviceModel, "device");

            // KPI model used by Home
            this.setModel(new JSONModel({}), "kpi");

            // start routing
            this.getRouter().initialize();
        }
    });
});
