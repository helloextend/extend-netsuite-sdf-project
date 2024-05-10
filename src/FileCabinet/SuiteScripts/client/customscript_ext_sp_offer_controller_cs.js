/**
 *@name: EXTEND SUITESCRIPT SDK - Offer Modal Controller
 *@description:
 * Client script that supoorts button on Sales Order. The script
 * checks if the items are protection plan items and calls a popup suitelet
 * for the user to select the appropriate protection plan.
 *
 *@copyright Extend, Inc.
 *@author Michael Draper
 *
 *@NApiVersion 2.0
 *@NScriptType ClientScript
 *@NModuleScope Public
 */
 define([
    'N/url',
    'N/runtime',
    'N/search',
    'N/currentRecord',
    '../lib/customscript_ext_util',
    '../lib/customscript_ext_config_lib',
    '../lib/customscript_ext_api_lib'
],
function (url, runtime, search, currentRecord, EXTEND_UTIL, EXTEND_CONFIG, EXTEND_API) {
    var exports = {};
    exports.pageInit = function () {

    };
    exports.openSuitelet = function (context) {
        console.log('Open Suitelet', context);

        var objCurrentRecord = currentRecord.get();
        //create item array
        var arrItemList = [];
        var stSublistId = 'item';
        var linecount = objCurrentRecord.getLineCount({
            sublistId: stSublistId
        });
        console.log('linecount', linecount);
        console.log('config', 'getting.....');
        var stExtendConfigRecId = runtime.getCurrentScript().getParameter('custscript_ext_config_rec_cs');
        var config = EXTEND_CONFIG.getConfig(stExtendConfigRecId);
        console.log('config', config);

        var refIdValue = config.refId;
        var stExtendSPItem = config.shipping_plan_item;
        var stExtendItem = config.product_plan_item;
        
        //loop item sublist or retrieve for single line item if validate line function
        for (var i = 0; i < linecount; i++) {
            var stItemId = objCurrentRecord.getSublistValue({
                sublistId: stSublistId,
                fieldId: 'item',
                line: i
            });
            var stItemRefId = stItemId;
            var stItemName = objCurrentRecord.getSublistText({
                sublistId: stSublistId,
                fieldId: 'item',
                line: i
            });
            var intQty = objCurrentRecord.getSublistValue({
                sublistId: stSublistId,
                fieldId: 'quantity',
                line: i
            });
            var intPrice = parseInt(objCurrentRecord.getSublistValue({
                sublistId: stSublistId,
                fieldId: 'rate'
            }) * 100);

            var stItemCategory = ;
            if (refIdValue) {
                // Lookup to item to see if it is eligible for warranty offers
                var arrItemLookup = search.lookupFields({
                    type: 'item',
                    id: stItemId,
                    columns: refIdValue
                });
                console.log('arrItemLookup', arrItemLookup)
                for (var prop in arrItemLookup) {
                    var stItemRefId = arrItemLookup[prop];
                    if (!stItemRefId) {
                        var stItemRefId = arrItemLookup[prop][0].text;
                    }

                    var arrItemRefId = stItemRefId.split(": ");
                    console.log('arrItemRefId', arrItemRefId)

                    if (arrItemRefId.length > 1) {
                        stItemRefId = arrItemRefId[1]
                        console.log('stItemRefId', stItemRefId)

                    }
                    console.log('stItemRefId', stItemRefId)

                    break;
                }
            }

            var objItem = {};
            objItem.id = stItemId;
            objItem.name = stItemName;
            objItem.qty = intQty;
            objItem.category = ;
            objItem.price = intPrice;
            objItem.refId = stItemRefId;
            //push to array
            // If item is not a extend item, push to array
            if (stExtendItem != stItemId && stExtendSPItem != stItemId) {
                arrItemList.push(objItem);
            }
        }
        var stArrayItemList = JSON.stringify(arrItemList);
        console.log('stArrayItemList', stArrayItemList);
        _callSuitelet(stArrayItemList, stExtendConfigRecId);
    }

    function _callSuitelet(arrItemList, config) {
        console.log('config', config);
        //Resolve suitelet URL
        var slUrl = url.resolveScript({
            scriptId: 'customscript_ext_sp_offer_sl',
            deploymentId: 'customdeploy_ext_sp_offer_sl',
            params: {
                'arrItemid': arrItemList,
                'config' : config,
            }
        });
        console.log('slUrl', slUrl);
        //Call the pop up suitelet
        window.open(slUrl, '_blank', 'screenX=300,screenY=300,width=900,height=500,titlebar=0,status=no,menubar=no,resizable=0,scrollbars=0');

    }
    return exports;

});