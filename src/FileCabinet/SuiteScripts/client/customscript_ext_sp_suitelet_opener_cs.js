/**
 *@name: EXTEND SUITESCRIPT SDK - Offer Modal Controller
 *@description:
 * Client script that is called by button click on Sales Order. The script
 * loops through the items to create a cart object and calls a popup suitelet
 * for the user to add a shipping protection plan.
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
        exports.openSPSuitelet = function (context) {
            console.log('Open Suitelet SP', context);

            var objCurrentRecord = currentRecord.get();
            //create item array
            var arrItemList = [];
            var stSublistId = 'item';
            var linecount = objCurrentRecord.getLineCount({
                sublistId: stSublistId
            });
            console.log('linecount', linecount);
            console.log('config', 'getting.....');
            var stExtendConfigRecId = runtime.getCurrentScript().getParameter('custscript_ext_config_rec_global');
            var objExtendConfig = EXTEND_CONFIG.getConfig(stExtendConfigRecId);
            console.log('config', objExtendConfig);

            var refIdValue = objExtendConfig.refId;
            var stExtendSPItem = objExtendConfig.shipping_plan_item;
            var stExtendItem = objExtendConfig.product_plan_item;

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
                    fieldId: 'rate',
                  line: i
                }) * 100);
                if (!intPrice || intPrice == 0) {
                    intPrice = parseInt(((objCurrentRecord.getSublistValue({ sublistId: stSublistId, fieldId: 'amount', line: i }) / intQty).toFixed(2)) * 100);
                }
            console.log('intPrice', intPrice);

                var stItemRefId = EXTEND_UTIL.getItemRefId(stItemId, objExtendConfig);
                var stItemCategory = EXTEND_UTIL.getItemCategory(stItemId, objExtendConfig);
            console.log('stItemRefId', stItemRefId);

                // var objItem = {};
                /*
                objItem.id = stItemId;
                objItem.name = stItemName;
                objItem.qty = intQty;
                objItem.category = stItemCategory;
                objItem.price = intPrice;
                objItem.refId = stItemRefId;
                */
                var objItem = {
                    'referenceId': stItemRefId,
                    'quantity': intQty,
                    'productName': stItemName,
                    'purchasePrice': intPrice,
                    'category': stItemCategory,
                    'shippable': 'true'
                }
                          console.log('objItem', objItem);

                //push to array
                // If item is not a extend item, push to array
                if (stExtendItem != stItemId && stExtendSPItem != stItemId) {
                    arrItemList.push(objItem);
                }
                          console.log('arrItemList', arrItemList);

            }
                          console.log('arrItemList', arrItemList);
/*
            var objCartJSON = {}
            objCartJSON = {
                "currency": "USD",//todo get currency
                "storeId": objExtendConfig.storeId,
                "items": arrItemList
            }
            var stCartJSON = JSON.stringify(objCartJSON);
            console.log('stCartJSON', stCartJSON);
            */
          var stCartJSON = JSON.stringify(arrItemList);
                      console.log('stCartJSON', stCartJSON);

//check for eligibility....address?


            _callSuitelet(stCartJSON, stExtendConfigRecId);
        }

        function _callSuitelet(stCartJSON, stExtendConfigRecId) {
            console.log('config', stExtendConfigRecId);
            //Resolve suitelet URL
            var slUrl = url.resolveScript({
                scriptId: 'customscript_ext_sp_offer_modal_sl',
                deploymentId: 'customdeploy_ext_sp_offer_modal_sl',
                params: {
                    'objCartJSON': stCartJSON,
                    'config': stExtendConfigRecId,
                }
            });
            console.log('slUrl', slUrl);
            //Call the pop up suitelet
            window.open(slUrl, '_blank', 'screenX=300,screenY=300,width=600,height=500,titlebar=0,status=no,menubar=no,resizable=0,scrollbars=0');

        }
        return exports;

    });