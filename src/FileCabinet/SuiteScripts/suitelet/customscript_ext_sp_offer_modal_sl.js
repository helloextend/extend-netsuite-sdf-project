/**
 * @NapiVersion 2.x
 * @NScriptType Suitelet 
 * @NAmdConfig ../lib/ReactLibConfig.json
 *//*
define (['N/ui/serverWidget','N/file','react_lib'] , function(serverWidget,file,react_lib){
    function onRequest(context){
        if (context.request.method === "GET"){

            // Creating NetSuite Form on the Suitelet
            var form = serverWidget.createForm({
                title: "NetSuite Suitelet Implementation with ReactJS",
                                  hideNavBar: true

            })

            // Add an inline HTML field 
            var field1 = form.addField({
                id: 'custom_inline',
                type: serverWidget.FieldType.INLINEHTML,
                label: "Inline"
            })
          var field2 = form.addField({
                id: 'custom_inline2',
                type: serverWidget.FieldType.INLINEHTML,
                label: "Inline Cart"
            })
          var objCart = [{
            referenceId: 10000,
      quantity: 1,
      purchasePrice: 1999,
      productName: 'testing'
          },
                         {
                           referenceId: 10000,
      quantity: 2,
      purchasePrice: 21999,
      productName: 'testing'
                         }]
      
field2.defaultValue = JSON.stringify(objCart);
            var ComponentScript = react_lib.getComponentScript('PartFinder' , 'dynHTML',file)
            
            // Add the html 
            field1.defaultValue = react_lib.getReactIncludes() +  '<div id="dynHTML" />' + ComponentScript


// Add Submit Button
                form.addButton({
                    id: 'custpage_cancel',
                    label: 'Cancel',
                    functionName: 'handleClose()'
                });
                form.addSubmitButton('Submit');
          
            context.response.writePage(form)
        }
    }
    return {
        onRequest: onRequest
    }
})

*/






/**
 *@name: EXTEND SUITESCRIPT SDK - SP Offer Modal Suitelet
 *@description:
 *  Suitelet called by Sales Order client script to display shpping protection offer
 *  in a popup window. The user can then select coverage and on submit,
 *  the suitelet will post and append a new line for the Shipping Protection non-inventory item
 *  with the description and pricing.
 *
 *@copyright Extend, Inc.
 *@author Michael Draper
 *
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 *@NModuleScope Public
 *@NAmdConfig ../lib/ReactLibConfig.json
 */
 define([
    'N/ui/serverWidget',
    'N/runtime',
  'N/file',
    'N/http',
    'N/error',
    'N/log',
    '../lib/customscript_ext_api_lib',
    '../lib/customscript_ext_config_lib',
    'react_lib'

],
    function (ui, runtime, file, http, error, log, EXTEND_API, EXTEND_CONFIG, react_lib) {

        var exports = {};

        exports.onRequest = function (context) {
            var objEventRouter = {};

            objEventRouter[http.Method.GET] = _handleGet;
            objEventRouter[http.Method.POST] = _handlePost;

            if (!objEventRouter[context.request.method]) {
                _handleError(context);
            }
            try {
                objEventRouter[context.request.method](context);
            } catch (e) { }
        };


        function _handleGet(context) {
            _renderReactForm(context);
           // _renderForm(context);
        }
        // Post Handler
        function _handlePost(context) {
            try {
                log.debug('POST: Context Object', JSON.stringify(context));

                var objRequest = context.request;

                var objExtendItem = {};

                var stPlanCount = objRequest.getLineCount({ group: 'custpage_plan' });

                // objExtendItem.stWarrantyItemId = runtime.getCurrentScript().getParameter({ name: 'custscript_ext_protection_plan' });
                //var extendConfigRec =
                objExtendItem.stWarrantyItemId = JSON.parse(objRequest.parameters.custpage_config).product_plan_item;

                //Line Number
                // var stProductLine = objRequest.parameters.custpage_line_num;
                // log.debug('POST: Product Line', stProductLine);

                objExtendItem.stItemId = objRequest.parameters.custpage_item_select;
                objExtendItem.stItemName = objRequest.parameters.custpage_item_name.trim();
                objExtendItem.stItemQty = objRequest.parameters.custpage_item_qty;
                objExtendItem.stRefId = objRequest.parameters.custpage_item_ref_id;
                objExtendItem.stLeadToken = objRequest.parameters.custpage_lead_input;
                objExtendItem.stPlanId = '';
                objExtendItem.stPrice = 0;
                objExtendItem.stDescription = 'Extend Shipping Protection';

                // Get line information from selected line
                for (var i = 0; i < stPlanCount; i++) {

                    var bSelected = objRequest.getSublistValue({ group: 'custpage_plans', name: 'custpage_select', line: i }) == "T" ? true : false;

                    if (bSelected) {
                        objExtendItem.stPrice = objRequest.getSublistValue({ group: 'custpage_plans', name: 'custpage_plan_price', line: i });
                        objExtendItem.stDescription = _getDescription(objExtendItem.stTerm);
                        objExtendItem.stDescription += ' | ' + objExtendItem.stItemName;
                        break;
                    }
                }
                log.debug('objExtendItem', objExtendItem);

                var html = _buildhtml(objExtendItem);
                // Write repsponse
                context.response.write(html);

            } catch (e) {
                log.error('POST error', e);
            }
        }
        function _buildhtml(objExtendItem) {
            // Prepare window.opener html to post values back to the line
            try {
                var html = "<html>";
                html += " <body>";
                html += " <script language='JavaScript'>";
                html += " if(window.opener) {";
                html += " window.opener.nlapiSetFieldValue('custbody_ext_warranty_order', true, true, true);";
                html += " window.opener.nlapiSetCurrentLineItemValue('item', 'item'," + objExtendItem.stSPItemId + ", true, true);";
                html += " window.opener.nlapiSetCurrentLineItemValue('item', 'rate'," + objExtendItem.stPrice + ", true, true);";
                html += " window.opener.nlapiSetCurrentLineItemValue('item', 'quantity'," + 1 + ", true, true);";
                html += " window.opener.nlapiSetCurrentLineItemValue('item', 'description', '" + objExtendItem.stDescription + "', true, true);";
                html += " window.opener.nlapiSetCurrentLineItemValue('item', 'custcol_ext_quote_id', '" + objExtendItem.stQuoteId + "', true, true);";
                html += " window.opener.nlapiCommitLineItem('item');";
                html += " };";
                html += " window.close();";
                html += " </script>";
                html += " </body>";
                html += "</html>";

                return html;
            } catch (e) {
                log.error('POST error', e);

            }
        };
        function _handleError(context) {

            throw error.create({
                name: "SSS_UNSUPPORTED_REQUEST_TYPE",
                message: "Suitelet only supports GET and POST",
                notifyOff: true
            });
        };
        //Build React Suitelet Form
        function _renderReactForm(context){
                          log.debug('GET context', context);
          log.debug('GET Params', context.request.parameters);
                // Get plans and populate sublist
                log.debug('objCartJSON', context.request.parameters.objCartJSON + typeof context.request.parameters.objCartJSON);
                var stArrCartJSON = context.request.parameters.objCartJSON;
                var stConfigRec = context.request.parameters.config;
                var objConfig = EXTEND_CONFIG.getConfig(stConfigRec);
                log.debug('objConfig ' + typeof objConfig, objConfig);
var stStoreId = objConfig.storeId;
          // Create the form
                var objForm = ui.createForm({
                    title: 'Extend Shipping Protection',
                    hideNavBar: true
                });
                // Add an inline HTML field
                var testField = objForm.addField({
                    id: 'custom_inline',
                    type: ui.FieldType.INLINEHTML,
                    label: 'Inline'
                });
var testField2 = objForm.addField({
                    id: 'custom_inline2',
                    type: ui.FieldType.INLINEHTML,
                    label: 'Inline CART'
                });
          var testField3 = objForm.addField({
                    id: 'custom_inline3',
                    type: ui.FieldType.INLINEHTML,
                    label: 'Inline CONFIG'
                }); 
testField2.defaultValue = stArrCartJSON;
          testField3.defaultValue = stStoreId;
// Add Submit Button
                objForm.addButton({
                    id: 'custpage_cancel',
                    label: 'Cancel',
                    functionName: 'handleClose()'
                });
                objForm.addSubmitButton('Submit');
                    
          var componentScript = react_lib.getComponentScript('PartFinder', 'dynHTML', file);
                                              log.debug('componentScript', componentScript);

                // Add the html
                testField.defaultValue = react_lib.getReactIncludes() + '<div id="dynHTML" />' + componentScript;
                context.response.writePage(objForm);
        };
        // Builds Suitelet Form
        function _renderForm(context) {
            try {
                log.debug('GET Params', context.request.parameters);
                // Get plans and populate sublist
                log.debug('objCartJSON', context.request.parameters.objCartJSON + typeof context.request.parameters.objCartJSON);
                var objCartJSON = {};
                objCartJSON = JSON.parse(context.request.parameters.objCartJSON);
                var stConfigRec = JSON.parse(context.request.parameters.config);
                var objConfig = EXTEND_CONFIG.getConfig(stConfigRec);
                log.debug('objConfig ' + typeof objConfig, objConfig);


                // Create the form
                var objForm = ui.createForm({
                    title: 'Extend Shipping Protection',
                    hideNavBar: true
                });
                
                /**
                 * HEADER FIELDS
                 */
                //Hidden field of item array
                var objItemListField = objForm.addField({
                    id: 'custpage_item_list',
                    type: ui.FieldType.TEXTAREA,
                    label: 'Item List'
                });
                objItemListField.updateDisplayType({
                    displayType: ui.FieldDisplayType.HIDDEN
                });
                if (context.request.parameters.objCartJSON) {
                    objItemListField.defaultValue = context.request.parameters.objCartJSON;

                }
                //Hidden field for config
                var objConfigField = objForm.addField({
                    id: 'custpage_config',
                    type: ui.FieldType.LONGTEXT,
                    label: 'config'
                });
                objConfigField.updateDisplayType({
                    displayType: ui.FieldDisplayType.HIDDEN
                });
                if (context.request.parameters.config) {
                    objConfigField.defaultValue = context.request.parameters.config;

                }

                //Telesales Script Group
                var objScriptGroup = objForm.addFieldGroup({
                    id: 'custpage_script',
                    label: 'Telesales Script'
                });
                //OFFER TELESALES ASK SCRIPT
                var objOfferTextField = objForm.addField({
                    id: 'custpage_offer_text',
                    type: ui.FieldType.TEXTAREA,
                    label: 'Customer Ask:',
                    container: 'custpage_script'
                });
                objOfferTextField.updateBreakType({
                    breakType: ui.FieldBreakType.STARTCOL
                });
                objOfferTextField.updateDisplayType({
                    displayType: ui.FieldDisplayType.INLINE
                });
                //todo script text update
                objOfferTextField.defaultValue = "We have several protection plans available for your purchase \n These protection plans cover accidental damage in addition to standard defects \n Would you be interested in protecting your purchase with us today? \n <custom training text available>";
                //Next Steps Group
                var objProcessGroup = objForm.addFieldGroup({
                    id: 'custpage_process',
                    label: 'Adding an Extend Shipping Protection Plan'
                });
                //OFFER TELESALES INSTRUCTION SCRIPT
                var objProcessScript = objForm.addField({
                    id: 'custpage_process_text',
                    type: ui.FieldType.TEXTAREA,
                    label: 'Instructions',
                    container: 'custpage_process'
                });
                objProcessScript.updateBreakType({
                    breakType: ui.FieldBreakType.STARTCOL
                });
                objProcessScript.updateDisplayType({
                    displayType: ui.FieldDisplayType.INLINE
                });
                objProcessScript.defaultValue = "1. Inform the customer of the plan offering using the compliant script above \n 3. Click on the blue 'Add Plan' button to add the shipping protection plan and return to the order \n 4. If the customer does not want a shipping protection plan, simply click cancel";

                var objItemGroup = objForm.addFieldGroup({
                    id: 'custpage_item',
                    label: 'Item'
                });

                // Add Submit Button
                objForm.addButton({
                    id: 'custpage_cancel',
                    label: 'Cancel',
                    functionName: 'handleClose()'
                });
                objForm.addSubmitButton('Add Plan');
                /**
                 * POPULATE SUBLIST
                 */
                try {
                    var objResponse = EXTEND_API.getSPOffers(objCartJSON, objConfig);
                    log.debug('OFFER MODAL SUITELET: Offers JSON Response', objResponse);


                    if (objResponse.code == 200) {
                        var objResponseBody = JSON.parse(objResponse.body);
                        log.debug('OFFER MODAL SUITELET: Offers JSON Response', objResponseBody);

                    }

                } catch (e) {
                    log.debug('error', e);
                }

                try {
                    var objResponseMarketing = EXTEND_API.getSPMarketing(objConfig);
                    log.debug('OFFER MODAL SUITELET: Offers JSON Response', objResponseMarketing);

                    var objResponseConfig = EXTEND_API.getSPMarketing(objConfig);
                    log.debug('OFFER MODAL SUITELET: Offers JSON Response', objResponseConfig);
                    if (objResponseConfig.code == 200) {
                        var objResponseBody = JSON.parse(objResponseConfig.body);
                        log.debug('OFFER MODAL SUITELET: Offers JSON Response', objResponseBody);

                    }

                } catch (e) {
                    log.debug('error', e);
                }

                //Set Client handler
                objForm.clientScriptModulePath = '../client/customscript_ext_sp_offer_modal_controller.js';
                //Write Page
                context.response.writePage(objForm);
            } catch (e) {
                log.error('error in write page', e);
            }
        };
        return exports;

    });