/**
 *@name: EXTEND SUITESCRIPT SDK - ExtendClaimActions
 *@description:
 * This script Validate Single Config Custom Record per environment type
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
  "../lib/customscript_ext_util",
  "SuiteScripts/ExtendSDK/lib/customscript_ext_config_lib"
], function (runtime, record, search, EXTEND_UTIL, EXTEND_CONFIG) {
  var exports = {};
  exports.beforeLoad = function (context) {};
  exports.beforeSubmit = function (context) {
    log.debug("BEFORESUBMIT: Execution Context", runtime.executionContext);
    // log.debug("BEFORESUBMIT: Context", context);
    var recExtendClaimManagement = context.newRecord;
    var recClaimId = context.newRecord.id;
    var soId = recExtendClaimManagement.getValue("custrecord_ext_linked_order");
    var rmaId = recExtendClaimManagement.getValue(
      "custrecord_ext_linked_return"
    );
    var strProductReferenceIds = recExtendClaimManagement.getValue(
      "custrecord_ext_str_reference_ids"
    );
    var itemIds = recExtendClaimManagement.getValue(
      "custrecord_ext_str_item_ids"
    );

    var serviceType = recExtendClaimManagement.getValue(
      "custrecord_ext_service_type"
    );

    var claimStatus = recExtendClaimManagement.getValue(
      "custrecord_ext_claim_status"
    );
    var itemReceiptId = recExtendClaimManagement.getValue(
      "custrecord_ext_linked_item_receipt"
    );

    var fulfillmentMethod = recExtendClaimManagement.getValue(
      "custrecord_ext_fulfillment_method"
    );

    var recOrder = recExtendClaimManagement.getValue(
      "custrecord_ext_linked_order"
    );
    var returnRequired = recExtendClaimManagement.getValue(
      "custrecord_ext_return_required"
    );
    if (EXTEND_UTIL.stringIsEmpty(recOrder)) {
      var linkedOrderObj = {};
      var arrProductReferenceIds = recExtendClaimManagement.getValue(
        "custrecord_ext_str_reference_ids"
      );
      var extendOrderId = recExtendClaimManagement.getValue(
        "custrecord_ext_extend_order_id"
      );

      var transactionNumber = recExtendClaimManagement.getValue("custrecord_ext_transaction_number");

      if (!EXTEND_UTIL.stringIsEmpty(arrProductReferenceIds)) {
        arrProductReferenceIds = arrProductReferenceIds.split(",");
      }
      var orderDetailsObj = linkOrder(transactionNumber, arrProductReferenceIds);
      linkedOrderObj = orderDetailsObj.linkedOrderObj;
      var itemReferenceObj = orderDetailsObj.itemReferenceObj;

      log.debug("strProductReferenceIds", strProductReferenceIds);
      if (!EXTEND_UTIL.stringIsEmpty(strProductReferenceIds)) {
        arrProductReferenceIds = strProductReferenceIds.split(",");
        log.debug("arrProductReferenceIds", arrProductReferenceIds);
        itemIds = "";

        for (var i = 0; i < arrProductReferenceIds.length; i++) {
          log.debug("arrProductReferenceIds[i]", arrProductReferenceIds[i]);
          log.debug(
            " if (arrProductReferenceIds[i] in itemReferenceObj)",
            arrProductReferenceIds[i] in itemReferenceObj
          );
          if (arrProductReferenceIds[i] in itemReferenceObj) {
            itemIds += itemReferenceObj[arrProductReferenceIds[i]] + ",";
          }
        }
        itemIds = removeLastComma(itemIds);
        linkedOrderObj["custrecord_ext_str_item_ids"] = itemIds;

        log.debug("linkedOrderObj", linkedOrderObj);
        for (var key in linkedOrderObj) {
          recExtendClaimManagement.setValue({
            fieldId: key,
            value: linkedOrderObj[key],
          });
          //set customer and order
        }
      }
    }

    var fulfillmentTransactions = [];

    //Create Return Auth if return is required
    log.debug("returnRequired", returnRequired);
    if (
      EXTEND_UTIL.stringIsEmpty(rmaId) &&
      !EXTEND_UTIL.stringIsEmpty(soId) &&
      claimStatus == "assign" &&
    //   serviceType == "replacement" &&
      returnRequired
    ) {
      rmaId = createRMAFromSO(itemIds, soId, recClaimId, "returnAuthorization");
      log.debug("rmaid", rmaId);
      recExtendClaimManagement.setValue({
        fieldId: "custrecord_ext_linked_return",
        value: rmaId,
      });

      //manually done in NS
      // } else if (
      //   !EXTEND_UTIL.stringIsEmpty(rmaId) &&
      //   !EXTEND_UTIL.stringIsEmpty(soId) &&
      //   EXTEND_UTIL.stringIsEmpty(itemReceiptId) &&
      //   claimStatus == "received"
      // ) {
      //   itemReceiptId = createIRfromRMA(rmaId);
      //   recExtendClaimManagement.setValue({
      //     fieldId: "custrecord_ext_linked_item_receipt",
      //     value: itemReceiptId,
      //   });
    } else if (
      (!EXTEND_UTIL.stringIsEmpty(rmaId) || !returnRequired) &&
      !EXTEND_UTIL.stringIsEmpty(soId) &&
      (!EXTEND_UTIL.stringIsEmpty(itemReceiptId) || !returnRequired) &&
      claimStatus == "assign" &&
      fulfillmentMethod == "1" //Replacement Order
    ) {
      //Replacement Sales Order
      var replacementSOId = createRMAFromSO(
        itemIds,
        soId,
        recClaimId,
        "replacementSO"
      );
      fulfillmentTransactions.push(replacementSOId);
    } else if (
      (!EXTEND_UTIL.stringIsEmpty(rmaId) || !returnRequired) &&
      !EXTEND_UTIL.stringIsEmpty(soId) &&
      (!EXTEND_UTIL.stringIsEmpty(itemReceiptId) || !returnRequired) &&
      claimStatus == "assign" &&
      fulfillmentMethod == "2" //Refund
    ) {
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
    } else if (
      (!EXTEND_UTIL.stringIsEmpty(rmaId) || !returnRequired) &&
      !EXTEND_UTIL.stringIsEmpty(soId) &&
      (!EXTEND_UTIL.stringIsEmpty(itemReceiptId) || !returnRequired) &&
      claimStatus == "assign" &&
      fulfillmentMethod == "3" //CREDIT
    ) {
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
    return true;
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

  function createIRfromRMA(rmaId) {
    var objRecord = record.transform({
      fromType: record.Type.RETURN_AUTHORIZATION,
      fromId: rmaId,
      toType: record.Type.ITEM_RECEIPT,
      isDynamic: false,
    });

    var recItemReceiptId = objRecord.save();
    return recItemReceiptId;
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

  function linkOrder(transactionNumber, arrProductReferenceIds) {
    var itemReferenceObj = {}; //referenceId: itemId
    var stExtendConfigRecId = runtime
      .getCurrentScript()
      .getParameter("custscript_ext_config_rec_global");
    var objExtendConfig = EXTEND_CONFIG.getConfig(stExtendConfigRecId);
    var stExtendSPItem = objExtendConfig.shipping_plan_item;
    log.debug("stExtendSPItem", stExtendSPItem);
    log.debug("arrProductReferenceIds", arrProductReferenceIds);

    var arrItems = [];

    var linkedOrderObj = {};
    var transactionSearchObj = search.create({
      type: "transaction",
      settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
      filters: [
        ["custbody_ext_shopify_tran_id", "is", transactionNumber],
        "AND",
        ["mainline", "is", "F"],
        // "AND",
        // ["custcol_ext_contract_id", "contains", extendContractId],
      ],
      columns: [
        "entity",
        "tranid",
        "item",
        "type",
        "custcol_ext_plan_id",
        "custcol_ext_associated_item",
        search.createColumn({
          name: "custitem_ext_item_ref_id",
          join: "item",
        }),
        search.createColumn({
          name: "externalid",
          join: "item",
        }),
      ],
    });
    var searchResultCount = transactionSearchObj.runPaged().count;
    log.debug("transactionSearchObj result count", searchResultCount);
    transactionSearchObj.run().each(function (result) {
      log.debug("Result", result);

      if (!EXTEND_UTIL.stringIsEmpty(result.getValue("entity"))) {
        linkedOrderObj["custrecord_ext_linked_customer"] =
        result.getValue("entity");
      }
     
      var docType = result.recordType;

      if (docType == "salesorder") {
        linkedOrderObj["custrecord_ext_linked_order"] = result.id;
        //main line has no item
        var planId = result.getValue("custcol_ext_plan_id");
        var itemId = result.getValue("item");
        var itemReferenceId = result.getValue({
          name: "externalid",
          join: "item",
        });

        if (!EXTEND_UTIL.stringIsEmpty(itemReferenceId)) {
          itemReferenceObj[itemReferenceId] = itemId;
        }
        if (itemId == stExtendSPItem) {
          linkedOrderObj["custrecord_ext_has_shipping_protection"] = true;
        } else if (EXTEND_UTIL.stringIsEmpty(planId)) {
          if (arrProductReferenceIds.indexOf(itemReferenceId) > -1) {
            arrItems.push(itemId);
          }
        } else {
        }
      } else if (docType == "invoice") {
        linkedOrderObj["custrecord_ext_linked_invoice"] = result.id;
      }

      // .run().each has a limit of 4,000 results
      return true;
    });

    log.debug("arrProductReferenceIds", arrProductReferenceIds);
    log.debug("itemReferenceObj", itemReferenceObj);
    linkedOrderObj["custrecord_ext_item"] = arrItems;

    return {
      linkedOrderObj: linkedOrderObj,
      itemReferenceObj: itemReferenceObj,
    };

    /*
     customrecord_extend_claim_managementSearchObj.id="customsearch1740089127495";
     customrecord_extend_claim_managementSearchObj.title="Custom Extend Claim Management Search (copy)";
     var newSearchId = customrecord_extend_claim_managementSearchObj.save();
     */
  }
  function removeLastComma(str) {
    if (str.length > 0 && str.charAt(str.length - 1) === ",") {
      str = str.slice(0, -1);
    }
    return str;
  }
  exports.afterSubmit = function (context) {};

  return exports;
});
