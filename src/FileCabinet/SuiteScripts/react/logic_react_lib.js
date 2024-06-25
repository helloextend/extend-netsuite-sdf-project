/**
 * @NapiVersion 2.0
 * @NModuleScope public
 */

var logic_react_lib = {
    getReactIncludes: function() {
        return [
            '',
            '<script crossorigin src="https://unpkg.com/react@16/umd/react.development.js"></script>',
            '<script crossorigin src="https://unpkg.com/react-dom@16/umd/react-dom.development.js"></script>',
            '<script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/6.26.0/babel.min.js"></script>',
            '<script crossorigin src="https://sdk.helloextend.com/extend-sdk-client/v1/extend-sdk-client.min.js" defer="defer"></script>',
            '',
        ].join("\n")
    },
    getComponentScript : function (componentName, tagName , file) {
        switch (componentName) {
            case 'PartFinder':
                return [
                    '',
                    '<script type="text/babel">',
                    this.PartFinder(file),
                    '   ReactDOM.render(',
                    '       <PartFinder/>,',
                    '       document.getElementById("{tagName}")'.replace('{tagName}',tagName),
                    '   );',
                    '</script>',
                    '' ].join("\n")
            
            break
        }
     },
     PartFinder: function(file) {
       var fileObj = 
       file.load({
         id: 'SuiteScripts/ExtendSDK/components/logic_react_PartFinder.js'
       })
       var fileContent = fileObj.getContents()
       return fileContent
     }
}