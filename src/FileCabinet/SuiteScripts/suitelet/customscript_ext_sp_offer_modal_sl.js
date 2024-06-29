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
 *@NAmdConfig ../react/ReactLibConfig.json
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
             _renderReactForm(context); //react extend sdk form
            //_renderForm(context); //netsuite standard form
        }
        // Post Handler
        function _handlePost(context) {
            try {
                log.debug('POST: Context Object', JSON.stringify(context));

                var objRequest = context.request;
                var objExtendItem = {};
                objExtendItem.stSPItemId = objRequest.parameters.custpage_shipping_plan_item;
                objExtendItem.stQuoteId = objRequest.parameters.custpage_quote_text;
                objExtendItem.stPrice = objRequest.parameters.custpage_premium_text
                objExtendItem.stDescription = 'Extend Shipping Protection';
                log.debug('POST objExtendItem', objExtendItem);

                /*            //if sublist to display plan   
                                for (var i = 0; i < stPlanCount; i++) {
                                    var bSelected = objRequest.getSublistValue({ group: 'custpage_plans', name: 'custpage_select', line: i }) == "T" ? true : false;
                                    if (bSelected) {
                                        objExtendItem.stPrice = objRequest.getSublistValue({ group: 'custpage_plans', name: 'custpage_plan_price', line: i });
                                        break;
                                    }
                                }
                                */
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
        function _renderReactForm(context) {
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
                type: ui.FieldType.TEXT,
                label: 'Inline CART'
            });
            var testField3 = objForm.addField({
                id: 'custom_inline3',
                type: ui.FieldType.INLINEHTML,
                label: 'Inline CONFIG'
            });
            testField2.defaultValue = stArrCartJSON;
            testField3.defaultValue = stStoreId;

            // testField2.updateDisplayType({
            //     displayType: ui.FieldDisplayType.HIDDEN
            // });
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
                var objCartJSON = [];
                objCartJSON = JSON.parse(context.request.parameters.objCartJSON);
                var stConfigRec = JSON.parse(context.request.parameters.config);
                var objConfig = EXTEND_CONFIG.getConfig(stConfigRec);
                log.debug('objConfig ' + typeof objConfig, objConfig);
                var objSPJSON = {};
                objSPJSON = {
                    currency: 'USD',
                    storeId: objConfig.storeId,
                    items: objCartJSON
                }

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
                    label: 'Shipping Protection Information'
                });
                //OFFER TELESALES ASK SCRIPT
                var objOfferTextField = objForm.addField({
                    id: 'custpage_offer_text',
                    type: ui.FieldType.TEXTAREA,
                    label: 'Covers lost, stolen or damaged packages.',
                    container: 'custpage_script'
                });
                objOfferTextField.updateBreakType({
                    breakType: ui.FieldBreakType.STARTCOL
                });
                objOfferTextField.updateDisplayType({
                    displayType: ui.FieldDisplayType.INLINE
                });
                objOfferTextField.defaultValue = 'Stop planning your day around a delivery. 24/7 online support, hassle-free replacements, no additional fees.'
                var objLearnMoreField = objForm.addField({
                    id: 'custpage_learnmore_text',
                    type: ui.FieldType.URL,
                    label: 'Learn More.',
                    container: 'custpage_script'
                });
                objLearnMoreField.updateDisplayType({
                    displayType: ui.FieldDisplayType.INLINE
                });
                var objDisclaimerTextField = objForm.addField({
                    id: 'custpage_disclaimer_text',
                    type: ui.FieldType.TEXTAREA,
                    label: 'Disclaimer.',
                    container: 'custpage_script'
                });
                objDisclaimerTextField.updateBreakType({
                    breakType: ui.FieldBreakType.STARTCOL
                });
                objDisclaimerTextField.updateDisplayType({
                    displayType: ui.FieldDisplayType.INLINE
                });
                //todo script text update
               // objOfferTextField.defaultValue = "Disclaimer: x \n y\n z \n <custom training text available>";
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


                try {
                    /*
                    var objResponseMarketing = EXTEND_API.getSPMarketing(objConfig);
                    log.debug('OFFER MODAL SUITELET: Offers JSON Response Marketing', objResponseMarketing);
                    if (objResponseMarketing.code == 200) {
                        var objMarketingResponseBody = JSON.parse(objResponseMarketing.body);
                        log.debug('OFFER MODAL SUITELET: Offers JSON Response Body Config', objMarketingResponseBody);
                    }
                    */
                    var objResponseConfig = EXTEND_API.getSPConfig(objConfig);
                    log.debug('OFFER MODAL SUITELET: Offers JSON Response Config', objResponseConfig);
                    if (objResponseConfig.code == 200) {
                        var objResponseBody = JSON.parse(objResponseConfig.body);
                        log.debug('OFFER MODAL SUITELET: Offers JSON Response Body Config', objResponseBody);
                        var objResponseBodyMarketing = objResponseBody.marketing;
                        log.debug('OFFER MODAL SUITELET: objResponseBodyMarketing', objResponseBodyMarketing);
                        objDisclaimerTextField.defaultValue = objResponseBodyMarketing.learnMoreModal.disclaimerText;
                        objLearnMoreField.defaultValue = objResponseBodyMarketing.learnMoreModal.planDetailLink



                    }

                } catch (e) {
                    log.debug('error', e);
                }

                try {
                    var objResponse = EXTEND_API.getSPOffers(objSPJSON, objConfig);
                    log.debug('OFFER MODAL SUITELET: Offers JSON Response', objResponse);


                    if (objResponse.code == 200) {
                        var objQuoteResponseBody = JSON.parse(objResponse.body);
                        log.debug('OFFER MODAL SUITELET: Offers JSON Response', objQuoteResponseBody);
                        var formattedPremium = (objQuoteResponseBody.premium / 100).toFixed(2)

                        ///show  plans details
                        var objPlanGroup = objForm.addFieldGroup({
                            id: 'custpage_sp_plan',
                            label: 'Plan Information'
                        });
                        var objPlanField = objForm.addField({
                            id: 'custpage_plan_text',
                            type: ui.FieldType.TEXT,
                            label: 'Plan:',
                            container: 'custpage_sp_plan'
                        });
                        var objQuoteIdField = objForm.addField({
                            id: 'custpage_quote_text',
                            type: ui.FieldType.TEXT,
                            label: 'Quote ID:',
                            container: 'custpage_sp_plan'
                        });
                        var objPremiumField = objForm.addField({
                            id: 'custpage_premium_text',
                            type: ui.FieldType.CURRENCY,
                            label: 'Premium:',
                            container: 'custpage_sp_plan'
                        });
                        var objSPItemField = objForm.addField({
                            id: 'custpage_shipping_plan_item',
                            type: ui.FieldType.TEXT,
                            label: 'Shipping Item',
                            container: 'custpage_sp_plan'
                        });
                        objPlanField.defaultValue = objQuoteResponseBody;
                        objQuoteIdField.defaultValue = objQuoteResponseBody.id;
                        objPremiumField.defaultValue = formattedPremium;
                        objSPItemField.defaultValue = objConfig.shipping_plan_item;
                        objPlanField.updateDisplayType({
                            displayType: ui.FieldDisplayType.HIDDEN
                        });
                        objQuoteIdField.updateDisplayType({
                            displayType: ui.FieldDisplayType.HIDDEN
                        });
                        objSPItemField.updateDisplayType({
                            displayType: ui.FieldDisplayType.HIDDEN
                        });
                        objPremiumField.updateDisplayType({
                            displayType: ui.FieldDisplayType.INLINE
                        });

                    }

                } catch (e) {
                    log.debug('error', e);
                }

                // Add Submit Button
                objForm.addButton({
                    id: 'custpage_cancel',
                    label: 'Cancel',
                    functionName: 'handleClose()'
                });
                objForm.addSubmitButton('Add Plan');
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