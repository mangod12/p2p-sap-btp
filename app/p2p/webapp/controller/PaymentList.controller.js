sap.ui.define(["./BaseController"], function (Base) {
    "use strict";
    return Base.extend("p2p.app.controller.PaymentList", {
        onProcess: function (oEvt) {
            const p = oEvt.getSource().getBindingContext().getObject();
            this.callAction(`/Payments(ID=${p.ID})/P2PService.process`)
                .then(() => { this.success("Payment processed"); this.byId("tbl").getBinding("items").refresh(); })
                .catch(e => this.error(e.message || "Process failed"));
        }
    });
});
