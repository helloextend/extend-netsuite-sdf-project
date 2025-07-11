/**
 *@name: EXTEND SUITESCRIPT SDK - ExtendClaimActions
 *@description:
 * Link Item Receipt to extend claim record
 *
 *@copyright Extend, Inc
 *@author Dina Vu
 *
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 *@ModuleScope Public
 */
define([
  "N/runtime",
  "N/record",
  "N/search",
  "N/https",
  "SuiteScripts/ExtendSDK/lib/customscript_ext_util.js",
], function (runtime, record, search, https, EXTEND_UTIL) {
  var exports = {};
  exports.beforeLoad = function (context) {};
  exports.beforeSubmit = function (context) {
    return true;
  };

  exports.afterSubmit = function (context) {
    var newRecord = context.newRecord;
    //on create or if value went from empty to populated

    var recClaimManagementId = newRecord.getValue(
      "custbody_ext_claim_related_rec"
    );

    var createTransactions = false;
    log.debug("context.type", context.type);
    log.debug(
      "!EXTEND_UTIL.stringIsEmpty(recClaimManagementId)",
      !EXTEND_UTIL.stringIsEmpty(recClaimManagementId)
    );
    if (
      context.type === context.UserEventType.CREATE &&
      !EXTEND_UTIL.stringIsEmpty(recClaimManagementId)
    ) {
      createTransactions = true;
    } else {
      var oldRecord = context.oldRecord;

      var oldRecClaimManagementId = oldRecord.getValue(
        "custbody_ext_claim_related_rec"
      );
      var recClaimManagementId = newRecord.getValue(
        "custbody_ext_claim_related_rec"
      );
      if (
        context.type !== context.UserEventType.CREATE &&
        !EXTEND_UTIL.stringIsEmpty(recClaimManagementId) &&
        EXTEND_UTIL.stringIsEmpty(oldRecClaimManagementId)
      ) {
        createTransactions = true;
      }
    }
    if (createTransactions) {
      record.submitFields({
        type: "customrecord_extend_claim_management",
        id: recClaimManagementId,
        values: {
          custrecord_ext_linked_item_receipt: context.newRecord.id,
        },
      });
      var recExtendClaimManagement = record.load({
        type: "customrecord_extend_claim_management",
        id: recClaimManagementId,
      });

      log.debug("recClaimManagementId", recClaimManagementId);
      var serviceOrderId = recExtendClaimManagement.getValue(
        "custrecord_ext_service_order_ids"
      );
      log.debug("serviceOrderId", serviceOrderId);
      var url =
        "https://api-demo.helloextend.com/service-orders/" +
        serviceOrderId +
        "/update-repair";
      var response = https.request({
        url: url,
        method: "POST",
        body: {
          repair: "repair",
        },
      });
      //https://api-demo.helloextend.com/service-orders/c83a4fa7-7379-40a2-86eb-2b94e3104537/update-repair
      //https://api-demo.helloextend.com/service-orders/c83a4fa7-7379-40a2-86eb-2b94e3104537/update-repair

      var fulfillmentTransactions = [];
      var fulfillmentMethod = recExtendClaimManagement.getValue(
        "custrecord_ext_fulfillment_method"
      );
      log.debug("fulfillmentMethod", fulfillmentMethod);
      var rmaId = recExtendClaimManagement.getValue(
        "custrecord_ext_linked_return"
      );
      if (fulfillmentMethod === "1") {
        //Replacement Sales Order
        var itemIds = recExtendClaimManagement.getValue(
          "custrecord_ext_str_item_ids"
        );
        var soId = recExtendClaimManagement.getValue(
          "custrecord_ext_linked_order"
        );
        var replacementSOId = createRMAFromSO(
          itemIds,
          soId,
          recClaimManagementId,
          "replacementSO"
        );
        fulfillmentTransactions.push(replacementSOId);
      } else if (fulfillmentMethod === "2") {
        var customerId = recExtendClaimManagement.getValue(
          "custrecord_ext_linked_customer"
        );
        var creditMemoId = createCMfromRMA(rmaId);
        fulfillmentTransactions.push(creditMemoId);
        recExtendClaimManagement.setValue({
          fieldId: "custrecord_ext_claim_status",
          value: "credit_memo_created",
        });
        log.debug("creditMemoId", creditMemoId);

        var refundId = createRefundfromCM(customerId, creditMemoId);
        log.debug("refundId", refundId);
        fulfillmentTransactions.push(refundId);
      } else if (fulfillmentMethod === "3") {
        //issue store credit
       
        var creditMemoId = createCMfromRMA(rmaId);
        recExtendClaimManagement.setValue({
          fieldId: "custrecord_ext_claim_status",
          value: "credit_memo_created",
        });
        log.debug("creditMemoId", creditMemoId);
        fulfillmentTransactions.push(creditMemoId);
      }

      recExtendClaimManagement.setValue({
        fieldId: "custrecord_ext_fulfillment_transactions",
        value: fulfillmentTransactions,
      });
      recExtendClaimManagement.save();
    }
  };

  function createRMAFromSO(itemIds, soId, recClaimId, recordType) {
    var itemObj = {};
    var objRecord;
    if (!EXTEND_UTIL.stringIsEmpty(itemIds)) {
      var arrItemIds = itemIds.split(",");
      for (var i = 0; i < arrItemIds.length; i++) {
        var itemId = arrItemIds[i];
        if (itemId in itemObj) {
          itemObj[itemId]["quantity"] = itemObj[itemId]["quantity"] + 1;
        } else {
          itemObj[itemId] = {};
          itemObj[itemId]["quantity"] = 1;
        }
      }
    }

    log.debug("arrItemIds", arrItemIds);
    log.debug("itemObj", itemObj);

    if (recordType == "returnAuthorization") {
      objRecord = record.transform({
        fromType: record.Type.SALES_ORDER,
        fromId: soId,
        toType: record.Type.RETURN_AUTHORIZATION,
        isDynamic: false,
      });
      objRecord.setValue({
        fieldId: "orderstatus",
        value: "B",
      });
      objRecord.setValue({
        fieldId: "custbody_ext_claim_related_rec",
        value: recClaimId,
      });
    } else if (recordType == "replacementSO") {
      objRecord = record.copy({
        type: record.Type.SALES_ORDER,
        id: soId,
        isDynamic: false,
      });
      objRecord.setValue({ fieldId: "custbody_ext_order_id", value: "" });
      objRecord.setValue({
        fieldId: "memo",
        value: "Replacement Order for Sales Order internalid: " + soId,
      });
      objRecord.setValue({
        fieldId: "custbody_ext_claim_related_rec",
        value: "",
      });
    }

    var lineCount = objRecord.getLineCount("item");
    var arrLinesToRemove = [];

    for (var i = 0; i < lineCount; i++) {
      var lineItem = objRecord.getSublistValue({
        sublistId: "item",
        fieldId: "item",
        line: i,
      });
      log.debug("lineItem", lineItem);
      if (lineItem in itemObj) {
        var itemQuantity = itemObj[lineItem]["quantity"];
        var currentLineQuantity = objRecord.getSublistValue({
          sublistId: "item",
          fieldId: "quantity",
          line: i,
        });

        if (itemQuantity > 0) {
          //to account for duplicate lines
          objRecord.setSublistValue({
            sublistId: "item",
            fieldId: "quantity",
            line: i,
            value: itemQuantity,
          });

          itemObj[lineItem]["quantity"] = 0;
        } else {
          log.debug("duplicate line", lineItem);
          arrLinesToRemove.push(i);
        }
      } else {
        log.debug("lineItem not in itemObj", lineItem);
        arrLinesToRemove.push(i);
      }
    }

    //remove lines from bottom up so line numbering doesn't change
    arrLinesToRemove.sort(function (a, b) {
      return b - a;
    });
    log.debug("arrLinesToRemove", arrLinesToRemove);
    for (var i = 0; i < arrLinesToRemove.length; i++) {
      objRecord.removeLine({
        sublistId: "item",
        line: arrLinesToRemove[i],
        ignoreRecalc: true,
      });
    }

    return objRecord.save();
  }
  function createCMfromRMA(rmaId) {
    var objRecord = record.transform({
      fromType: record.Type.RETURN_AUTHORIZATION,
      fromId: rmaId,
      toType: record.Type.CREDIT_MEMO,
      isDynamic: false,
    });
    objRecord.setValue("status");

    var creditMemoId = objRecord.save();
    return creditMemoId;
  }

  function createRefundfromCM(customerId, creditMemoId) {
    var customerRefundRecord = record.create({
      type: record.Type.CUSTOMER_REFUND,
      isDynamic: true,
      defaultValues: {
        entity: customerId,
        cred: creditMemoId,
      },
    });

    customerRefundRecord.setValue("paymentmethod", "1"); //cash
    var refundId = customerRefundRecord.save();
    return refundId;
  }
  return exports;
});
