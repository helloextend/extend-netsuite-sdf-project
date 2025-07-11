/**
 * keyconfig
 * @NApiVersion 2.1
 */
define([
  "N/runtime",
  "N/search",
  "N/record",
  "../lib/customscript_ext_api_lib",
], function (runtime, search, record, EXTEND_API) {
  var exports = {};
  const objExtendEnvironment = {
    SANDBOX: 1,
    PRODUCTION: 2,
    STAGE: 3
  };
  exports.getConfig = function (stExtendConfigRecId) {
    //Get storeId & APIkey from config custom record

    var STORE_ID;
    var API_KEY;
    var API_VERSION = "latest";
    var REF_ID;
    var CAT_ID;
    var EMAIL;
    var ENVIRONMENT = "demo";
    var PRODUCT_ITEM;
    var SHIPPING_ITEM;
    var CLIENT_ID;
    var CLIENT_SECRET;
    var TOKEN_TIMESTAMP;
    var DOMAIN = "https://api-demo.helloextend.com";
    var CONFIG_ID;

    if (!stExtendConfigRecId) {
      stExtendConfigRecId = runtime
        .getCurrentScript()
        .getParameter("custscript_ext_configuration_record");
      log.audit("stExtendConfigRecId", stExtendConfigRecId);
    }
    var arrFilters = [];
    log.debug("_getConfig: stExtendConfigRecId ", stExtendConfigRecId);
    if (stExtendConfigRecId) {
      arrFilters.push(["internalId", "is", stExtendConfigRecId]);
    }
    var customrecord_ext_configurationSearchObj = search.create({
      type: "customrecord_ext_configuration",
      filters: [arrFilters],
      columns: [
        search.createColumn({
          name: "custrecord_ext_environment",
          label: "Environment ",
        }),
        search.createColumn({
          name: "custrecord_ext_api_key",
          label: "API Key",
        }),
        search.createColumn({
          name: "custrecord_ext_api_version",
          label: "API Version",
        }),
        search.createColumn({
          name: "custrecord_ext_demo_email",
          label: "Email",
        }),
        search.createColumn({
          name: "custrecord_ext_store_id",
          label: "Store ID",
        }),
        search.createColumn({ name: "custrecord_ext_ref_id", label: "Ref ID" }),
        search.createColumn({
          name: "custrecord_ext_category",
          label: "Category ID",
        }),
        search.createColumn({
          name: "custrecord_ext_pp_item",
          label: "Product Protection Item",
        }),
        search.createColumn({
          name: "custrecord_ext_sp_item",
          label: "Shipping Protection Item",
        }),
        search.createColumn({
          name: "custrecord_ext_client_id",
          label: "client_id",
        }),
        search.createColumn({ name: "custrecord_ext_client_secret" }),
        search.createColumn({ name: "custrecord_ext_token_timestamp" }),
      ],
    });
    var searchResultCount =
      customrecord_ext_configurationSearchObj.runPaged().count;
    customrecord_ext_configurationSearchObj.run().each(function (result) {
      ENVIRONMENT = result.getValue({ name: "custrecord_ext_environment" });
      log.debug("_getConfig: result", result);
      log.debug("_getConfig: ENVIRONMENT ", ENVIRONMENT);

      switch (Number(ENVIRONMENT)) {
        case objExtendEnvironment.SANDBOX:
          DOMAIN = "https://api-demo.helloextend.com";
          break;
        case objExtendEnvironment.STAGE:
          DOMAIN = "https://api-stage.helloextend.com";
          break;
        case objExtendEnvironment.PRODUCTION:
          DOMAIN = "https://api.helloextend.com";
          break;
        default:
          DOMAIN = "https://api-demo.helloextend.com";
      }
      STORE_ID = result.getValue({ name: "custrecord_ext_store_id" });
      API_KEY = result.getValue({ name: "custrecord_ext_api_key" });
      EMAIL = result.getValue({ name: "custrecord_ext_demo_email" });
      REF_ID = result.getValue({ name: "custrecord_ext_ref_id" });
      CAT_ID = result.getValue({ name: "custrecord_ext_category" });
      if (result.getValue({ name: "custrecord_ext_api_version" })) {
        API_VERSION = result.getValue({ name: "custrecord_ext_api_version" });
      }
      PRODUCT_ITEM = result.getValue({ name: "custrecord_ext_pp_item" });
      SHIPPING_ITEM = result.getValue({ name: "custrecord_ext_sp_item" });
      CLIENT_ID = result.getValue({ name: "custrecord_ext_client_id" });
      CLIENT_SECRET = result.getValue({ name: "custrecord_ext_client_secret" });
      TOKEN_TIMESTAMP = result.getValue({
        name: "custrecord_ext_token_timestamp",
      });
      CONFIG_ID = result.id;
      return true;
    });

    var objExtendConfig = {
      storeId: STORE_ID,
      key: API_KEY,
      domain: DOMAIN,
      version: API_VERSION,
      email: EMAIL, //IMPORTATN: SB and Testing environemnts requires manual assignment of a test email
      refId: REF_ID,
      category: CAT_ID,
      product_plan_item: PRODUCT_ITEM,
      shipping_plan_item: SHIPPING_ITEM,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      token_timestamp: TOKEN_TIMESTAMP,
    };

    log.debug("_getConfig: objExtendConfig ", objExtendConfig);
    log.debug("_getConfig: CLIENT_ID ", CLIENT_ID !== "");
    log.debug("_getConfig: CLIENT_SECRET ", CLIENT_SECRET !== "");
    log.debug("_getConfig: TOKEN_TIMESTAMP ", TOKEN_TIMESTAMP == "");

    //check if new token needed
    var currentTime = new Date().getTime();

    log.debug("currentTime", currentTime);

    if (
      CLIENT_ID !== "" &&
      CLIENT_SECRET !== "" &&
      (TOKEN_TIMESTAMP == "" ||
        parseInt(currentTime) - parseInt(TOKEN_TIMESTAMP) > 9000000) //9000000=2.5 hours js time in ms
    ) {
      log.debug("new token needed", TOKEN_TIMESTAMP);
      var token = EXTEND_API.getToken(objExtendConfig);
      log.debug("Token in getConfig", token);
      var valueObj = {};
      valueObj["custrecord_ext_token_timestamp"] = JSON.stringify(currentTime);
      valueObj["custrecord_ext_api_key"] = token; //replace the key with the new token
      if (token) {
        record.submitFields({
          type: "customrecord_ext_configuration",
          id: CONFIG_ID,
          values: valueObj,
        });
      }
    } else {
      log.debug("no new token required");
    }

    return objExtendConfig;
  };
  return exports;
});
