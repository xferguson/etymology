/*globals
    d3, console, unionSparql, ENDPOINT, debug, dagreD3, GraphNode, sortUnique, ancestorSparql, descendantSparql, dataSparql, Node, Rx, getXMLHttpRequest
*/
/*jshint loopfunc: true, shadow: true */ // Consider removing this and fixing these
function refreshScreen1() {
    //clean screen
    d3.select("#tree-overlay").remove();
    d3.select("#message").html("");
    d3.select("#p-helpPopup").remove();
    d3.select("#myPopup").style("display", "none");

    //change help message     
    d3.select("#helpPopup")
        .append("p")
        .attr("id", "p-helpPopup")
        .attr("class", "help")
        .html("<b>Disambiguation page</b>" +
            "<br>Pick the word you are interested in." +
            "<ul>" +
            "<li>Click on a circle to display the language</li>" +
            "<li>Click on a word to display lexical information</li>" +
            "<li>Double click on a circle to choose a word</li>" +
            "</ul>");
}

function refreshScreen2() {
    d3.select("#message")
        .html("This word is not available in the database");
}

//TODO: use wheel 
function refreshScreen3() {
    d3.select("#tree-overlay").remove();
    d3.select("#myPopup")
        .style("display", "none");
    d3.select("#message")
        .html("Loading, please wait...");
}

function refreshScreen4(s) {
    d3.select("#myPopup").html("");
    d3.select(s)
        .append("a")
        .attr("href", "#myPopup")
        .attr("data-rel", "popup")
        .attr("data-transition", "pop");
    d3.select("#myPopup")
        .style("width", "auto")
        .style("height", "auto")
        .style("display", "inline");
}

function refreshScreen5() {
    d3.select("#tree-overlay").remove();
    d3.select("#myPopup")
        .style("display", "none");
    d3.select("#message").html("");
}

function refreshScreen6() {
    d3.select("#message")
        .html("Sorry, the server cannot extract etymological relationships correctly for this word.");
}

function refreshScreen7() {
    d3.select("#p-helpPopup").remove();
    d3.select("#helpPopup")
        .append("p")
        .attr("id", "p-helpPopup")
        .attr("class", "help")
        .html("Arrows go from ancestor to descendant.<ul>" +
            "<li>Click on a circle to display the language</li>" +
            "<li>Click on a word to display lexical information.</li>" +
            "</ul>");
}

function refreshScreen8() {
    d3.select("#message")
        .html("Sorry, no etymology is available for this word!");
}

function refreshScreen9() {
    d3.select("#message")
        .html("This word is related to many words. Please wait a bit more.");
}

function serverError(error) {
    refreshScreen6();
    console.log(error);
}

//function to slice up a big sparql query (that cannot be processed by virtuoso)
// into a bunch of smaller queries in chunks of "chunk"
function slicedQuery(myArray, mySparql, chunk) {
    var i, j, tmpArray, url, sources = [];
    for (i = 0, j = myArray.length; i < j; i += chunk) {
        tmpArray = myArray.slice(i, i + chunk);
        //console.log(unionSparql(tmpArray, mySparql));
        url = ENDPOINT + "?query=" + encodeURIComponent(unionSparql(tmpArray, mySparql));
        console.log(url);
        sources.push(getXMLHttpRequest(url));
    }
    const query = Rx.Observable.zip.apply(this, sources)
        .catch((err) => {
            refreshScreen6();
            //Return an empty Observable which gets collapsed in the output
            return Rx.Observable.empty();
        });
    return query;
}

function toggleNode(inner, g, d) {
    var render = new dagreD3.render();
    g.graphNodes[d].der = false;
    g.graphNodes[d];
    g.graphNodes[d].linkedToTarget.map(function(e) {
        g.graphNodes[e].der = false;
        g.graphNodes[e].linked = false;
        g.graphNodes[e].isAncestor = false;
        g.graphNodes[e].linkedToSource = false;
        g.graphNodes[e].source = false;
    });
    g.graphNodes[d].linkedToTarget = false;
    render(inner, g)

    // function collapse(d) {
        // var dNode = d3.selectAll('d.node').node(d);
        // if (dNode.linkedToTarget) {
        //     dNode._children = dNode.linkedToTarget;
        //     dNode._children.forEach(collapse);
        //     dNode.remove();
        //     // dNode.linkedToTarget = null;
        // }
    // }

    // d3.select('d.node').node(d).forEach(collapse);
    // update(root);

}

function appendDefinitionTooltip(inner, g) {
    var touchtime = 0;
    //show tooltip on click on nodes                    
    inner.selectAll("g.node")
        .on("click", function(d) {
            if (touchtime === 0) {
                //set first click
                touchtime = new Date().getTime();
            } else {
                if ((new Date().getTime()) - touchtime < 800) {
                    toggleNode(inner, g, d);
                    touchtime = 0;
                } else {
                    refreshScreen4(this);
                    var iri = g.node(d).iri;
                    console.log(iri[0]);
                    for (var i in iri) {
                        g.nodess[iri[i]].showTooltip(d3.event.pageX, d3.event.pageY);
                    }
                    d3.event.stopPropagation();
                    touchtime = new Date().getTime();
                }
            }
        })
        .on("mousedown", function() {
            d3.event.stopPropagation();
        });
}

function appendLanguageTagTextAndTooltip(inner, g) {
    //append language tag to nodes        
    inner.selectAll("g.node")
        .append("text")
        .attr("id", "isotext")
        .style("width", "auto")
        .style("height", "auto")
        .style("display", "inline")
        .attr("y", "2em")
        .html(function(v) { return g.node(v).iso; });
    //show tooltip on click on laguage tag
    inner.selectAll("g.node")
        .append("rect")
        .attr("y", "1.1em")
        .attr("width", function(v) { return g.node(v).iso.length / 1.7 + "em"; })
        .attr("height", "1em")
        .attr("fill", "red")
        .attr("fill-opacity", 0)
        .on("mouseover", function(d) {
            d3.select(this).style("cursor", "pointer");
        })
        .on("click", function(d) {
            d3.select("#myPopup")
                .style("display", "none");
            refreshScreen4(this);
            d3.select("#myPopup").html(function() {
                    return g.node(d).lang;
                })
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
            d3.event.stopPropagation();
        })
        .on("mousedown", function() { d3.event.stopPropagation(); });
}

function appendDefinitionTooltipOrDrawDAGRE(inner, g, width, height) {
    var touchtime = 0;
    inner.selectAll("g.node")
        .on('click', function(d) {
            if (touchtime === 0) {
                //set first click 
                touchtime = new Date().getTime();
            } else {
                var iri = g.node(d).iri;
                if ((new Date().getTime()) - touchtime < 800) {
                    //double click occurred  
                    refreshScreen3();

                    drawDAGRE(iri, 2, width, height);
                    touchtime = 0;
                } else {
                    refreshScreen4(this);
                    g.nodess[iri].showTooltip(d3.event.pageX, d3.event.pageY);
                    d3.event.stopPropagation();
                    touchtime = new Date().getTime();
                }
            }
        })
        .on("mousedown", function() {
            d3.event.stopPropagation();
        });
}

function drawDisambiguation(response, width, height) {
    if (response !== undefined && response !== null) {
        refreshScreen1();

        var graph = JSON.parse(response).results.bindings;
        if (graph.length === 0) {
            refreshScreen2();
        }

        var g = new dagreD3.graphlib.Graph().setGraph({});

        //define nodes
        g.nodess = {};
        graph.forEach(function(n) {
            var iris = n.et.value.split(",");
            iris.forEach(function(element) {
                if (element !== "") {
                    g.nodess[element] = new Node(element);
                } else {
                    g.nodess[n.iri.value] = new Node(n.iri.value);
                }
            });
        });
        if (debug) {
            console.log(g.nodess);
        }


        var m = null;
        for (var n in g.nodess) {
            g.setNode(n, g.nodess[n]);
            if (null !== m) {
                g.setEdge(n, m, { label: "", style: "stroke-width: 0" });
            }
            m = n;
        }

        var inner = renderGraph(g, width, height);
        appendLanguageTagTextAndTooltip(inner, g);
        appendDefinitionTooltipOrDrawDAGRE(inner, g, width, height);

        d3.selectAll(".edgePath").remove();
    }
}


function drawDAGRE(iri, parameter, width, height) {
    //if parameter == 1 submit a short (but less detailed) query
    //if parameter == 2 submit a longer (but more detailed) query
    var url = ENDPOINT + "?query=" + encodeURIComponent(ancestorSparql(iri, parameter));
    if (debug) {
        console.log(url);
    }
    const source = getXMLHttpRequest(url);

    source.subscribe(
        function(response) {
            refreshScreen5();
            if (null === response) {
                refreshScreen6();
                return;
            }
            refreshScreen7();
            var ancestorArray = [];
            JSON.parse(response).results.bindings.forEach(function(element) {
                ancestorArray.push(element.ancestor1.value);
                if (undefined !== element.ancestor2) {
                    ancestorArray.push(element.ancestor2.value);
                    ancestorArray = sortUnique(ancestorArray);
                }
            });

            console.log("ANCESTORS");
            console.log(ancestorArray);
            const subscribe = slicedQuery(ancestorArray, descendantSparql, 8)
                .subscribe(
                    function(val) { //val = 8 crashes sometimes                       
                        var descendantArray = [];
                        val.forEach(function(element) {
                            var tmp = JSON.parse(element).results.bindings;
                            for (var t in tmp) {
                                descendantArray.push(tmp[t].descendant1.value);
                            }
                        });
                        const subscribe = slicedQuery(descendantArray, dataSparql, 8)
                            .subscribe(function(val) {
                                var graphArray = [];
                                val.forEach(function(element) {
                                    var tmp = JSON.parse(element).results.bindings;
                                    for (var t in tmp) {
                                        graphArray.push(tmp[t]);
                                    }
                                });
                                if (graphArray.length === 0) {
                                    refreshScreen8();
                                } else {
                                    var g = defineGraph(ancestorArray, graphArray);
                                    var inner = renderGraph(g, width, height);
                                    appendLanguageTagTextAndTooltip(inner, g);
                                    appendDefinitionTooltip(inner, g);
                                }
                            });
                    },
                    error => serverError(error),
                    () => console.log('done DAGREZIP'));
        },
        function(error) {
            if (parameter === 1) {
                serverError(error);
            } else {
                refreshScreen9();
                drawDAGRE(iri, 1, width, height);
            }
        },
        function() {
            console.log('done DAGRE' + parameter);
        });
}

function defineGraph(ancestors, response) {
    var g = new dagreD3.graphlib.Graph().setGraph({ rankdir: 'LR' });


    //CONSTRUCTING NODES
    g.nodess = {};
    response.forEach(function(element) {
        //save all nodes        
        //define isAncestor
        if (undefined !== element.s && (undefined === g.nodess[element.s.value] || null === g.nodess[element.s.value])) {
            g.nodess[element.s.value] = new Node(element.s.value);
            if (ancestors.indexOf(element.s.value) > -1) {
                g.nodess[element.s.value].isAncestor = true;
            }
        }
        if (undefined !== element.rel && (undefined === g.nodess[element.rel.value] || null === g.nodess[element.rel.value])) {
            g.nodess[element.rel.value] = new Node(element.rel.value);
            if (ancestors.indexOf(element.rel.value) > -1) {
                g.nodess[element.s.value].isAncestor = true;
            }
        }
        if (undefined !== element.rel && undefined !== element.eq) {
            if (undefined === g.nodess[element.eq.value] || null === g.nodess[element.eq.value]) {
                g.nodess[element.eq.value] = new Node(element.eq.value);
            }
            if (ancestors.indexOf(element.eq.value) > -1) {
                g.nodess[element.eq.value].isAncestor = true;
            }
            //push to eqIri
            g.nodess[element.rel.value].eqIri.push(element.eq.value);
            g.nodess[element.eq.value].eqIri.push(element.rel.value);
        }
        if (undefined !== element.der) {
            if (undefined === g.nodess[element.der.value] || null === g.nodess[element.der.value]) {
                g.nodess[element.der.value] = new Node(element.der.value);
            }
            //add property der
            g.nodess[element.s.value].der = true;
        }
    });

    //CONSTRUCTING GRAPHNODES
    //a graphNode is some kind of super node that merges Nodes that are etymologically equivalent
    //or that refer to the same word - also called here identical Nodes 
    //(e.g.: if only ee_word and ee_n_word with n an integer belong to                                                                          
    //the set of ancestors and descendants                                                                                                
    //then merge them into one graphNode) 
    //the final graph will use these super nodes (graphNodes)  
    g.graphNodes = {};
    var counter = 0; //counts how many graphNodes have been created so far
    for (var n in g.nodess) {
        if (g.nodess[n].ety === 0) {
            var tmp = [];
            var iso = g.nodess[n].iso;
            var label = g.nodess[n].label;
            for (var m in g.nodess) {
                if (undefined !== g.nodess[m]) {
                    if (g.nodess[m].iso === iso && g.nodess[m].label === label) {
                        if (g.nodess[m].ety > 0) {
                            tmp.push(m);
                        }
                    }
                }
            }
            tmp = sortUnique(tmp);
            //if only ee_word and ee_n_word with n an integer belong to
            //the set of ancestors and descendants
            //then merge them in one graphNode
            if (tmp.length === 1) {
                var gg = new GraphNode(counter);
                //initialize graphNode.all 
                gg.all.push(n);
                //define graphNode.iri 
                gg.iri = g.nodess[tmp[0]].eqIri;
                gg.iri.push(tmp[0]);
                //define node.graphNode
                g.nodess[n].graphNode.push(counter);
                g.nodess[tmp[0]].graphNode.push(counter);
                gg.iri.forEach(function(element) {
                    g.nodess[element].graphNode.push(counter);
                });

                //push to graphNodes
                g.graphNodes[counter] = gg;
                g.graphNodes[counter].iri = sortUnique(g.graphNodes[counter].iri);
                counter++;
            }
        }
    }

    for (var n in g.nodess) {
        if (g.nodess[n].graphNode.length === 0) {
            //add iri
            var gg = new GraphNode(counter);
            gg.iri = g.nodess[n].eqIri;
            gg.iri.push(n);
            var tmp = [];
            gg.iri.forEach(function(element) {
                tmp.concat(element.eqIri);
            });
            gg.iri.concat(tmp);
            gg.iri = sortUnique(gg.iri);
            gg.iri.forEach(function(element) {
                g.nodess[element].graphNode.push(counter);
            });
            g.graphNodes[counter] = gg;
            counter++;
        } else {
            var graphNode = g.nodess[n].graphNode[0];

            g.nodess[n].eqIri.forEach(function(element) {
                //add iri
                g.nodess[element].graphNode.push(graphNode);
                g.graphNodes[graphNode].iri.concat(g.nodess[element].eqIri);
                g.graphNodes[graphNode].iri = sortUnique(g.graphNodes[graphNode].iri);
            });
        }
    }

    var showDerivedNodes = true;
    if (ancestors.length < 3) showDerivedNodes = true;

    for (var gg in g.graphNodes) {
        //define all
        g.graphNodes[gg].all = g.graphNodes[gg].all.concat(g.graphNodes[gg].iri);

        //define isAncestor
        if (g.graphNodes[gg].all.filter(function(element) { return g.nodess[element].isAncestor; }).length > 0) {
            g.graphNodes[gg].isAncestor = true;
        }

        //define der
        var der = g.graphNodes[gg].all.filter(function(element) {
            return g.nodess[element].der !== undefined;
        });
        if (der.length > 0) {
            g.graphNodes[gg].der = true;
        }

        //define iso, label, lang
        g.graphNodes[gg].iso = g.nodess[g.graphNodes[gg].all[0]].iso;
        g.graphNodes[gg].label = g.graphNodes[gg].iri.map(function(i) { return g.nodess[i].label; }).join(",");
        g.graphNodes[gg].lang = g.nodess[g.graphNodes[gg].all[0]].lang;
    }

    //define linkedToTarget and linkedToSource
    response.forEach(function(element) {
        if (element.rel !== undefined && element.s !== undefined) {
            var source = g.nodess[element.rel.value].graphNode[0],
                target = g.nodess[element.s.value].graphNode[0];

            if (source !== target) {
                if (showDerivedNodes) {
                    g.graphNodes[source].linkedToTarget.push(target);
                } else {
                    //linkedToTarget only counts the number of descendants that are not derived words
                    if (!(g.graphNodes[source].der || g.graphNodes[target].der)) {
                        g.graphNodes[source].linkedToTarget.push(target);
                    }
                }
                if (g.graphNodes[target].linkedToSource.indexOf(source) === -1) {
                    g.graphNodes[target].linkedToSource.push(source);
                }
            }
        }
    });

    for (var gg in g.graphNodes) {
        //collapse nodes that have more than 10 descendants and color them differently      
        if (!showDerivedNodes && g.graphNodes[gg].linkedToTarget.length > 10) {
            console.log("the following node has more than 10 targets: collapsing");
            console.log(g.graphNodes[gg]);
            g.graphNodes[gg].linkedToTarget.map(function(e) {
                if (g.graphNodes[e].linkedToSource.length === 1) {
                    g.graphNodes[e].der = true;
                }
            });

            //    graphNodes[gg].linkedToTarget.map(function(e){  graphNodes[e].der = true; });
            g.graphNodes[gg].style = "fill: sandyBrown; stroke: lightBlue";
        }
    }

    //CONSTRUCTING LINKS
    var links = [];
    response.forEach(function(element) {
        if (undefined !== element.rel && undefined !== element.s) {
            var source = g.nodess[element.rel.value].graphNode[0],
                target = g.nodess[element.s.value].graphNode[0];
            if (source !== target) {
                if (showDerivedNodes || g.graphNodes[target].isAncestor || !(g.graphNodes[source].der || g.graphNodes[target].der)) {
                    var Link = { "source": source, "target": target };
                    if (g.graphNodes[target].linkedToSourceCopy.indexOf(source) === -1) {
                        //define linked and linkedToSourceCopy
                        links.push(Link);
                        g.graphNodes[source].linked = true;
                        g.graphNodes[target].linkedToSourceCopy.push(source);
                        g.graphNodes[target].linked = true;
                    }
                }
            }
        }
    });

    //INITIALIZING NODES IN GRAPH
    //only draw nodes that are linked to other nodes
    //always show ancestors
    for (var gg in g.graphNodes) {
        if (g.graphNodes[gg].linked || g.graphNodes[gg].isAncestor) {
            g.setNode(gg, g.graphNodes[gg]);
        }
    }

    //INITIALIZING LINKS IN GRAPH
    links.forEach(function(element) {
        g.setEdge(element.source,
            element.target, { label: "", lineInterpolate: "basis" });
    });

    return g;
}

function renderGraph(g, width, height) {
    var svg = d3.select("#tree-container").append("svg")
        .attr("id", "tree-overlay")
        .attr("width", width)
        .attr("height", height)
        .on("click", function() {
            d3.select("#myPopup")
                .style("display", "none");
        });

    var inner = svg.append("g");

    // Set up zoom support                      
    var zoom = d3.behavior.zoom().on("zoom", function() {
        inner.attr("transform", "translate(" + d3.event.translate + ")" +
            "scale(" + d3.event.scale + ")");
    });
    svg.call(zoom);

    // Create the renderer          
    var render = new dagreD3.render();

    // Run the renderer. This is what draws the final graph.  
    render(inner, g);

    // Center the graph       
    var initialScale = 0.75;
    zoom.translate([(width - g.graph().width * initialScale) / 2, 20])
        .scale(initialScale)
        .event(svg);

    //svg.attr("height", g.graph().height * initialScale + 40);}}
    return inner;
}