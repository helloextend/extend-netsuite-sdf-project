/**
 * This is Client Side code implemented for React Suitelet in file "SL_Suitelet_React.js"
 */
/*
function PartFinder(props) {
    const [partname, setPartname] = React.useState();
    const [vendor, setVendor] = React.useState();
    const handleSubmit = event => {
        alert(partname + ' - ' + quote);
        event.preventDefault();
    };
  let testBool = false;
  

window.setTimeout(() => {
   window.Extend.config({storeId: '9e6509c1-e02a-4e1c-8526-4325214726e8', environment: 'demo'});
  console.log('test:', Extend)
  
          window.Extend.shippingProtection.render(
  {
    selector: '#extend-shipping-offer',
    items: [{
      referenceId: 10000,
      quantity: 1,
      purchasePrice: 1999,
      productName: 'testing'
    }],
    testBool,
    onEnable: function(quote){
       console.log('call back to add SP plan to cart', quote)
    },
    onDisable: function(quote){
  	   console.log('call back to remove sp plan from cart', quote)
    },
    onUpdate: function(quote){
      console.log('call back to update sp plan in cart', quote)
    },
    convertQuoteToFormattedDisplayPrice: function(quote){
      console.log('call back to convert a USD quote premium to the end user\'s display currency')
      return 'MXN$123.45'
    }
  }
)
}, 2000)
  
    return (
        <div id='extend-shipping-offer'></div>
    );
}


*/

function PartFinder(props) {
  console.log('props', props)
  var arrCart = [];
    var objCart = document.getElementById("custom_inline2_val").innerHTML;
  console.log('objCart', objCart)
arrCart = JSON.parse(objCart);
    console.log('arrCart', arrCart);
  var stStoreId = document.getElementById("custom_inline3_val").innerHTML;
  console.log('stStoreId', stStoreId)

    const [partname, setPartname] = React.useState();
    const [vendor, setVendor] = React.useState();
    const handleSubmit = event => {
        alert(partname + ' - ' + vendor);
        event.preventDefault();
    };
let testBool = false;
  

window.setTimeout(() => {
   window.Extend.config({storeId: stStoreId, environment: 'demo'});
  console.log('test:', Extend)
  
          window.Extend.shippingProtection.render(
  {
    selector: '#extend-shipping-offer',
    items: JSON.parse(objCart),
    testBool,
    onEnable: function(quote){
       console.log('call back to add SP plan to cart', quote)
    },
    onDisable: function(quote){
  	   console.log('call back to remove sp plan from cart', quote)
    },
    onUpdate: function(quote){
      console.log('call back to update sp plan in cart', quote)
    },
    convertQuoteToFormattedDisplayPrice: function(quote){
      console.log('call back to convert a USD quote premium to the end user\'s display currency')
            console.log('quote premium', quote.premium);
      var premium = quote.premium;
      premium = (premium/100).toFixed(2);
      var currency = quote.currency;
      const number = 123456.789;
      var locale = navigator.language
console.log('navigator.languages', navigator.language)
 premium =  new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).format(
    premium,
  )
            console.log('premium', premium);

      var returnFormat = currency + premium;
//'MXN$123.45'
      return returnFormat
    }
  }
)
var bSelection = window.Extend.shippingProtection.getSPUserConfig();
  console.log('user selection', window.Extend.shippingProtection.getSPUserConfig());
}, 2000)
  
    return (
        <div id='extend-shipping-offer'></div>
    );
  
  /*
    return (
        <form onSubmit={handleSubmit}>
            Item Name:<br />
            <input type="text"
                value={partname}
                onChange={(e) => setPartname(e.target.value)}
            /><br />
            <br />
            Vendor Name:<br />
            <input type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
            /><br />
            <br />
            <button>Submit</button>
        </form>    );
  */
}
