sap.ui.define(["./BaseController"], function (Base) {
    "use strict";
    return Base.extend("p2p.app.controller.GRList", {
        onComplete: function (oEvt) {
            const gr = oEvt.getSource().getBindingContext().getObject();
            this.callAction(`/GoodsReceipts(ID=${gr.ID})/P2PService.complete`)
                .then(() => { this.success("Goods receipt completed"); this.byId("tbl").getBinding("items").refresh(); })
                .catch(e => this.error(e.message || "Complete failed"));
        }
    });
});
