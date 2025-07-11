/**
 *@name: EXTEND SUITESCRIPT SDK - ExtendClaimActions
 *@description:
 * Automatically fully fulfill and bill items on Sales Order
 *
 *@copyright Extend, Inc
 *@author Dina Vu
 *
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 *@ModuleScope Public
 */
define(["N/record"], function (record) {
  var exports = {};
  exports.beforeLoad = function (context) {};
  exports.beforeSubmit = function (context) {
    return true;
  };

  exports.afterSubmit = function (context) {
    try {
      var newRecord = context.newRecord;
      //on create or if value went from empty to populated

      var status = newRecord.getValue("status");
      log.debug("status", status);
      var orderStatus = newRecord.getValue("orderstatus");
      log.debug("orderStatus", orderStatus);
      if (orderStatus === "B") {
        var recItemFulfillment = record.transform({
          fromType: "salesorder",
          fromId: context.newRecord.id,
          toType: "itemfulfillment",
        });
        var recItemFulfillmentId = recItemFulfillment.save();

        log.debug("recItemFulfillmentId", recItemFulfillmentId);
      }

      if (orderStatus === "F" || orderStatus === "B") {
        var recInvoice = record.transform({
          fromType: "salesorder",
          fromId: context.newRecord.id,
          toType: "invoice",
        });

        var recInvoiceId = recInvoice.save();

        log.debug("recInvoiceId", recInvoiceId);
      }
    } catch (e) {
      log.error("Error in afterSubmit", e);
    }
  };

  return exports;
});
