/**
 *@name: EXTEND SUITESCRIPT SDK - Sales Order Trigger Offer Controller
 *@description:
 * Plan presentation suitelet controller
 *
 *@copyright Aimpoint Technology Services, LLC
 *@author Michael Draper
 *
 *@NApiVersion 2.x
 *@NScriptType ClientScript
 *@NModuleScope Public
 */
 define(['N/url',
 '../lib/customscript_ext_util',
 '../lib/customscript_ext_support'
],
function (url, EXTEND_UTIL, EXTEND_SUPPORT) {
 var exports = {};
 exports.fieldChanged = function (context) {

     console.log('Event Handler', context);
     return true;

 };
 exports.saveRecord = function (context) {
     var objCurrentRec = context.currentRecord;
     log.debug('saveRecord client');
     console.log('saveRec function', context);

 };
 exports.handleClose = function () {
     window.close();
 }

 return exports;
});