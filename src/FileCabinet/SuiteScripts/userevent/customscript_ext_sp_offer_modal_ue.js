/**
 *@name: EXTEND SUITESCRIPT SDK - Offer Modal Controller
 *@description:
 * User Event script that shows a button on Sales Order to call a popup suitelet
 * for the user to add a shipping protection plan.
 *
 *@copyright Extend, Inc.
 *@author Michael Draper
 *
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
define(['N/runtime',
        'N/log'], function (runtime, log) {
                // Add button for Suitelet
                var exports = {};
                exports.beforeLoad = function (context) {


                        var objEventRouter = {
                                'create': _addButton,
                                'edit': _addButton
                        }

                        if (typeof objEventRouter[context.type] !== 'function') {
                                return true;
                        }

                        objEventRouter[context.type](context);
                        return true;

                }
                function _addButton(context) {
                        try {
                                const recCurrent = context.newRecord;
                                log.debug(recCurrent);
                                var stRecordStatus = recCurrent.getValue({
                                        fieldId: 'status'
                                    });
                                    log.debug(stRecordStatus);

                                if (context.type == 'create' || stRecordStatus == 'Pending Approval' || stRecordStatus == 'Pending Fulfillment') {
                                        const objForm = context.form;
                                        objForm.clientScriptModulePath = '../client/customscript_ext_sp_offer_controller_cs.js';
                                        objForm.addButton({
                                                id: 'custpage_open_sp_suitelet',
                                                label: 'Add Shipping Protection Plan',
                                                functionName: 'openSPSuitelet()'
                                        });
                                }

                        } catch (error) {
                                log.error('beforeLoad_addButton', error.message);
                        }
                }

                return exports;


        });