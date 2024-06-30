/**
 *@name: EXTEND SUITESCRIPT SDK - Models JS
 *@description: Structures the various JSON request bodies to the Extend API
 * @NApiVersion 2.1
 */
define([
        'N/runtime',
        'N/search',
        'N/record',
        '../lib/customscript_ext_api_lib',
        '../lib/customscript_ext_config_lib',
        '../lib/customscript_ext_support',

],
        function (runtime, search, record, EXTEND_API, EXTEND_CONFIG, EXTEND_SUPPORT) {
                var exports = {};
                /**
                 * Order Functions
                 */
                //create extend order
                exports.upsertExtendOrder = function (objSalesOrderRecord, objExtendConfig) {
                        log.audit('EXTEND UTIL _createExtendOrder:', '**ENTER**');
                        log.audit('EXTEND UTIL _createExtendOrder: SO ID', objSalesOrderRecord.id);
                        try {
                                //build order data obj
                                var objExtendData = {};

                                //get SO header data
                                objExtendData = exports.getSalesOrderInfo(objSalesOrderRecord, objExtendConfig);
                                log.audit('EXTEND UTIL _createExtendOrder: getSalesOrderInfo objExtendData', objExtendData);
                                //build array of items
                                objExtendData.lineItems = exports.getSalesOrderItemInfo(objSalesOrderRecord, objExtendConfig);
                                log.audit('EXTEND UTIL _createExtendOrder: objExtendData line items', objExtendData);
                                //format items
                                // objExtendData.lineItems = exports.buildExtendItemJSON(objExtendItemData, objExtendConfig);
                                log.audit('EXTEND UTIL _createExtendOrder: objExtendData', objExtendData);
                                //call api
                                var objExtendResponse = EXTEND_API.upsertOrder(objExtendData, objExtendConfig);
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
                                        exports.extendProcessError(objSalesOrderRecord, objExtendResponse.body);
                                }
                                objSalesOrderRecord.save();
                        } catch (e) {
                                exports.extendProcessError(objSalesOrderRecord, e);
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

                                        objRefundedRecord.setSublistValue({
                                                sublistId: 'item',
                                                fieldId: 'custcol_ext_canceled_contract_ids',
                                                line: lineNumber,
                                                value: JSON.stringify(arrCanceledIDs)
                                        });
                                        //make transaction as extend order processed
                                        objRefundedRecord.setValue({ fieldId: 'custbody_ext_order_create', value: true });

                                } else {
                                        exports.extendProcessError(objRefundedRecord, objExtendResponse.body);
                                }

                                objRefundedRecord.save();
                        } catch (e) {
                                exports.extendProcessError(objRefundedRecord, e);
                        }
                };

                /***********************************Support Functions********************************************/
                exports.handleOrderResponse = function (objExtendResponseBody, objSalesOrderRecord) {
                        try {
                                log.debug('EXTEND UTIL _createExtendOrder: Extend Response Body Parsed: ', objExtendResponseBody);
                                var arrLineItems = objExtendResponseBody.lineItems;
                                var objExtendResponseData = {};
                                //for each?
                                for (var i = 0; i < arrLineItems.length; i++) {
                                        log.debug('EXTEND UTIL _createExtendOrder: arrLineItems: ', arrLineItems[i]);
                                        var line = arrLineItems[i].lineItemTransactionId.split('-');
                                        if (!line) {
                                                continue
                                        }
                                        var stUniqueKey = line[1];
                                        if (!objExtendResponseData[stUniqueKey]) {
                                                objExtendResponseData[stUniqueKey] = {};
                                                objExtendResponseData[stUniqueKey].contractIds = [];
                                                objExtendResponseData[stUniqueKey].leadTokens = [];
                                                objExtendResponseData[stUniqueKey].lineItemTransactionId = arrLineItems[i].lineItemTransactionId;
                                        }
                                        if (line[2]) {
                                                objExtendResponseData[stUniqueKey].extendLine = line[2];
                                        }
                                        if (arrLineItems[i].type == 'contract') {
                                                log.debug('EXTEND UTIL _createExtendOrder:  loop contractid arrLineItems: ', arrLineItems[i].contractId);
                                                if (arrLineItems[i].contractId) {
                                                        objExtendResponseData[stUniqueKey].contractIds.push(arrLineItems[i].contractId);
                                                }
                                        }
                                        if (arrLineItems[i].type == 'lead') {
                                                log.debug('EXTEND UTIL _createExtendOrder:  loop leadTokens arrLineItems: ', arrLineItems[i].leadToken);
                                                if (arrLineItems[i].leadToken) {
                                                        objExtendResponseData[stUniqueKey].leadTokens.push(arrLineItems[i].leadToken);
                                                }
                                        }
                                        log.debug('EXTEND UTIL _createExtendOrder: objExtendResponseData[stUniqueKey]: ', objExtendResponseData[stUniqueKey]);

                                }
                                log.debug('EXTEND UTIL _createExtendOrder: objExtendResponseData', objExtendResponseData);

                                for (key in objExtendResponseData) {
                                        // If Extend contract is created, populate the appropriate custom column field for contracts on the Sales Order line
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
                                exports.extendProcessError(objSalesOrderRecord, e);
                        }
                };
                //get Sales Order Info required for contract create
                exports.getSalesOrderInfo = function (objSalesOrderRecord, objExtendConfig) {
                        log.debug('EXTEND UTIL _getSalesOrderInfo:', '**ENTER**');
                        var objExtendData = {};
                        var objCustomerInfo = exports.getCustomerInfo(objSalesOrderRecord.getValue({ fieldId: 'entity' }));
                        var email = objExtendConfig.email ? objExtendConfig.email : objCustomerInfo.email;
                        log.debug('EXTEND UTIL _buildExtendOrderJSON: email', email);

                        var objExtendData = {
                                'currency': objSalesOrderRecord.getText({ fieldId: 'currency' }),
                                'customer': {
                                        'email': objExtendConfig.email ? objExtendConfig.email : objCustomerInfo.email,
                                        'name': objSalesOrderRecord.getText({ fieldId: 'entity' }).replace(/[0-9]/g, ''),
                                        'phone': objCustomerInfo.phone,
                                        'billingAddress': exports.getAddress(objSalesOrderRecord, 'billingaddress'),
                                        'shippingAddress': exports.getAddress(objSalesOrderRecord, 'shippingaddress')
                                },
                                'saleOrigin': {
                                        'integratorId': 'NetSuite',
                                        'channel': 'NetSuite',
                                        'platform': 'NetSuite'
                                },
                                'storeId': objExtendConfig.storeId,
                                'total': exports.formatToCents(objSalesOrderRecord.getValue({ fieldId: 'total' })),
                                'shippingCostTotal': exports.formatToCents(objSalesOrderRecord.getValue({ fieldId: 'shippingcost' })),
                                'taxCostTotal': exports.formatToCents(objSalesOrderRecord.getValue({ fieldId: 'taxtotal' })),
                                'transactionId': objSalesOrderRecord.getValue({ fieldId: 'tranid' }) + '-' + objSalesOrderRecord.id,
                        }

                        return objExtendData;

                };

                exports.getSalesOrderItemInfo = function (objSalesOrderRecord, objExtendConfig) {
                        log.debug('_getExtendData: Get Extend Data', '**ENTER**');
                        var stLineCount = objSalesOrderRecord.getLineCount({ sublistId: 'item' });
                        var arrExtendItemData = [];
                        var stExtendProductItemId = objExtendConfig.product_plan_item;
                        var stExtendShippingItemId = objExtendConfig.shipping_plan_item;
                        for (var line = 0; line < stLineCount; line++) {
                                var stQuantity = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: line });
                                if (objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'isclosed', line: line }) === true || EXTEND_SUPPORT.stringIsEmpty(stQuantity)) {
                                        log.debug('isclosed or  disc/subtotal/group item');
                                        continue;
                                }
                                var stItemId = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: line });
                                //Check if item is one of the configured extend items
                                if (stExtendShippingItemId === stItemId) {
                                        log.debug('_getExtendData: Extend SP Item Found | Line ', stItemId + ' | ' + line);
                                        arrExtendItemData[line] = exports.getShipmentLine(objSalesOrderRecord, line, objExtendConfig);
                                }
                                else if (stExtendProductItemId === stItemId) {
                                        log.debug('_getExtendData: Extend Item Found | Line ', stItemId + ' | ' + line);
                                        //get value of leadtoken column on extend line
                                        var stLeadToken = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_lead_token', line: line });
                                        if (stLeadToken) {
                                                log.debug('_getExtendData: stLeadToken ', stLeadToken);
                                                arrExtendItemData[line] = {
                                                        'leadToken': stLeadToken,
                                                        'quantity': stQuantity,
                                                        'lineItemTransactionId': "" + objSalesOrderRecord.id + "-" + line,
                                                }
                                                //  objExtendItemData[line] = exports.getLeadLineDetails(objSalesOrderRecord, line, objExtendItemData[line]);
                                                arrExtendItemData[line] = exports.getPlanLineDetails(objSalesOrderRecord, line, arrExtendItemData[line]);
                                        } else {
                                                //get related item from extend line
                                                var stExtendItemRefId = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_associated_item', line: line });
                                                var linkedLineNumber = objSalesOrderRecord.findSublistLineWithValue({
                                                        sublistId: 'item',
                                                        fieldId: 'item',
                                                        value: stExtendItemRefId
                                                });
                                                if (!arrExtendItemData[line]) {
                                                        arrExtendItemData[line] = {};
                                                }
                                                arrExtendItemData[line] = exports.getItemLineDetails(objSalesOrderRecord, line, arrExtendItemData[line], stExtendItemRefId, objExtendConfig, linkedLineNumber);
                                                arrExtendItemData[line] = exports.getPlanLineDetails(objSalesOrderRecord, line, arrExtendItemData[line]);

                                                if (arrExtendItemData[linkedLineNumber]) {
                                                        delete arrExtendItemData[linkedLineNumber];
                                                }
                                                var stRelatedItemID = "" + objSalesOrderRecord.id + "-" + linkedLineNumber + "-" + line;
                                                arrExtendItemData[line].lineItemTransactionId = stRelatedItemID;
                                                objSalesOrderRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_line_id', line: line, value: stRelatedItemID });
                                        }
                                }
                                else {
                                        log.debug('_getExtendData: Regular Line Item ', stItemId + ' | ' + line);
                                        if (!arrExtendItemData[line]) {
                                                arrExtendItemData[line] = {};
                                        }
                                        arrExtendItemData[line] = exports.getItemLineDetails(objSalesOrderRecord, line, arrExtendItemData[line], stItemId, objExtendConfig);
                                }
                        }
                        log.debug('_getExtendData: arrExtendItemData ', JSON.stringify(arrExtendItemData));

                        const filtered = arrExtendItemData.filter(e => e);
                        log.debug('_getExtendData: filtered ', JSON.stringify(filtered));

                        return filtered;
                };

                //get warranty plan line details
                exports.getPlanLineDetails = function (objSalesOrderRecord, line, objExtendItemData) {
                        objExtendItemData.plan = {
                                'id': objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_plan_id', line: line }).toString(),
                                'purchasePrice': exports.getItemPrice(objSalesOrderRecord, line)
                        }
                        return objExtendItemData;
                }
                exports.getLeadLineDetails = function (objSalesOrderRecord, line) {
                        objExtendItemData = {
                                'leadToken': objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_lead_token', line: line }),
                                'quantity': objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: line }),
                                'lineItemTransactionId': "" + objSalesOrderRecord.id + "-" + line,
                        }
                        return objExtendItemData;
                }
                //EXTEND get sp line details
                exports.getShipmentLine = function (objSalesOrderRecord, line, objExtendConfig) {
                        lineItem = {};
                        lineItem.quoteId = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ext_quote_id', line: line });
                        lineItem.lineItemTransactionId = "" + objSalesOrderRecord.id + "-" + line;
                        lineItem.shipmentInfo = exports.getShipmentInfo(objSalesOrderRecord, objExtendConfig);
                        return lineItem;
                }
                ////EXTEND Shipment Info object from item fulfillment
                exports.getShipmentInfo = function (objSalesOrderRecord, objExtendConfig) {
                        // Build the Extend API JSON for shipment info
                        var shipmentInfo = {};
                        //get related IF records
                        var itemfulfillmentSearchObj = search.create({
                                type: "itemfulfillment",
                                filters:
                                        [
                                                ["type", "anyof", "ItemShip"],
                                                "AND",
                                                ["appliedtotransaction", "anyof", objSalesOrderRecord.id]
                                        ],
                                columns:
                                        [
                                                search.createColumn({ name: "trackingnumbers", label: "Tracking Numbers" }),
                                                search.createColumn({ name: "shipdate", label: "Ship Date" }),
                                                search.createColumn({ name: "shipcarrier", label: "Shipping Carrier" }),
                                                search.createColumn({ name: "packagecount", label: "Package Count" }),
                                                search.createColumn({ name: "shipmethod", label: "Ship Via" }),
                                                search.createColumn({ name: "item", label: "Item" }),
                                                search.createColumn({ name: "datecreated", label: "Date Created" }),
                                                search.createColumn({
                                                        name: "trackingnumber",
                                                        join: "shipmentPackage",
                                                        label: "Tracking Number"
                                                })

                                        ]
                        });
                        //foreach IF record
                        itemfulfillmentSearchObj.run().each(function (result) {
                                var key = result.getValue({ name: 'trackingnumber', join: 'shipmentPackage' });
                                if (!key) { return true; }
                                if (!shipmentInfo[key]) {
                                        shipmentInfo[key] = {};
                                        shipmentInfo[key].productIds = [];
                                }
                                //get items, tracking, carrier, shipdate
                                shipmentInfo[key].trackingId = result.getValue({ name: 'trackingnumber', join: 'shipmentPackage' });
                                shipmentInfo[key].shippingProvider = result.getText({ name: 'shipcarrier' });
                                shipmentInfo[key].shipmentDate = getEpochDate(result.getValue({ name: 'shipdate' }));
                                if (!shipmentInfo[key].shipmentDate) {
                                        shipmentInfo[key].shipmentDate = getEpochDate(result.getValue({ name: 'datecreated' }));
                                }
                                //update this
                                var stProductId = exports.getItemRefId(result.getValue({ name: 'item' }), objExtendConfig);
                                shipmentInfo[key].productIds.push(stProductId);
                                return true;

                        });
                        var arrShipmentInfo = [];
                        for (key in shipmentInfo) {
                                var objShipmentInfo = {
                                        //required
                                        'productIds': shipmentInfo[key].productIds,//array
                                        'shipmentDate': shipmentInfo[key].shipmentDate,//epoch milliseconds
                                        'shippingProvider': shipmentInfo[key].shippingProvider,
                                        'trackingId': shipmentInfo[key].trackingId,
                                }
                                arrShipmentInfo.push(objShipmentInfo);
                        }

                        return arrShipmentInfo;
                };
                //EXTEND Line Item Transaction ID & Quantity
                exports.getItemLineDetails = function (objSalesOrderRecord, line, objExtendItemData, stItemId, objExtendConfig, linkedLineNumber) {
                        var line = (EXTEND_SUPPORT.stringIsEmpty(linkedLineNumber) && linkedLineNumber !== 0) ? line : linkedLineNumber;
                        objExtendItemData.lineItemTransactionId = "" + objSalesOrderRecord.id + "-" + line;
                        objExtendItemData.quantity = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: line });
                        objExtendItemData.fulfilledQuantity = objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantityfulfilled', line: line });
                        objExtendItemData.product = {
                                'id': exports.getItemRefId(stItemId, objExtendConfig),
                                'category': exports.getItemCategory(stItemId, objExtendConfig),
                                'title': objSalesOrderRecord.getSublistText({ sublistId: 'item', fieldId: 'item', line: line }),
                                'purchasePrice': exports.getItemPrice(objSalesOrderRecord, line),
                                'listPrice': exports.getItemPrice(objSalesOrderRecord, line)
                        };

                        return objExtendItemData;
                }

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

                /***********************************Support Functions********************************************/
                //COULD BE MOVED TO SUPPORT FILE
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

                // Start building the Extend Order Plan Info Object
                exports.getItemPrice = function (objSalesOrderRecord, line) {
                        var itemPrice = exports.formatToCents(objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: line }));
                        if (!itemPrice || itemPrice == 0) {
                                itemPrice = (objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: line }) / objSalesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: line })).toFixed(2);
                                itemPrice = exports.formatToCents(itemPrice)
                        }
                        return itemPrice;
                };
                //Extend processing error create user note
                exports.extendProcessError = function (objRecord, stError) {
                        log.error('EXTEND UTIL processing ERROR', stError);
                        objRecord.setValue({ fieldId: 'custbody_ext_process_error', value: true });
                        // create user note attached to record
                        var objNoteRecord = record.create({
                                type: record.Type.NOTE,
                        })
                        objNoteRecord.setValue('transaction', objRecord.id);
                        objNoteRecord.setValue('title', 'Extend Processing Error');
                        objNoteRecord.setValue('note', JSON.stringify(stError));
                        var stNoteId = objNoteRecord.save();
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
                        return parseInt(amount * 100);
                };
                exports.formatCentsToDollars = function (value) {
                        value = (value + '').replace(/[^\d.-]/g, '');
                        value = parseFloat(value);
                        return value ? value / 100 : 0;
                };
                //get Customer Info required for contract create
                exports.getCustomerInfo = function (stCustomerId) {
                        var objCustomerRecord = record.load({
                                type: 'customer',
                                id: stCustomerId
                        });
                        var objCustomerInfo = {
                                "email": objCustomerRecord.getValue({ fieldId: 'email' }),
                                "phone": objCustomerRecord.getValue({ fieldId: 'phone' })
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
