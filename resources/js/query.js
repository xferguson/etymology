$('document').ready(function(){
    var debug = true;
    var excludeStarLikeStructures = true;
    var mergeEquivalentNodes = true;
    //load languages
    if (debug) console.log("loading languages");
    var langMap = new Map();
    var ssv = d3.dsv(";", "text/plain"); 
    ssv("../data/etymology-only_languages.csv", function(data) {
	data.forEach(function(entry){ 
	    langMap.set(entry["code"], entry["canonical name"]);
	    })
    });

    ssv("../data/list_of_languages.csv", function(data) {
	data.forEach(function(entry){
	    langMap.set(entry["code"], entry["canonical name"]);
	    })
    });

    d3.text("../data/iso-639-3.tab", function(error, textString){
        var headers = ["Id", "Part2B", "Part2T", "Part1", "Scope", "Language_Type", "Ref_Name", "Comment"].join("\t");
        var data = d3.tsv.parse(headers + textString);
	data.forEach(function(entry){
	    langMap.set(entry["Id"], entry["Ref_Name"]);
	});
    });

    var div = d3.select("body").append("div")
        .attr("data-role", "popup")
        .attr("data-dismissible", "true")
        .attr("id", "myPopup")
	.attr("class", "ui-content")
	.style("position", "absolute")
	.style("background", "lightBlue")
	.style("text-align", "left")
	.style("padding", "2px")
	.style("font", "12px sans-serif")
	.style("border", "0px")
	.style("border-radius", "8px");

    //define margins and size
    var margin = [0, 0, 0, 0],
    width = window.innerWidth - margin[0],
    height = window.innerHeight - margin[0] - margin[2];
    
    var endpoint = "http://etytree-virtuoso.wmflabs.org/sparql";
    var mime = "application/sparql-results+json";

    //TODO: this is not working
    function reloadTree(){
	console.log("reloading with " + filter);
    }

    var filter = ".";
    //"filter (<LONG::IRI_RANK> (?ancestor)<1000) .";    
    var treeSparql = function(id, filter){
	var treeQuery = [
            "define input:inference \"etymology_ontology\"",
            "PREFIX dbetym: <http://kaiko.getalp.org/dbnaryetymology#>",
            "PREFIX owl: <http://www.w3.org/2002/07/owl#>",
            "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>",
            "select distinct ?target1 ?target2 ?target3 ?target4 ?source (group_concat(distinct ?ee ; separator=\",\") as ?ref) ?iso (group_concat(distinct ?p ; separator=\",\") as ?ety) ?word ?pos ?gloss (group_concat(distinct ?links ; separator=\",\") as ?link){",
            "?source ?p ?o . filter (?p in (dbetym:etymologicallyDerivesFrom,dbetym:descendsFrom,dbetym:derivesFrom,dbetym:etymologicallyEquivalentTo))",
            "{select ?source",
            "{?source dbetym:etymologicallyRelatedTo{1,} " + id + " . } LIMIT 100}",
	    "UNION",
            "{select ?source",
            "{" + id + " dbetym:etymologicallyRelatedTo{1,} ?source . } LIMIT 100}",
            " UNION",
            "{select ?source",
            "{" + id + " dbetym:etymologicallyRelatedTo{1,} ?ancestor ",
            filter,
            "     ?source dbetym:etymologicallyRelatedTo{1,} ?ancestor .} LIMIT 100}",
            "OPTIONAL {?source rdfs:label ?l .}",
            "            BIND (STR(?l)  AS ?word1) .",
	    "OPTIONAL {?source rdfs:seeAlso ?links .}",
            "OPTIONAL {?source dbnary:refersTo ?ee .",
            "          ?ee dbnary:refersTo ?cf1 .",
            "          ?cf1 dbnary:partOfSpeech ?pos1 .",
                        "          ?cf1 lemon:sense ?sense1 .",
            "          ?sense1 lemon:definition ?val1 .",
            "          ?val1 lemon:value ?def1}",
            "OPTIONAL {?source dbetym:etymologicallyDerivesFrom ?target1}",
            "OPTIONAL {?source dbetym:derivesFrom ?target2}",
            "OPTIONAL {?source dbetym:descendsFrom ?target3}",
            "OPTIONAL {?source dbetym:etymologicallyEquivalentTo ?target4}",
            "OPTIONAL {?source dbnary:refersTo ?le .",
            "          ?le lemon:canonicalForm ?cf2 .",
            "          ?cf2 lemon:writtenRep ?ww .",
            "          ?le dbnary:partOfSpeech ?pos2 .",
            "          ?le lemon:sense ?sense2 .",
            "          ?sense2 lemon:definition ?val2 .",
            "          ?val2 lemon:value ?def2 .}",
            "            BIND (STR(?ww)  AS ?word2) .",
            "BIND(if (bound(?word1),?word1,?word2) AS ?word )",
            "BIND(if (bound(?pos1),?pos1,?pos2) AS ?pos )",
            "BIND(if (bound(?def1),?def1,?def2) AS ?gloss )",
            "BIND(strbefore(replace(str(?source),\"http://kaiko.getalp.org/dbnary/eng/\",\"\",\"i\"),\"/\") AS ?ll)",
            "BIND(if (?ll = \"\",\"eng\",?ll) AS ?iso )",
            "}"
        ];
	return treeQuery.join(" ");
    }

    function transform(d) {
        return "translate(" + d.x + "," + d.y + ")";
    }
    
    function reduceIRI(e){
        return e.replace("http://kaiko.getalp.org/dbnary/eng/", "").replace(/_[0-9]+_/g,"_");//.replace("_2_","_").replace("_3_","_");
    }
    
    function fromIRItoWord(e){
        return e.replace(/__ee_[0-9]+_/g,"").replace("__ee_","").replace("__","'").replace(/^_/g,"*").replace(/_/g," ");
    }

    $('#tags').on("keypress click", function(e){
        if (e.which == 13 || e.type === 'click') {
            var searchedWord = $('#tags').val();
	    var searchedIso = undefined;

	    if (debug) console.log("loading nodes");
	    loadNodes(searchedWord, langMap, endpoint);

	    function loadTree(d) {
		var nodeId = "<" + d.id + ">";
		
		var splitted = reduceIRI(d.id).split("/");
                searchedIso = (splitted.length > 1) ? splitted[0] : "eng";

		var treeUrl = endpoint + "?query=" + encodeURIComponent(treeSparql(nodeId, filter));
		
		if (debug) { 
                    console.log(nodeId)
		    console.log(endpoint); 
		    console.log(treeUrl);
		}

		//TODO: use wheel
		d3.select("#tree-container")
		    .insert("p", ":first-child")
		    .attr("id", "message")
		    .attr("align", "center")
		    .html("Loading, please wait...");

		//TODO: MANAGE ERROR and RELOAD FROM CALLBACK
		d3.xhr(treeUrl, mime, function(request) {
		    //clean screen
		    d3.select("#tree-overlay").remove();
		    div.style("opacity", 0);
		    d3.select("#message").remove();
		    if (request == null){
			//print error message
                        d3.select("#tree-container")
                            .append("p")
                            .attr("id", "message")
			    .attr("align", "center")
                            .html("Sorry, the server cannot extract etymological relationships correctly for this word. <br>We are working to fix this!")
                            .append("p")
			    .attr("id", "messageReload")
                            .attr("align", "center")
                            //.html("<input type=\"button\" id=\"loadTree\" value=\"Reload with filter\" onclick=\"reloadTree()\"/>");
			optionalFilter = ". filter (<LONG::IRI_RANK> (?ancestor)<1000) ."; 
		    } else {
			//change help       
			d3.select("#p-helpPopup").remove(); 
			d3.select("#helpPopup")
			    .append("p")
			    .attr("id", "p-helpPopup")
			    .attr("style", "font-size:12px;border-radius:8px;max-width:255px")
			    .html("<ul><li>Click on a circle to display the language</li> <li>Click on a word to display the data.</li></ul>");
			
			var treeJson = JSON.parse(request.responseText);
			var treeGraph = treeJson.results.bindings;
			if (debug) { console.log(treeGraph) };
			var treeSparqlLinks = [];
			var treeSparqlNodes = {};
			
			//set nodes
			function treeNode(id, word, iso, gloss, pos, link){
			    if (word == undefined) {
				this.id = id;
				var splitted = id.split("/");
                                this.iso = (splitted.length > 1) ? splitted[0] : "eng";
				this.word = [];
                                this.word.push((splitted.length > 1) ? fromIRItoWord(splitted[1]) : fromIRItoWord(splitted[0]));
				this.gloss = ["-"];
				this.pos = [""];
				this.link = [""];
			    } else {
				this.id = id;
				this.word = [];
				this.word.push((word == undefined) ? "?" : word.value.replace("__","'").replace(/^_/g,"*").replace(/_/g," "));
				this.iso = iso.value;
				this.gloss = [];
				this.gloss.push((gloss == undefined) ? "-" : gloss.value);
				this.pos = [];
				this.pos.push((pos == undefined) ? "" : pos.value);
				this.link = [];
				this.link.push((link == undefined) ? "" : link.value);
			    }
			    //TODO: improve this function
			    this.mergeInto = function(nodes, pos, gloss){
                                var merge = false;
                                for (var i in nodes){
                                    if (nodes[i].et != undefined){
                                        if (nodes[i].iso == this.iso){
                                            if (nodes[i].word == this.word){
						if (nodes[i].et == this.et) {
                                                    if (this.refersTo != undefined){
                                                        nodes[i].pos = [];
                                                        nodes[i].refersTo = this.refersTo;
                                                    }
                                                    nodes[i].pos.push(pos);
                                                    nodes[i].gloss.push(gloss);
                                                    merge = true;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                                return merge;
                            }

			    this.printWord = function(separator){
				var toreturn = "";
				this.word.forEach(function(d){ toreturn += d + separator; });
				return toreturn.slice(0, -1); //trim the last separator
                            }

			    this.printData = function(){
				var toreturn = "";
				for (var i=0; i<this.word.length; i++){
				    
				    toreturn += "<b>" + this.word[i] + "</b>";
				    var pos = this.pos[i];
				    if (pos != ""){
					toreturn += " - " + this.pos[i];
				    }
				    toreturn += "<br><br>";
				    var gloss = this.gloss[i];
				    if (gloss != ""){
					toreturn += this.gloss[i];
				    }
				    var link = this.link[i];
				    if (link != ""){
					toreturn += this.printLinks(link);
				    }
				    toreturn += "<br><br><hr>";
				}
				return toreturn.slice(0, -12);
			    }

			    this.printLinks = function(l){
				var toreturn = "";
				var links = l.split(",");
				if (links.length == 0) return toreturn;
				toreturn = "<br><br>as extracted from: ";
				links.forEach(function(element, i) {
				    var a = element.split("/");
				    var b = a[a.length-1].split("#");
				    toreturn = toreturn + " <a href=\"" + element + "\" target=\"_blank\">" + b[1].replace(/_/g," ") + " " + b[0].replace(/_/g," ") +"</a>\n";
				});
				
				return toreturn;
			    }
			}

			treeGraph.forEach(function(element, j){
			    var mySourceNodeId = reduceIRI(element.source.value);
			    var mySourceNode = new treeNode(mySourceNodeId, element.word, element.iso, element.gloss, element.pos, element.link);
			    //if (treeSparqlNodes[mySourceNodeId] == undefined){
				treeSparqlNodes[mySourceNodeId] = mySourceNode;
			    //} else {
				mySourceNode.mergeInto(treeSparqlNodes, element.pos, element.gloss);
				//merge treeSparqlNodes[mySourceNodeId] with mySourceNode
			    //}
			    ["target1", "target2", "target3", "target4"].map(function(target){
				//console.log(element[target])
				if (element[target] != undefined) {
				    var myTargetNodeId = reduceIRI(element[target].value);
				    if (treeSparqlNodes[myTargetNodeId] == undefined) {
					var myTargetNode = new treeNode(myTargetNodeId);
					treeSparqlNodes[myTargetNodeId] = myTargetNode;
				    }
				}			    
			    });
			});
			
			//set links
			treeGraph.forEach(function(element){
			    var source = reduceIRI(element.source.value);
			    
			    var target = null;
			    var t = ["target1", "target2", "target3"]
			    //inherited
			    for (var i in t){
				if (element[t[i]] != undefined) {
				    target = reduceIRI(element[t[i]].value);
				    if (target != source){
					var Link = {"source": treeSparqlNodes[target], "target": treeSparqlNodes[source], "type": "inherited"};
					if (treeSparqlLinks.indexOf(Link) == -1) {
					    treeSparqlLinks.push(Link);
					}
				    } 
				}
			    }	
			    //equivalent
			    t = "target4";
			    if (element[t] != undefined ) {
                                target = reduceIRI(element[t].value);
                                if (target != source){
                                    var Link = {"source": treeSparqlNodes[target], "target": treeSparqlNodes[source], "type": "equivalent"};
                                    if (treeSparqlLinks.indexOf(Link) == -1) { 
					treeSparqlLinks.push(Link); 
				    }
                                }
                            }
			})

                        //merge nodes that are linked by a Link of type equivalent             
                        if (mergeEquivalentNodes) {
			    treeSparqlLinks.forEach(function(d){
                                if (d.type == "equivalent"){
				    if (d.source.id != d.target.id){
					if (d.target.equivalentTo == undefined){
					    if (d.source.equivalentTo == undefined){
						d.target.equivalentTo = [];
					    } else {
						d.target.equivalentTo = d.source.equivalentTo;
						d.source.equivalentTo = undefined;
					    }
					}
					d.target.equivalentTo = d.target.equivalentTo.concat(d.source.id);
					
					d.target.word = d.target.word.concat(d.source.word);
					if (d.source.pos == undefined){
					    d.source.pos = "";
					}
					d.target.pos = d.target.pos.concat(d.source.pos);
					if (d.source.gloss == undefined){
					    d.source.gloss = "";
					}
					d.target.gloss = d.target.gloss.concat(d.source.gloss);
					if (d.source.link == undefined){
					    d.source.link = "";
					}
					d.target.link = d.target.link.concat(d.source.link);
					//merge node d.source into node d.target, and delete node d.source                 
					treeSparqlLinks.forEach(function(f){
                                            if (f != d){
						if (f.source.id == d.source.id) {
						    f.source = d.target;
						} else if (f.target.id == d.source.id) {
						    f.target = d.target;
						}
                                            }
					})
				    }
				}
                            });
			    
                            for (var i = treeSparqlLinks.length-1; i >= 0; i--){
				if (treeSparqlLinks[i].source.id == treeSparqlLinks[i].target.id){
				    treeSparqlLinks.splice(i, 1);
				} else if (treeSparqlLinks[i].type == "equivalent"){
				    if (treeSparqlLinks[i].source.equivalentTo == undefined){
					delete treeSparqlNodes[treeSparqlLinks[i].source.id];
				    }
				    if (treeSparqlLinks[i].target.equivalentTo == undefined){
					delete treeSparqlNodes[treeSparqlLinks[i].target.id];
                                    }
                                    treeSparqlLinks.splice(i, 1);
                                }
                            }
			}

			if (excludeStarLikeStructures){
			    //find links between words in the same language, but exclude links that have as target the searched word
                            var toDeleteLinks = treeSparqlLinks.filter(function(d) {
				if (d.target.word.find(function(w){ return w == searchedWord; }) == undefined){
				    return d.source.iso == d.target.iso;
				} else {
				    return false;
				}
                            }).filter(function(d) {//don't delete a node if a link starts from it
                                for (var i=0; i<treeSparqlLinks.length; i++) {
                                    if (d.target.id == treeSparqlLinks[i].source.id)
                                        return false;
                                }
                                return true;
                            });

			    //remove links  
                            treeSparqlLinks = treeSparqlLinks.filter(function(d) {
                                for (var i=0; i<toDeleteLinks.length; i++) {
                                    if (toDeleteLinks[i] == d) return false;
                                }
                                return true;
                            });
			    
			    //remove nodes that are not conneted by a link
                            for (var aNode in treeSparqlNodes) {
                                var isLinked = false;
                                for (var i=0; i<treeSparqlLinks.length; i++) {
                                    if (treeSparqlLinks[i].source.id == aNode || treeSparqlLinks[i].target.id == aNode) {
                                        isLinked = true;
                                        break;
                                    }
                                }
                                if (isLinked == false) {
                                    delete treeSparqlNodes[aNode];
                                }
                            }
                        }
			
			if (treeSparqlLinks.length == 0){
                            d3.select("#tree-overlay").remove();
                            d3.select("#tree-container")
                                .append("p")
                                .attr("id", "message")
                                .attr("align", "center")
                                .html("Sorry, no etymology available for this word");
                        }
			
			var force = d3.layout.force()
			    .nodes(d3.values(treeSparqlNodes))
			    .links(treeSparqlLinks)
			    .size([width, height])
			    .linkDistance(150)
			    .charge(-700)
			    .gravity(.2)
			    .on("tick", tick)
			    .start();
			
			var svgGraph = d3.select("#tree-container").append("svg")
			    .attr("id", "tree-overlay")
			    .attr("width", width)
			    .attr("height", height)
			    .call(d3.behavior.zoom().scaleExtent([1, 10]).on("zoom", function () {
				svgGraph.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
				div.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
			    }))
			    .on("click", function(){
				div.style("opacity", 0);
			    });
			
			// Per-type markers, as they don't inherit styles.     
			svgGraph.append("defs").selectAll("marker")
			    .data(["borrowed", "inherited"])
			    .enter().append("marker")
			    .attr("id", function(d) { return d; })
			    .attr("viewBox", "0 -5 10 10")
			    .attr("refX", 26)
			    .attr("refY", -1.5)
			    .attr("markerWidth", 6)
			    .attr("markerHeight", 6)
			    .attr("orient", "auto")
			    .append("path")
			    .attr("d", "M0,-5L10,0L0,5")
			    .attr("fill", "lightBlue");
			
			var path = svgGraph.append("g").selectAll("path")
			    .data(force.links())
			    .enter().append("path")
			    .attr("class", function(d) { return "link " + d.type; })
			    .attr("marker-end", function(d) { return "url(#" + d.type + ")"; });
			
			var circle = svgGraph.append("g").selectAll("circle")
			    .data(force.nodes())
			    .enter().append("circle")
			    .attr("r", 12)
			    .attr("fill", function(d){ 
				if (d.iso == searchedIso && d.word == searchedWord) 
				    return "red"; 
				else 
				    return "orange"; 
			    })
			    .attr("stroke", "lightBlue")
			    .call(force.drag)
			    .on("mouseover", function(d) {
				d3.select(this).style("cursor", "pointer");
			    }) 
			    .on("click", function(d) {
				 d3.select(this)
				    .append("a") 
				    .attr("href", "#myPopup") 
				    .attr("data-rel", "popup")
				    .attr("class", "ui-btn ui-corner-all ui-shadow ui-btn ui-icon-delete ui-btn-icon-notext ui-btn-right")  
				    .attr("data-position-to", "origin"); 
				div.style("opacity", 1);
				div.html(langMap.get(d.iso))
				    .style("left", (d3.event.pageX) + "px")
				    .style("top", (d3.event.pageY - 28) + "px");
				d3.event.stopPropagation();
			    });
			
			var isoText = svgGraph.append("g").selectAll("text")
			    .data(force.nodes())
			    .enter().append("text")
			    .attr("x", 0)
			    .attr("y", ".31em")
			    .attr("fill", "black")
			    .attr("text-anchor", "middle")
			    .text(function(d) { return d.iso; });
			
			var rectangle = svgGraph.append("g").selectAll("rectangle")
			    .data(force.nodes())
			    .enter().append("rect")
			    .attr("x", 14)
			    .attr("y", "-.31em")
			    .attr("width", "2em")
			    .attr("height", "0.7em")
			    .attr("fill", "red")
			    .attr("fill-opacity", 0)
			    .on("click", function(d) {
				d3.select(this)
				    .append("a")
				    .attr("href", "#myPopup") 
				    .attr("data-rel", "popup")
				    .attr("data-transition", "pop");
				div.style("opacity", 1);
				div.html(treeSparqlNodes[d.id].printData())
				    .style("left", (d3.event.pageX + 18) + "px")
				    .style("top", (d3.event.pageY - 28) + "px");
				d3.event.stopPropagation();
			    });
		
			var wordText = svgGraph.append("g").selectAll("text")
			    .data(force.nodes())
			    .enter().append("text")
			    .attr("x", 14)
			    .attr("y", ".31em")
			    .attr("id", "word")
			    .text(function(d) { return d.printWord(","); });
			
			function tick() {
			    path.attr("d", function(d){ 
				return "M" + d.source.x + "," + d.source.y + "A0,0 0 0,1 " + d.target.x + "," + d.target.y; 
			    });
			    circle.attr("transform", transform);
			    wordText.attr("transform", transform);
			    rectangle.attr("transform", transform);
			    isoText.attr("transform", transform);
			}
		    }	
		});
	
	    }
	    
	    //TO DO: could ask server if the word has an etymological relationship and if the answer is no ignore that node
	    function loadNodes(search, langMap, endpoint){
		var query = [
		    "PREFIX dbnary: <http://kaiko.getalp.org/dbnary#>",
		    "PREFIX dbetym: <http://kaiko.getalp.org/dbnaryetymology#>",
		    "PREFIX lemon: <http://lemon-model.net/lemon#>",
		    "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>",
                    "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>",
		    "PREFIX owl: <http://www.w3.org/2002/07/owl#>",
		    "select distinct (group_concat(distinct ?ee ; separator=\",\") as ?et) ?uri ?word ?iso ?pos ?gloss (group_concat(distinct ?links ; separator=\",\") as ?link)",
		    "where {",
		    "?uri rdfs:label ?label . ?label bif:contains \"" + search + "\" .",
                    //exclude entries that contain the searched word but include other words (e.g.: search="door" label="doorbell", exclude "doorbell") 
		    "FILTER regex(?label, \"^" + search + "$\", 'i') .",
		    "BIND (STR(?label)  AS ?word) .",
		    "OPTIONAL {?uri rdfs:seeAlso ?links} .",
		    //case uri is an etymology entry like __ee_door
		    "OPTIONAL {?uri dbnary:refersTo ?ee.",
                    "          ?ee rdf:type dbetym:EtymologyEntry .",
		    "          }",
                    "OPTIONAL {?uri dbnary:refersTo ?ee .",
		    "          ?ee rdf:type lemon:LexicalEntry .}",
		    //case uri is a canonical form
		    "OPTIONAL {?le lemon:canonicalForm ?uri .",
                    "          ?le rdf:type lemon:LexicalEntry .",
		    "          ?le dbnary:partOfSpeech ?pos .",
		    "          OPTIONAL{ ?le lemon:sense ?sense .",
		    "                    ?sense lemon:definition ?val .",
		    "                    ?val lemon:value ?gloss .}",
		    "           OPTIONAL {",
		    "                     ?ee rdf:type dbetym:EtymologyEntry .",
		    "                     ?ee dbnary:refersTo ?le .}",
                    "}",
		    "BIND(strbefore(replace(str(?uri),\"http://kaiko.getalp.org/dbnary/eng/\",\"\",\"i\"),\"/\") AS ?ll)",
		    "BIND(if (?ll = \"\",\"eng\",?ll) AS ?iso )",
		    "}"
		];
		
		var sparql = query.join(" ");
		var url = endpoint + "?query=" + encodeURIComponent(sparql);
		console.log(url);
		var nodes = {};
		
		d3.xhr(url, mime, function(request) {
		    if (request != null) {
			//clean screen and change help
			d3.select("#tree-overlay").remove();
			div.style("opacity", 0);
			d3.select("#message").remove();
			d3.select("#p-helpPopup").remove();
			d3.select("#helpPopup")
			    .append("p")
			    .attr("id", "p-helpPopup")
			    .attr("style", "font-size:12px;border-radius:8px;max-width:255px")
			    .html("Pick the word you are interested in. <ul><li>Click on a circle to display the language</li> <li>Click on a word to display the data</li> <li>Double click on a circle to choose a word</li></ul>");
			
			//perform query
			var json = JSON.parse(request.responseText);

			var theGraph = json.results.bindings;
			if (debug) { console.log(theGraph) };
			var sparqlLinks = {};
			var sparqlNodes = {};                             
			
			//ignore element with uri starting with __ee_ if there is a corresponding element with uri starting with __cf_ 
			function doIgnore(n){
			    var ignore = true;
                            var tmp = n.uri.value.split("/");
                            if (tmp[tmp.length - 1].startsWith("__ee_")){
                                if (n.et.value == "" || n.et.value.split(",").length > 1){
                                    ignore = false;
                                }
                            } else {
                                ignore = false;
                            }
                            return ignore;
                        }
			
			//node constructor
			function Node(element){	
			    //merge iri-s with the same etymological origin
			    this.mergeInto = function(nodes, pos, gloss){
				var merge = false;
				for (var i in nodes){
                                    if (nodes[i].et != undefined){
                                        if (nodes[i].iso == this.iso){
                                            if (nodes[i].word == this.word){
                                                if (nodes[i].et == this.et) {
						    if (this.refersTo != undefined){
							nodes[i].pos = [];
							nodes[i].refersTo = this.refersTo;
						    } 
                                                    nodes[i].pos.push(pos);
                                                    nodes[i].gloss.push(gloss);
                                                    merge = true;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
				return merge;
			    }

			    this.initialize = function(word, iso, et){
				this.word = word.value;
				this.iso = iso.value;
				this.et = (et != undefined) ? et.value : "";
			    }

			    this.finalize = function(uri, et, pos, gloss){
				this.id = (et.value.split("/").pop().startsWith("__ee_")) ? this.et : uri.value;
				this.pos = [];
				this.pos.push(pos);
				this.gloss = [];
				this.gloss.push(gloss);
			    }
			}

			theGraph.forEach(function(jsonNode){
			    if (!doIgnore(jsonNode)){
				var aNode = new Node(jsonNode);
				var splitted = jsonNode.et.value.split(",");
                                if (splitted.length > 1){
				    aNode.refersTo = splitted;
                                    jsonNode.et.value = jsonNode.uri.value;    
                                }
				aNode.initialize(jsonNode.word, jsonNode.iso, jsonNode.et); 
				var pos = (jsonNode.pos != undefined) ? jsonNode.pos.value : "";
				if (aNode.refersTo != undefined) {
                                    pos = "";
				}
				var gloss = (jsonNode.gloss != undefined) ? jsonNode.gloss.value : "";
				if (!aNode.mergeInto(sparqlNodes, pos, gloss)){
				    aNode.finalize(jsonNode.uri, jsonNode.et, pos, gloss);
				    //push to sparqlNodes
				    sparqlNodes[aNode.id] = aNode;
				}
			    }
			})
			    
			var force = d3.layout.force()   
			    .nodes(d3.values(sparqlNodes))       
			    .links(sparqlLinks)       
			    .size([width, height]) 
			    .linkDistance(150)                     
			    .charge(-700)           
			    .gravity(.2)                   
			    .on("tick", tick)               
			    .start(); 
			
			var svgGraph = d3.select("#tree-container").append("svg")
			    .attr("id", "tree-overlay")
			    .attr("width", width)  
			    .attr("height", height)
			    .call(d3.behavior.zoom().scaleExtent([1, 10]).on("zoom", function () {
				svgGraph.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
				div.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
                            }))
                            .on("click", function(){
                                div.style("opacity", 0);
                            });
			
			var circle = svgGraph.append("g").selectAll("circle") 
			    .data(force.nodes())             
			    .enter().append("circle")                     
			    .attr("r", 12)  
			    .attr("fill", "orange")
			    .attr("stroke", "lightBlue")               
			    .call(force.drag)
			    .on("mouseover", function(d) {
				d3.select(this).style("cursor", "pointer");
			    })
			    .on("click", function(d) {
				d3.selectAll("circle").attr("fill", "orange");
				d3.select(this)
				    .append("a")
				    .attr("href", "#myPopup")
				    .attr("data-rel", "popup")
				    .attr("data-transition", "pop");
				div.style("opacity", 1);
				div.html(langMap.get(d.iso)) 
				    .style("left", (d3.event.pageX) + "px")    
				    .style("top", (d3.event.pageY - 28) + "px");
				d3.event.stopPropagation();
			    })    
			    .on("dblclick", loadTree);
			
			var isoText = svgGraph.append("g").selectAll("text")  
			    .data(force.nodes())                             
			    .enter().append("text")      
			    .attr("x", 0)  
			    .attr("y", ".31em")   
			    .attr("fill", "black") 
			    .attr("text-anchor", "middle")  
			    .text(function(d) { return d.iso; })
			
			var rectangle = svgGraph.append("g").selectAll("rectangle")     
			    .data(force.nodes())  
			    .enter().append("rect")                         
			    .attr("x", 14)  
			    .attr("y", "-.31em") 
			    .attr("width", "2em")
			    .attr("height", "0.7em")
			    .attr("fill", "red")
			    .attr("fill-opacity", 0)
			    .on("mouseover", function(d) {
				d3.select(this).style("cursor", "pointer");
			    })
			    .on("click", function(d) {
				d3.select(this)
				    .append("a") 
				    .attr("href", "#myPopup")
				    .attr("data-rel", "popup") 
				    .attr("data-transition", "pop");  
				div.style("opacity", 1);
				d3.selectAll("circle").attr("fill", "orange");
				if (d.refersTo != undefined){
				    d.refersTo.forEach(function(iri){ 
					d3.selectAll("circle")
					    .filter(function(f) { return (f.et == iri); })
					    .attr("fill", "red")
				    });
				    div.html("<b>" + 
					     sparqlNodes[d.id].word + 
					     "</b><br><br><i>" +
					     "If you choose this word you will visualize the etymological tree of either of the words higlighted in red," +
					     "probably of the most popular word among them." +
					     "<br><br>" +
					     "This is because this data has been extracted from Wiktionary Etymology Sections and (for the most part)" +
					     "Wiktionary Etymology Sections link to etymologically related words without specifying their meaning." +
					     "</i>");
				} else {
				    div.html("<b>" + sparqlNodes[d.id].word + "</b>" + showPosAndGlosses(sparqlNodes[d.id]))
					.style("left", (d3.event.pageX + 18) + "px")
					.style("top", (d3.event.pageY - 28) + "px");
				}
				d3.event.stopPropagation();
			    });
			
			function showPosAndGlosses(e){
			    var toreturn = "";
                            for (var i = 0; i < e.pos.length; i ++)  toreturn += "<br><br>" + e.pos[i] + " - " + e.gloss[i];
			    return toreturn;
			}

			var wordText = svgGraph.append("g").selectAll("text")
			    .data(force.nodes())
			    .enter().append("text")
			    .attr("x", 14)
			    .attr("y", ".31em")
			    .attr("id", "word")
			    .text(function(d) { return d.word; });
			
			function tick() {
			    circle.attr("transform", transform);   
			    wordText.attr("transform", transform);
			    rectangle.attr("transform", transform); 
			    isoText.attr("transform", transform);
			}                
            	    }	
		})
	    }
	};
    });
});


