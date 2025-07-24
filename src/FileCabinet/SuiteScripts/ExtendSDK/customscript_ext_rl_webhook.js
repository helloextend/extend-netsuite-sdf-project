/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define([
  "N/record",
  "N/search",
  "N/format",
  "N/runtime",
  "SuiteScripts/ExtendSDK/lib/customscript_ext_util",
  "SuiteScripts/ExtendSDK/lib/customscript_ext_config_lib",
], (record, search, format, runtime, EXTEND_UTIL, EXTEND_CONFIG) => {
  /**
   * Defines the function that is executed when a GET request is sent to a RESTlet.
   * @param {Object} requestParams - Parameters from HTTP request URL; parameters passed as an Object (for all supported
   *     content types)
   * @returns {string | Object} HTTP response body; returns a string when request Content-Type is 'text/plain'; returns an
   *     Object when request Content-Type is 'application/json' or 'application/xml'
   * @since 2015.2
   */
  const get = (requestParams) => {
    return "hello World";
  };

  /**
   * Defines the function that is executed when a PUT request is sent to a RESTlet.
   * @param {string | Object} requestBody - The HTTP request body; request body are passed as a string when request
   *     Content-Type is 'text/plain' or parsed into an Object when request Content-Type is 'application/json' (in which case
   *     the body must be a valid JSON)
   * @returns {string | Object} HTTP response body; returns a string when request Content-Type is 'text/plain'; returns an
   *     Object when request Content-Type is 'application/json' or 'application/xml'
   * @since 2015.2
   */
  const put = (requestBody) => {};

  /**
   * Defines the function that is executed when a POST request is sent to a RESTlet.
   * @param {string | Object} requestBody - The HTTP request body; request body is passed as a string when request
   *     Content-Type is 'text/plain' or parsed into an Object when request Content-Type is 'application/json' (in which case
   *     the body must be a valid JSON)
   * @returns {string | Object} HTTP response body; returns a string when request Content-Type is 'text/plain'; returns an
   *     Object when request Content-Type is 'application/json' or 'application/xml'
   * @since 2015.2
   */
  const post = (requestBody) => {
    try {
      log.debug("requestBody", requestBody);
      // var requestBody = JSON.parse(requestBody);

      //check if claim id exists
      var claimId = requestBody.claimId;
      var claimRecId = checkClaimCreated(claimId);
      var recClaimManagement;

      if (claimRecId) {
        recClaimManagement = record.load({
          type: "customrecord_extend_claim_management",
          id: claimRecId,
        });
      } else {
        recClaimManagement = record.create({
          type: "customrecord_extend_claim_management",
        });
      }

      recClaimManagement.setValue({
        fieldId: "name",
        value: requestBody.claimId,
      });
      recClaimManagement.setValue({
        fieldId: "custrecord_ext_claim_id",
        value: requestBody.claimId,
      });

      recClaimManagement.setValue({
        fieldId: "custrecord_ext_claim_status",
        value: requestBody.type,
      });

      //service order webhook
      if ("serviceOrderId" in requestBody) {
        var serviceOrderId = requestBody["serviceOrderId"];
        var currentServiceOrders = recClaimManagement.getValue(
          "custrecord_ext_service_order_ids"
        );
        var arrCurrentServiceOrders = currentServiceOrders.split(",");
        if (arrCurrentServiceOrders.indexOf(serviceOrderId) == -1) {
          //service order id not found in current list

          if (EXTEND_UTIL.stringIsEmpty(currentServiceOrders)) {
            recClaimManagement.setValue({
              fieldId: "custrecord_ext_service_order_ids",
              value: serviceOrderId,
            });
          } else {
            recClaimManagement.setValue({
              fieldId: "custrecord_ext_service_order_ids",
              value: currentServiceOrders + "," + serviceOrderId,
            });
          }
        }
      } else {
        //claims specific webhook
        var strLineItemIds = "";
        var strProductTitles = "";
        var arrProductReferenceIds = [];
        var strProductReferenceIds = "";
        for (var i = 0; i < requestBody.products.length; i++) {
          strLineItemIds += requestBody.products[i].lineItemId + ",";
          strProductTitles += requestBody.products[i].title + ",";
          strProductReferenceIds += requestBody.products[i].referenceId + ",";
          arrProductReferenceIds.push(requestBody.products[i].referenceId);
        }
        strProductTitles = removeLastComma(strProductReferenceIds);
        strProductReferenceIds = removeLastComma(strProductReferenceIds);
        strLineItemIds = removeLastComma(strLineItemIds);

        recClaimManagement.setValue({
          fieldId: "custrecord_ext_item_name",
          value: strProductTitles,
        });

        recClaimManagement.setValue({
          fieldId: "custrecord_ext_str_reference_ids",
          value: strProductReferenceIds,
        });

        recClaimManagement.setValue({
          fieldId: "custrecord_ext_extend_line_item_id",
          value: strLineItemIds,
        });

        var claimType = requestBody.claimType;
        recClaimManagement.setValue({
          fieldId: "custrecord_ext_claim_type",
          value: claimType,
        });
        var extendOrderId = requestBody.orderId;

        recClaimManagement.setValue({
          fieldId: "custrecord_ext_extend_order_id",
          value: extendOrderId,
        });
      }

      recClaimManagement.setValue({
        fieldId: "custrecord_ext_transaction_number",
        value: requestBody.transactionId,
      });

      var responseDate = new Date(requestBody.incident["IncidentDate"]);
      var formattedDate = format.format({
        value: responseDate,
        type: format.Type.DATE,
      });
      log.debug("formatted Incident Date", formattedDate);

      recClaimManagement.setValue({
        fieldId: "custrecord_claim_date",
        value: new Date(formattedDate),
      });

      var extendContractId = requestBody.contractId;
      recClaimManagement.setValue({
        fieldId: "custrecord_ext_contract_id",
        value: extendContractId,
      });

      // var recOrder = recClaimManagement.getValue("custrecord_ext_linked_order");
      // if (EXTEND_UTIL.stringIsEmpty(recOrder)) {
      //   var linkedOrderObj = {};
      //   var orderDetailsObj = linkOrder(extendOrderId, arrProductReferenceIds);
      //   linkedOrderObj = orderDetailsObj.linkedOrderObj;
      //   var itemReferenceObj = orderDetailsObj.itemReferenceObj;

      //   log.debug("strProductReferenceIds",strProductReferenceIds);
      //   if (!EXTEND_UTIL.stringIsEmpty(strProductReferenceIds)) {
      //     arrProductReferenceIds = strProductReferenceIds.split(",");
      //     log.debug("arrProductReferenceIds", arrProductReferenceIds);

      //     for (var i = 0; i < arrProductReferenceIds.length; i++) {
      //       log.debug("arrProductReferenceIds[i]",arrProductReferenceIds[i]);
      //       log.debug(" if (arrProductReferenceIds[i] in itemReferenceObj)", (arrProductReferenceIds[i] in itemReferenceObj));
      //       if (arrProductReferenceIds[i] in itemReferenceObj) {
      //         strItemIds += itemReferenceObj[arrProductReferenceIds[i]] + ",";
      //       }
      //     }
      //     strItemIds = removeLastComma(strItemIds);
      //     linkedOrderObj["custrecord_ext_str_item_ids"] = strItemIds;

      //     log.debug("linkedOrderObj", linkedOrderObj);
      //     for (var key in linkedOrderObj) {
      //       recClaimManagement.setValue({
      //         fieldId: key,
      //         value: linkedOrderObj[key],
      //       });
      //       //set customer and order
      //     }
      //   }
      // }
      var claimId = recClaimManagement.save();
      log.debug("claimId", claimId);

      var objNoteRecord = record.create({
        type: record.Type.NOTE,
      });
      // objNoteRecord.setValue("recordtype", "customrecord_extend_claim_management");
      objNoteRecord.setValue("recordtype", "1626");

      objNoteRecord.setValue("record", claimId);
      objNoteRecord.setValue("title", "Webhook Response");
      objNoteRecord.setValue("note", JSON.stringify(requestBody));
      var stNoteId = objNoteRecord.save();

      log.debug("stNoteId", stNoteId);
    } catch (error) {
      log.error("Error in post", error);
    }
  };

  /**
   * Defines the function that is executed when a DELETE request is sent to a RESTlet.
   * @param {Object} requestParams - Parameters from HTTP request URL; parameters are passed as an Object (for all supported
   *     content types)
   * @returns {string | Object} HTTP response body; returns a string when request Content-Type is 'text/plain'; returns an
   *     Object when request Content-Type is 'application/json' or 'application/xml'
   * @since 2015.2
   */
  const doDelete = (requestParams) => {};
  const checkClaimCreated = (claimId) => {
    var isCreated = false;
    var customrecord_extend_claim_managementSearchObj = search.create({
      type: "customrecord_extend_claim_management",
      filters: [
        ["custrecord_ext_claim_id", "is", claimId],
        "AND",
        ["isinactive", "is", "F"],
      ],
      columns: ["name", "id", "scriptid"],
    });
    var searchResultCount =
      customrecord_extend_claim_managementSearchObj.runPaged().count;
    log.debug(
      "customrecord_extend_claim_managementSearchObj result count",
      searchResultCount
    );
    customrecord_extend_claim_managementSearchObj.run().each(function (result) {
      // .run().each has a limit of 4,000 results
      isCreated = result.id;
      return true;
    });

    return isCreated;

    /*
     customrecord_extend_claim_managementSearchObj.id="customsearch1740089127495";
     customrecord_extend_claim_managementSearchObj.title="Custom Extend Claim Management Search (copy)";
     var newSearchId = customrecord_extend_claim_managementSearchObj.save();
     */
  };

  function removeLastComma(str) {
    if (str.length > 0 && str.charAt(str.length - 1) === ",") {
      str = str.slice(0, -1);
    }
    return str;
  }

  return { get, put, post, delete: doDelete };
});
