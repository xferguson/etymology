/*globals
    jQuery, $, d3, console, window
*/
var EtyTree = {
    create: function() {
        var etyBase = Object.create(this);
        var bindModules = function(base, modules) {
            for (var i = modules.length - 1; i >= 0; i--) {
                if (!window[modules[i]]) {
                    console.error('Module ' + modules[i] + 'is not loaded.');
                    return false;
                }
                window[modules[i]].bindModule(base, modules[i]);
            }
        };
        etyBase.config = {
            modules: ['DB', 'GRAPH', 'LOAD'],
            debug: false,
            urls: {
                ENDPOINT: "https://etytree-virtuoso.wmflabs.org/sparql"
            }
        };
        bindModules(etyBase, etyBase.config.modules);
        return etyBase;
    },
    init: function() {
        var etyBase = this;

        /* Load init function for every module */
        etyBase.config.modules.forEach((moduleName) => {
            if (etyBase[moduleName] && (typeof etyBase[moduleName].init === 'function')) {
                etyBase[moduleName].init();
            }
        });
    }
};

var ety;

jQuery('document').ready(function($) {
    ety = EtyTree.create();
    ety.init();
});