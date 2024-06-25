/**
 *@name: EXTEND SUITESCRIPT SDK - Models JS
 *@description: Structures the various JSON request bodies to the Extend API
 * @NApiVersion 2.x
 */
define([
        'N/runtime',
        'N/search',
        'N/record',
        'N/error',
        '../lib/customscript_ext_api_lib',
        '../lib/customscript_ext_config_lib',
        '../lib/customscript_ext_support',

],
        function (runtime, search, record, error, EXTEND_API, EXTEND_CONFIG, EXTEND_SUPPORT) {
                var exports = {};
                /**
                 * Order Functions
                 */
                //create extend order
                exports.upsertExtendOrder = function (objSalesOrderRecord, objExtendConfig) {
                        log.audit('EXTEND UTIL _createExtendOrder:', '**ENTER**');
                        log.audit('EXTEND UTIL _createExtendOrder: SO ID', objSalesOrderRecord.id);
                        try {
                                var objExtendOrderRequestJSON = {};

                                //build order data obj
                                var objExtendData = {};
                                //get SO header data
                                objExtendData = exports.getSalesOrderInfo(objSalesOrderRecord);
                                log.audit('EXTEND UTIL _createExtendOrder: getSalesOrderInfo objExtendData', objExtendData);
                                //build array of items
                                var objExtendItemData = exports.getSalesOrderItemInfo(objSalesOrderRecord, objExtendConfig);
                                log.audit('EXTEND UTIL _createExtendOrder: objExtendItemData', objExtendItemData);
                                //format items
                                objExtendData.lineItems = exports.buildExtendItemJSON(objExtendItemData, objExtendConfig);
                                log.audit('EXTEND UTIL _createExtendOrder: objExtendData', objExtendData);

                                //build order json obj
                                objExtendOrderRequestJSON = exports.buildExtendOrderJSON(objExtendData, objExtendConfig);
                                log.audit('EXTEND UTIL _createExtendOrder: objExtendOrderRequestJSON', objExtendOrderRequestJSON);
                                //call api
                                var objExtendResponse = EXTEND_API.upsertOrder(objExtendOrderRequestJSON, objExtendConfig);
                                log.audit('EXTEND UTIL _createExtendOrder: Extend Response Object: ', objExtendResponse);
                                //handle response
                                if (objExtendResponse.code === 201 || objExtendResponse.code === 200) {
                                        var objExtendResponseBody = JSON.parse(objExtendResponse.body);
                                        exports.handleOrderResponse(objExtendResponseBody, objSalesOrderRecord);
                                        //make SO as extend order created
                                        objSalesOrderRecord.setValue({ fieldId: 'custbody_ext_order_create', value: true });
                                        var stExtendOrderId = objExtendResponseBody.id;
                                        log.debug('EXTEND UTIL _createExtendOrder: stExtendOrderId: ', stExtendOrderId);
                                        objSalesOrderRecord.setValue({ fieldId: 'custbody_ext_order_id', value: stExtendOrderId });

                                } else {
                                        log.error('EXTEND UTIL _createExtendContracts', objExtendResponse);
                                        objSalesOrderRecord.setValue({ fieldId: 'custbody_ext_process_error', value: true });
                                        // create user note attached to record
                                        var objNoteRecord = record.create({
                                                type: record.Type.NOTE,
                                        })
                                        objNoteRecord.setValue('transaction', objSalesOrderRecord.id);
                                        objNoteRecord.setValue('title', 'Extend Order Create Error');
                                        objNoteRecord.setValue('note', JSON.stringify(objExtendResponse));
                                        var stNoteId = objNoteRecord.save();
                                }

                                objSalesOrderRecord.save();
                        } catch (e) {
                                log.error('EXTEND UTIL upsertExtendOrder ERROR', e);
                                objSalesOrderRecord.setValue({ fieldId: 'custbody_ext_process_error', value: true });
                                // create user note attached to record
                                var objNoteRecord = record.create({
                                        type: record.Type.NOTE,
                                })
                                objNoteRecord.setValue('transaction', objSalesOrderRecord.id);
                                objNoteRecord.setValue('title', 'Extend Order Create Error');
                                objNoteRecord.setValue('note', JSON.stringify(objExtendResponse));
                                var stNoteId = objNoteRecord.save();
                        }

                };
                //refund item by line item transaction id
                exports.refundExtendOrder = function (objRefundData) {
                        log.audit('EXTEND UTIL _refundExtendOrder:', '**ENTER**');
                        log.audit('EXTEND UTIL _refundExtendOrder: objRefundData', JSON.stringify(objRefundData));
                        try {
                                var intQuantityToRefund = parseInt(objRefundData['QTY']);
                                var arrActiveIDs = objRefundData['activeIDs'];
                                var arrCanceledIDs = objRefundData['canceledIDs'];
                                // var objLineToRefund = {'lineItemTransactionId' : objRefundData['lineItemTransactionId']}
                                // var objContractToRefund = {'contractId' : objRefundData['lineItemTransactionId']}

                                //check if contract id has been canceled
                                function checkIfCanceled(contractToCancel, arrCanceledIDs) {
                                        return arrCanceledIDs.length > 0 ? arrCanceledIDs.includes(contractToCancel) : false;
                                }

                                var intContractsCanceled = arrCanceledIDs ? arrCanceledIDs.length : 0;
                                var intContractsStillActive = arrActiveIDs ? arrActiveIDs.length - intContractsCanceled : 0;

                                if (intContractsStillActive > 0) {
                                        log.debug('refundExtendOrder', "There is/are still " + intContractsStillActive + " active contract(s).");

                                        var config = EXTEND_CONFIG.getConfig();

                                        for (var index = 0; index < arrActiveIDs.length; index++) {
                                                var contractId = arrActiveIDs[index];
                                                var bIsCanceled = checkIfCanceled(contractId, arrCanceledIDs);

                                                if (bIsCanceled) {
                                                        log.debug('refundExtendOrder', contractId + " has been canceled.");
                                                        continue;
                                                } else {
                                                        log.debug('refundExtendOrder', "Attempting to cancel " + contractId);
                                                        var objContractToRefund = { 'contractId': contractId }
                                                        var objExtendResponse = EXTEND_API.refundContract(objContractToRefund, config);

                                                        if (objExtendResponse.code === 201) {
                                                                arrCanceledIDs.push(contractId);
                                                                log.debug("refundExtendOrder", JSON.stringify(arrCanceledIDs));
                                                        }

                                                }
                                        }
                                } else {
                                        log.error('refundExtendOrder', "All contracts have been refunded/canceled.");
                                }

                                var objRefundedRecord = record.load({
                                        type: objRefundData.TYPE,
                                        id: objRefundData.ID
                                });

                                //handle response
                                if (objExtendResponse.code === 201) {
                                        var objExtendResponseBody = JSON.parse(objExtendResponse.body);
                                        log.debug('EXTEND UTIL _refundExtendOrder: objExtendResponseBody: ', JSON.stringify(objExtendResponseBody));

                                        var lineNumber = objRefundedRecord.findSublistLineWithValue({
                                                sublistId: 'item',
                                                fieldId: 'lineuniquekey',
                                                value: objRefundData['UNIQUE_KEY']
                                        });
                                        log.debug("refundExtendOrder", "lineNumber - " + lineNumber)
                                        // exports.handleOrderResponse(objExtendResponseBody, objRefundedRecord);

                                        objRefundedRecord.setSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'custcol_ext_canceled_contract_ids',
                                                line: lineNumber,
                                                value: JSON.stringify(arrCanceledIDs)
                                        });
                                        //make transaction as extend order processed
                                        objRefundedRecord.setValue({ fieldId: 'custbody_ext_order_create', value: true });
                                        // var stExtendOrderId = objExtendResponseBody.id;

                                        // log.debug('EXTEND UTIL _refundExtendOrder: stExtendOrderId: ', stExtendOrderId);
                                        // objRefundedRecord.setValue({ fieldId: 'custbody_ext_order_id', value: stExtendOrderId });

                                } else {
                                        log.error('EXTEND UTIL _refundExtendOrder', objExtendResponse);
                                        objRefundedRecord.setValue({ fieldId: 'custbody_ext_process_error', value: true });
                                        // create user note attached to record
                                        var objNoteRecord = record.create({
                                                type: record.Type.NOTE,
                                        })
                                        objNoteRecord.setValue('transaction', objRefundedRecord.id);
                                        objNoteRecord.setValue('title', 'Extend Refund Error');
                                        objNoteRecord.setValue('note', JSON.stringify(objExtendResponse.body));
                                        var stNoteId = objNoteRecord.save();
                                }

                                objRefundedRecord.save();
                        } catch (e) {
                                log.error('EXTEND UTIL upsertExtendOrder ERROR', e);
                                objSalesOrderRecord.setValue({ fieldId: 'custbody_ext_process_error', value: true });
                                // create user note attached to record
                                var objNoteRecord = record.create({
                                        type: record.Type.NOTE,
                                })
                                objNoteRecord.setValue('transaction', objSalesOrderRecord.id);
                                objNoteRecord.setValue('title', 'Extend Order Create Error');
                                objNoteRecord.setValue('note', JSON.stringify(objExtendResponse));
                                var stNoteId = objNoteRecord.save();
                        }
                };

                /***********************************Support Functions********************************************/
                exports.handleOrderResponse = function (objExtendResponseBody, objSalesOrderRecord) {
                        try {
                                log.debug('EXTEND UTIL _createExtendOrder: Extend Response Body Parsed: ', objExtendResponseBody);
                                var arrLineItems = objExtendResponseBody.lineItems;
                                var objExtendResponseData = {};

                                log.debug('EXTEND UTIL _createExtendOrder: objExtendResponseData: ', objExtendResponseData);

                                for (var i = 0; i < arrLineItems.length; i++) {
                                        log.debug('EXTEND UTIL _createExtendOrder: arrLineItems: ', arrLineItems[i]);
                                        var line = arrLineItems[i].lineItemTransactionId;
                                        if (!line) {
                                                continue
                                        }
                                        log.debug('EXTEND UTIL _createExtendOrder: line: ', line);
                                        var line = arrLineItems[i].lineItemTransactionId;
                                        // line = line.substring(objSalesOrderRecord.id.toString().length, line.length);
                                        line = line.split('-');

                                        log.debug('EXTEND UTIL _createExtendOrder: line: ', line + '|' + typeof line);
                                        stUniqueKey = line[1];

                                        objExtendResponseData[stUniqueKey] = {};
                                        objExtendResponseData[stUniqueKey].contractIds = [];
                                        objExtendResponseData[stUniqueKey].leadTokens = [];
                                        objExtendResponseData[stUniqueKey].lineItemTransactionId = arrLineItems[i].lineItemTransactionId;
                                        if (line[2]) {
                                                objExtendResponseData[stUniqueKey].extendLine = line[2];
                                        }
                                        log.debug('EXTEND UTIL _createExtendOrder: objExtendResponseData[stUniqueKey]: ', objExtendResponseData[stUniqueKey]);

                                }
                                for (var j = 0; j < arrLineItems.length; j++) {
                                        log.debug('EXTEND UTIL _createExtendOrder: j loop arrLineItems: ', arrLineItems[j]);
                                        var line = arrLineItems[j].lineItemTransactionId;
                                        // line = line.substring(objSalesOrderRecord.id.toString().length, line.length);
                                        if (!line) {
                                                continue
                                        }
                                        line = line.split('-');
                                        stUniqueKey = line[1];

                                        if (arrLineItems[j].type == 'contract') {
                                                log.debug('EXTEND UTIL _createExtendOrder: j loop contractid arrLineItems: ', arrLineItems[j].contractId);
                                                if (arrLineItems[j].contractId) {
                                                        objExtendResponseData[stUniqueKey].contractIds.push(arrLineItems[j].contractId);
                                                }
                                        }
                                        if (arrLineItems[j].type == 'lead') {
                                                log.debug('EXTEND UTIL _createExtendOrder: j loop leadTokens arrLineItems: ', arrLineItems[j].leadToken);
                                                if (arrLineItems[j].leadToken) {
                                                        objExtendResponseData[stUniqueKey].leadTokens.push(arrLineItems[j].leadToken);
                                                }
                                        }
                                }
                                log.debug('EXTEND UTIL _createExtendOrder: objExtendResponseData', objExtendResponseData);

                                for (key in objExtendResponseData) {

                                        log.debug('EXTEND UTIL _createExtendOrder: objExtendResponseData[key].contractIds: ', key + '|' + objExtendResponseData[key].contractIds);
                                        log.debug('EXTEND UTIL _createExtendOrder: objExtendResponseData[key].leadTokens: ', key + '|' + objExtendResponseData[key].leadTokens);
                                        log.debug('EXTEND UTIL _createExtendOrder: objExtendResponseData[key].lineItemTransactionId: ', key + '|' + objExtendResponseData[key].lineItemTransactionId);

                                        // If Extend contract is created, populate the appropriate custom column field for contracts
                                        // on the Sales Order line
                                        var stContractIds = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_contract_id', line: key });
                                        var stLeadTokens = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_lead_token', line: key });
                                        log.debug('EXTEND UTIL _createExtendOrder: stContractIds | stLeadTokens: ', stContractIds + '|' + stLeadTokens + typeof stContractIds);
                                        if (stContractIds) {
                                                var arrContractIds = JSON.parse(stContractIds);
                                                objExtendResponseData[key].contractIds.concat(arrContractIds);
                                        }
                                        if (stLeadTokens) {
                                                var arrLeadTokens = JSON.parse(stLeadTokens);
                                                objExtendResponseData[key].leadTokens.concat(arrLeadTokens);
                                        }

                                        log.debug('EXTEND UTIL _createExtendOrder: newContractIds | stLeadTokens: ', objExtendResponseData[key].contractIds + '|' + objExtendResponseData[key].leadTokens + typeof objExtendResponseData[key].leadTokens);

                                        objSalesOrderRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_contract_id', line: key, value: JSON.stringify(objExtendResponseData[key].contractIds) });
                                        objSalesOrderRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_lead_token', line: key, value: JSON.stringify(objExtendResponseData[key].leadTokens) });
                                        objSalesOrderRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_line_id', line: key, value: objExtendResponseData[key].lineItemTransactionId });
                                        if (objExtendResponseData[key].extendLine) {
                                                objSalesOrderRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_contract_id', line: objExtendResponseData[key].extendLine, value: JSON.stringify(objExtendResponseData[key].contractIds) });

                                        }
                                }
                                return objSalesOrderRecord;
                        } catch (e) {
                                log.error('EXTEND UTIL upsertExtendOrder ERROR', e);
                                objSalesOrderRecord.setValue({ fieldId: 'custbody_ext_process_error', value: true });
                                // create user note attached to record
                                var objNoteRecord = record.create({
                                        type: record.Type.NOTE,
                                })
                                objNoteRecord.setValue('transaction', objSalesOrderRecord.id);
                                objNoteRecord.setValue('title', 'Extend Order Create Error');
                                objNoteRecord.setValue('note', JSON.stringify(objExtendResponse));
                                var stNoteId = objNoteRecord.save();
                        }



                };
                //get Sales Order Info required for contract create
                exports.getSalesOrderInfo = function (objSalesOrderRecord) {
                        log.debug('EXTEND UTIL _getSalesOrderInfo:', '**ENTER**');
                        var objExtendData = {};
                        log.debug('EXTEND UTIL _getSalesOrderInfo: ExtendData Object', objExtendData);
                        var objCustomerInfo = exports.getCustomerInfo(objSalesOrderRecord.getValue({ fieldId: 'entity' }));
                        //Build SO Info Object
                        objExtendData.id = objSalesOrderRecord.getValue({ fieldId: 'tranid' }) + '-' + objSalesOrderRecord.id;
                        objExtendData.tran_date = exports.getepochDate();
                        objExtendData.currency = objSalesOrderRecord.getText({ fieldId: 'currency' });
                        objExtendData.order_number = objSalesOrderRecord.getValue({ fieldId: 'tranid' });
                        objExtendData.total_amount = exports.formatToCents(objSalesOrderRecord.getValue({ fieldId: 'total' }));
                        objExtendData.shipping_total_amount = exports.formatToCents(objSalesOrderRecord.getValue({ fieldId: 'shippingcost' }));
                        objExtendData.tax_total_amount = exports.formatToCents(objSalesOrderRecord.getValue({ fieldId: 'taxtotal' }));
                        objExtendData.name = objSalesOrderRecord.getText({ fieldId: 'entity' }).replace(/[0-9]/g, '');
                        objExtendData.email = objCustomerInfo.email;
                        objExtendData.phone = objCustomerInfo.phone;
                        objExtendData.shipAdd = exports.getAddress(objSalesOrderRecord, 'shippingaddress');
                        objExtendData.billAdd = exports.getAddress(objSalesOrderRecord, 'billingaddress');
                        return objExtendData;
                };

                exports.getSalesOrderItemInfo = function (objSalesOrderRecord, objExtendConfig) {
                        var stLineCount = objSalesOrderRecord.getLineCount({ sublistId: 'item' });
                        log.debug('_getExtendData: Get Extend Data', '**ENTER**');
                        var objExtendItemData = {};
                        var stExtendProductItemId = objExtendConfig.product_plan_item;
                        var stExtendShippingItemId = objExtendConfig.shipping_plan_item;
                        log.debug('_getExtendData: stExtendShippingItemId ', stExtendShippingItemId);

                        for (var i = 0; i < stLineCount; i++) {
                                var stItemId = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                                stUniqueKey = i;
                                log.debug('isclosed', objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'isclosed', line: i }));
                                if (objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'isclosed', line: i }) === true) {
                                        continue;
                                }
                                if (!objExtendItemData[stUniqueKey] && (stExtendProductItemId !== stItemId)) {
                                        objExtendItemData[stUniqueKey] = {};
                                }
                                //Check if item is one of the configured extend items
                                if (stExtendShippingItemId === stItemId) {
                                        objExtendItemData[stUniqueKey] = {};
                                        objExtendItemData[stUniqueKey].isShipping = true;
                                        objExtendItemData[stUniqueKey].quoteId = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_quote_id', line: i });
                                        objExtendItemData[stUniqueKey].lineItemID = "" + objSalesOrderRecord.id + "-" + i;
                                        objExtendItemData[stUniqueKey].shipmentInfo = exports.getShipmentInfo(objSalesOrderRecord);
                                }
                                if (stExtendProductItemId === stItemId) {
                                        log.debug('_getExtendData: Item Found | Line ', stItemId + ' | ' + i);
                                        //get value of leadtoken column on extend line
                                        var stLeadToken = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_lead_token', line: i });
                                        if (stLeadToken) {
                                                log.debug('_getExtendData: stLeadToken ', stLeadToken);
                                                objExtendItemData[stUniqueKey] = {};
                                                objExtendItemData[stUniqueKey] = exports.getPlanLineDetails(objSalesOrderRecord, i, objExtendItemData[stUniqueKey]);
                                                objExtendItemData[stUniqueKey].isLead = true;
                                        }
                                        //
                                        else {
                                                //get related item from extend line
                                                var stExtendItemRefId = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_associated_item', line: i });
                                                var lineNumber = objSalesOrderRecord.findSublistLineWithValue({
                                                        sublistId: 'item',
                                                        fieldId: 'item',
                                                        value: stExtendItemRefId
                                                });
                                                var stRelatedItem = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: lineNumber });
                                                log.debug('_getExtendData: stRelatedItem| stExtendItemRefId ', stRelatedItem + ' | ' + stExtendItemRefId);
                                                stUniqueKey = lineNumber;
                                                if (!objExtendItemData[stUniqueKey]) {
                                                        objExtendItemData[stUniqueKey] = {};
                                                }
                                                objExtendItemData[stUniqueKey] = exports.getPlanLineDetails(objSalesOrderRecord, i, objExtendItemData[stUniqueKey]);
                                                var stRelatedItemID = "" + objSalesOrderRecord.id + "-" + i + "-" + lineNumber;
                                                objExtendItemData[stUniqueKey].lineItemID = stRelatedItemID;
                                                objSalesOrderRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_line_id', line: i, value: stRelatedItemID }); 
                                        }
                                }

                                else {
                                        // Start building the Extend Order Item Info Object
                                        objExtendItemData[stUniqueKey].itemId = stItemId
                                        objExtendItemData[stUniqueKey] = exports.getItemLineDetails(objSalesOrderRecord, i, objExtendItemData[stUniqueKey]);
                                        objExtendItemData[stUniqueKey].category = exports.getItemCategory(stItemId, objExtendConfig);
                                        if (objExtendItemData[stUniqueKey].extend_line) {
                                                objExtendItemData[stUniqueKey].lineItemID = objExtendItemData[stUniqueKey].lineItemID + "-" + objExtendItemData[stUniqueKey].extend_line;
                                        }
                                }

                        }
                        return objExtendItemData;
                };


                exports.getPlanLineDetails = function (objSalesOrderRecord, line, objExtendItemData) {

                        objExtendItemData.itemId = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_associated_item', line: line });
                        objExtendItemData.leadToken = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_lead_token', line: line });
                        objExtendItemData.quantity = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: line });
                        objExtendItemData.extend_plan_id = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_plan_id', line: line });
                        objExtendItemData.extend_line = "" + line;
                        objExtendItemData.plan_price = exports.getItemPrice(objSalesOrderRecord, line);
                        objExtendItemData[stUniqueKey].lineItemID = "" + objSalesOrderRecord.id + "-" + i;

                        return objExtendItemData;
                };

                // Start building the Extend Order Plan Info Object
                exports.getItemPrice = function (objSalesOrderRecord, line) {
                        var itemPrice = exports.formatToCents(objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: line }));
                        if (!itemPrice || itemPrice == 0) {
                                itemPrice = (objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: line }) / objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: line })).toFixed(2);
                                itemPrice = exports.formatToCents(itemPrice)
                        }
                        return itemPrice;
                };

                //set Extend Line Item Transaction ID of related product on Extend Line

                exports.getItemLineDetails = function (objSalesOrderRecord, line, objExtendItemData) {
                        objExtendItemData.quantity = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: line });
                        objExtendItemData.fulfilledQuantity = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantityfulfilled', line: line });
                        objExtendItemData.itemId = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: line });
                        objExtendItemData.line = line;
                        objExtendItemData.purchase_price = exports.getItemPrice(objSalesOrderRecord, line);
                        objExtendItemData.list_price = objExtendItemData.purchase_price;
                        objExtendItemData.title = objSalesOrderRecord.getSublistText({ sublistId: 'item', fieldId: 'item', line: line });

                        return objExtendItemData;
                };
                exports.getShipmentInfo = function (objSalesOrderRecord) {
                        var objExtendFulfillmentData = {};
                        var stUniqueKey = 0;

                        //get related IF records
                        var itemfulfillmentSearchObj = search.create({
                                type: "itemfulfillment",
                                settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                                filters:
                                        [
                                                ["type", "anyof", "ItemShip"],
                                                //                                   "AND", 
                                                //                                   ["createdfrom","anyof",objSalesOrderRecord.id], 
                                                "AND",
                                                ["appliedtotransaction", "anyof", objSalesOrderRecord.id]
                                        ],
                                columns:
                                        [
                                                search.createColumn({ name: "shipdate", label: "Ship Date" }),
                                                search.createColumn({ name: "trandate", label: "Date" }),
                                                search.createColumn({ name: "shipcarrier", label: "Shipping Carrier" }),
                                                search.createColumn({
                                                        name: "trackingnumber",
                                                        join: "shipmentPackage",
                                                        label: "Tracking Number"
                                                }),
                                                search.createColumn({
                                                        name: "contentsdescription",
                                                        join: "shipmentPackage",
                                                        label: "Contents Description"
                                                })
                                        ]
                        });
                        var searchResultCount = itemfulfillmentSearchObj.runPaged().count;
                        log.debug("itemfulfillmentSearchObj result count", searchResultCount);
                        //foreach IF record
                        itemfulfillmentSearchObj.run().each(function (result) {
                                log.debug("itemfulfillmentSearchObj  objExtendFulfillmentData", objExtendFulfillmentData);
                                objExtendFulfillmentData[stUniqueKey] = {};
                                log.debug("itemfulfillmentSearchObj  result", result);
                                //get items, tracking, carrier, shipdate
                                objExtendFulfillmentData[stUniqueKey].trackingId = result.getValue({ name: 'trackingnumber', join: 'shipmentPackage' });;
                                objExtendFulfillmentData[stUniqueKey].carrier = result.getText({ name: 'shipcarrier' });
                                objExtendFulfillmentData[stUniqueKey].shipDate = exports.getTransactionDate(result.getValue({ name: 'shipdate' }));
                                if (!objExtendFulfillmentData[stUniqueKey].shipDate) {
                                        objExtendFulfillmentData[stUniqueKey].shipDate = exports.getTransactionDate(result.getValue({ name: 'shipdate' }));
                                }
                                objExtendFulfillmentData[stUniqueKey].prodcutIds = [];
                                objExtendFulfillmentData[stUniqueKey].prodcutIds.push(result.getValue({ name: 'contentsdescription', join: 'shipmentPackage' }));
                                objExtendFulfillmentData[stUniqueKey].destAddress = exports.getAddress(objSalesOrderRecord, 'shippingaddress');
                                //optional trackingURL, source/destination
                                //objExtendFulfillmentData[stUniqueKey].sourceAddress = exports.getAddress(objSalesOrderRecord, '*****PLACEHOLDER*****');
                                //objExtendFulfillmentData[stUniqueKey].trackingUrl = result.getText({ name: '*****PLACEHOLDER*****' });

                                stUniqueKey++

                                return true;
                        });


                        //format to JSON object
                        var arrShipmentInfo = exports.buildExtendShipmentJSON(objExtendFulfillmentData);
                        log.audit('EXTEND UTIL _getShipmentInfo: arrShipmentInfo', arrShipmentInfo);

                        return arrShipmentInfo;
                };
                // Build the Extend API JSON for order lines
                exports.buildExtendItemJSON = function (objValues, objExtendConfig) {
                        //item json
                        var lineItems = [];
                        for (key in objValues) {
                                //if line is leadToken contract
                                if (objValues[key].isLead) {
                                        var item = {
                                                'leadToken': objValues[key].leadToken,
                                                'quantity': objValues[key].quantity,
                                                'lineItemTransactionId': objValues[key].lineItemID
                                        }
                                        if (objValues[key].extend_plan_id && objValues[key].plan_price) {
                                                item.plan = {
                                                        'id': objValues[key].extend_plan_id.toString(),
                                                        'purchasePrice': objValues[key].plan_price
                                                }
                                        }
                                } else if (objValues[key].isShipping) {
                                        var item = {
                                                'quoteId': objValues[key].quoteId,
                                                'lineItemTransactionId': objValues[key].lineItemID,
                                                'shipmentInfo': objValues[key].shipmentInfo
                                        }
                                }
                                else {
                                        //get product refId
                                        log.debug('_buildExtendItemJSON: objValues', objValues);
                                        objValues[key].refId = exports.getItemRefId(objValues[key].itemId, objExtendConfig);
                                        var item = {
                                                'product': {
                                                        'id': objValues[key].refId,
                                                        // 'serialNumber': objValues.serial_number,
                                                        'category': objValues[key].category,
                                                        'title': objValues[key].title,
                                                        'purchasePrice': objValues[key].purchase_price,
                                                        'listPrice': objValues[key].list_price
                                                },
                                                'quantity': objValues[key].quantity,
                                                'fulfilledQuantity': objValues[key].fulfilledQuantity,
                                                'lineItemTransactionId': objValues[key].lineItemID
                                        }
                                        if (objValues[key].extend_plan_id && objValues[key].plan_price) {
                                                item.plan = {
                                                        'id': objValues[key].extend_plan_id.toString(),
                                                        'purchasePrice': objValues[key].plan_price
                                                }
                                        }
                                }

                                lineItems.push(item);


                        }
                        log.debug('_buildExtendItemJSON: lineItems', lineItems);

                        return lineItems;
                };
                // Build the Extend API JSON for order creation
                exports.buildExtendOrderJSON = function (objValues, objExtendConfig) {
                        log.debug('EXTEND UTIL _buildExtendOrderJSON:', '**ENTER**');
                        if (objExtendConfig.email) {
                                objValues.email = objExtendConfig.email;
                        }

                        var objJSON = {
                                'currency': objValues.currency,
                                'customer': {
                                        'email': objValues.email,
                                        'name': objValues.name,
                                        'phone': objValues.phone,
                                        'billingAddress': objValues.shipAdd,
                                        'shippingAddress': objValues.billAdd
                                },
                                'saleOrigin': {
                                        'integratorId': 'NetSuite',
                                        'channel': 'NetSuite',
                                        'platform': 'NetSuite'
                                },
                                'storeId': objExtendConfig.storeId,
                                'lineItems': objValues.lineItems,
                                'total': objValues.total_amount,
                                'shippingCostTotal': objValues.shipping_total_amount,
                                'taxCostTotal': objValues.tax_total_amount,
                                'transactionId': objValues.id,
                        }

                        return objJSON;
                };
                // Build the Extend API JSON for shipment info
                exports.buildExtendShipmentJSON = function (objValues) {
                        var arrShipmentInfo = [];
                        for (key in objValues) {
                                var objShipmentInfo = {
                                        //required
                                        'productIds': objValues[key].prodcutIds,//array
                                        'shipmentDate': objValues[key].shipDate,//epoch milliseconds
                                        'shippingProvider': objValues[key].carrier,
                                        'trackingId': objValues[key].trackingId,
                                        //optional
                                        'trackingUrl': objValues[key].trackingUrl,
                                        'destination': objValues[key].destAddress,
                                        'source': objValues[key].sourceAddress

                                }
                                arrShipmentInfo.push(objShipmentInfo);
                        }
                        log.debug('_buildExtendShipmentJSON: shipmentInfo', arrShipmentInfo);

                        return arrShipmentInfo;
                };
                /***********************************Support Functions********************************************/
                //get Address Subrecord fields from transaction
                exports.getAddress = function (objRecord, addressField) {
                        var address = objRecord.getSubrecord({
                                fieldId: addressField
                        });
                        var objAddress = {
                                address1: address.getValue({
                                        fieldId: 'addr1'
                                }),
                                address2: address.getValue({
                                        fieldId: 'addr2'
                                }),
                                city: address.getValue({
                                        fieldId: 'city'
                                }),
                                province: address.getValue({
                                        fieldId: 'state'
                                }),
                                countryCode: address.getValue({
                                        fieldId: 'country'
                                }),
                                postalCode: address.getValue({
                                        fieldId: 'zip'
                                })
                        };
                        return objAddress;
                };
                //get Item's reference ID
                exports.getItemRefId = function (stItemId, objExtendConfig) {
                        //          var config = EXTEND_CONFIG.getConfig();
                        var refIdValue = objExtendConfig.refId;
                        log.debug('refIdValue ', refIdValue);
                        var stItemRefId = stItemId;
                        if (refIdValue) {
                                // Lookup to item to see if it is eligible for warranty offers
                                var arrItemLookup = search.lookupFields({
                                        type: 'item',
                                        id: stItemId,
                                        columns: refIdValue
                                });
                                for (var prop in arrItemLookup) {
                                        var stItemRefId = arrItemLookup[prop];
                                        if (!stItemRefId) {
                                                if (arrItemLookup[prop][0]) {
                                                        var stItemRefId = arrItemLookup[prop][0].text;
                                                }
                                        }
                                        if (!stItemRefId) {
                                                var stItemRefId = 'placeholder'
                                        }
                                        var arrItemRefId = stItemRefId.split(": ");
                                        if (arrItemRefId.length > 1) {
                                                stItemRefId = arrItemRefId[1]
                                                console.log('stItemRefId', stItemRefId)
                                        }
                                        break;
                                }
                        }

                        return stItemRefId;
                };

                //get Item's category ID
                exports.getItemCategory = function (stItemId, objExtendConfig) {
                        var stCategoryFieldID = objExtendConfig.category;
                        log.debug('stCategoryFieldID', stCategoryFieldID);
                        if (!stCategoryFieldID) {
                                stCategoryFieldID = 'category'; //or class?
                        }
                        try {
                                var arrLookupResults = search.lookupFields({
                                        type: 'item',
                                        id: stItemId,
                                        columns: stCategoryFieldID
                                });
                                if (arrLookupResults) {
                                        for (var prop in arrLookupResults) {
                                                var stItemCategory = arrLookupResults[prop];
                                                log.debug('object stCategory', stItemCategory);
                                                if (!EXTEND_SUPPORT.objectIsEmpty(stItemCategory)) {
                                                        log.debug('object arrLookupResults[prop][0]', arrLookupResults[prop][0]);
                                                        if (!EXTEND_SUPPORT.objectIsEmpty(arrLookupResults[prop][0])) {
                                                                stItemCategory = arrLookupResults[prop][0].text;
                                                        }
                                                }
                                                if (EXTEND_SUPPORT.stringIsEmpty(stItemCategory)) {
                                                        stItemCategory = 'placeholder';
                                                }
                                        }

                                }
                        } catch (e) {
                                stItemCategory = 'placeholder';
                        }

                        return stItemCategory;
                };
                //get Transaction Date required for contract create
                exports.getTransactionDate = function (stDate) {
                        var stTimeDate = new Date(stDate);
                        return stTimeDate.getTime() / 1000;
                };
                //get Current Date in epoch format required for contract create
                exports.getepochDate = function () {
                        var stTimeDate = new Date();
                        return stTimeDate.getTime() / 1000;
                };
                exports.formatToCents = function (amount) {
                        if (!amount) { amount = 0 }
                        parseInt(amount * 100);
                        return amount;
                };/*
                function formatCentsToDollars(value) {
                        value = (value + '').replace(/[^\d.-]/g, '');
                        value = parseFloat(value);
                        return value ? value / 100 : 0;
                }
                */
                //get Customer Info required for contract create
                exports.getCustomerInfo = function (stCustomerId) {
                        var objCustomerRecord = record.load({
                                type: 'customer',
                                id: stCustomerId
                        });
                        var objCustomerInfo = {
                                "email": objCustomerRecord.getValue({ fieldId: 'email' }),
                                "phone": objCustomerRecord.getValue({ fieldId: 'phone' }),
                                "billingAddress": exports.getAddress(objCustomerRecord, 'shippingaddress'),
                                "shippingAddress": exports.getAddress(objCustomerRecord, 'billingaddress'),
                        }
                        return objCustomerInfo;
                };
                //get Item Purchase Price
                exports.getPurchasePrice = function (stItemId) {
                        var arrFilters = [];
                        arrFilters.push(search.createFilter({ name: 'internalid', operator: 'is', values: [stItemId] }));
                        var arrColumns = [];
                        arrColumns.push(search.createColumn({ name: 'baseprice' }));

                        var arrSearchResults = EXTEND_SUPPORT.search('item', null, arrFilters, arrColumns);
                        var stPurchasePrice;
                        if (arrSearchResults.length) {
                                stPurchasePrice = arrSearchResults[0].getValue({ name: 'baseprice' });
                        }
                        return stPurchasePrice;
                };
                return exports;
        }); 