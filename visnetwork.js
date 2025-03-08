//##############################################################################
//
// VisNetwork class - wrapper for a VisJs network
//
//#############################################################################

class VisNetwork {
    debug = true;
    nodes = undefined;
    edges = undefined;
    visnetwork = undefined;
    network_options = undefined;
    selected_node = undefined;
    is_changed = false;

    constructor(container, nodes, edges, options, debug=true) {
        // create the network
        this.debug = debug;
        this.nodes = new vis.DataSet(nodes);
        this.edges = new vis.DataSet(edges);
        let network_definition = { nodes: this.nodes, edges: this.edges };
        this.visnetwork = new vis.Network(container, network_definition, options);
        this.network_options = options;
        this.is_changed = false;

        this.visnetwork.disableEditMode();

        // define event handlers
        this.visnetwork.on("selectNode", (params) => {
            this.on_node_selected(params);
        });
        this.visnetwork.on("deselectNode", (params) => {
            if (this.debug) console.log("Node deselected");
        });
        this.visnetwork.on("selectEdge", (params) => {
            this.on_edge_selected(params);
        });
        this.visnetwork.on("deselectEdge", (params) => {
            if (this.debug) console.log("Edge deselected");
        });
        this.visnetwork.on("click", (params) => {
            this.on_click(params);
        });
    }

    //-------------------------------------------------------------------------
    // return a JSON string with nodes, edges, and options
    //-------------------------------------------------------------------------
    to_json(indented = true) {
        this.visnetwork.storePositions();
        let nodes = this.nodes.get();
        let edges = this.edges.get();
        edges.forEach((x) => {
            x.label = x.label.trim();
        });
        let result = { nodes: nodes, edges: edges };
        result.vis_options = this.network_options;
        let jsondata = undefined;
        if (indented) jsondata = JSON.stringify(result, null, 4);
        else jsondata = JSON.stringify(result);
        return jsondata;
    }

    //-------------------------------------------------------------------------
    // initialize the network from a json object containing node, edge, and
    // option definitions, e.g. what our to_json() method does.
    //-------------------------------------------------------------------------
    from_json(network_json) {
        this.edges.clear();
        this.nodes.clear();
        let options = network_json.vis_options;
        if (options) {
            this.network_options = options;
            this.network.setOptions(options);
        }
        network_json.nodes.forEach((node) => {
            this.nodes.add(node);
        });
        network_json.edges.forEach((edge) => {
            this.edges.add(edge);
        });
        this.visnetwork.fit();
        this.is_changed = false;
    }

    //-------------------------------------------------------------------------
    // return the largest node id value
    //-------------------------------------------------------------------------
    max_id() {
        let node_ids = this.nodes.getIds();
        return node_ids.reduce((x, y) => (x > y ? x : y));
    }

    //-------------------------------------------------------------------------
    // find the node with a given id
    //-------------------------------------------------------------------------
    find_node(id) {
        return this.nodes.get(id);
    }

    //-------------------------------------------------------------------------
    // find the node with the given ids
    //-------------------------------------------------------------------------
    find_nodes(idlist) {
        let nodes = this.nodes;
        return idlist.map((id) => nodes.get(id));
    }

    //-------------------------------------------------------------------------
    // add a node at a specified position
    //-------------------------------------------------------------------------
    add_node(x, y, label = undefined) {
        let id = this.max_id() + 1;
        if (!label) label = `Node ${id}`;
        let node = {
            id: id,
            label: label,
            x: x,
            y: y,
        };
        this.nodes.add(node);
        this.is_changed = true;
        return this.nodes.get(node.id);
    }

    //-------------------------------------------------------------------------
    // update a node
    //-------------------------------------------------------------------------
    on_update_node(node) {
        this.nodes.update(node);
        this.is_changed = true;
    }

    //-------------------------------------------------------------------------
    // update an edge
    //-------------------------------------------------------------------------
    on_update_edge(edge) {
        edge.label = edge.label.trim();
        if (edge.label == "") {
            edge.label = " ";
        }
        this.edges.update(edge);
        this.is_changed = true;
    }

    //-------------------------------------------------------------------------
    // delete the curently selected node and all connected edges
    //-------------------------------------------------------------------------
    delete_selected_node() {
        let edgecount = this.edges.length;
        this.visnetwork.deleteSelected();
        // the vis network will delete all edges connected to the one we just deleted
        this.selected_node = undefined;
        this.is_changed = true;
    }

    //-------------------------------------------------------------------------
    // add an edge
    //-------------------------------------------------------------------------
    add_edge(from_id, to_id) {
        let label = `${from_id}_to_${to_id}`;
        let edge = {
            from: from_id,
            to: to_id,
            label: label,
        };
        if (this.debug) console.log("Adding new edge", edge);
        this.edges.add(edge);
        this.is_changed = true;
    }

    //-------------------------------------------------------------------------
    // turn physics on or off
    //-------------------------------------------------------------------------
    enable_physics(status) {
        this.visnetwork.setOptions({ physics: { enabled: status } });
    }

    //-------------------------------------------------------------------------
    // gather up useful event data
    //-------------------------------------------------------------------------
    event_data(params) {
        let original_event = params.event.srcEvent;
        let result = {
            x: params.pointer.canvas.x,
            y: params.pointer.canvas.y,
            button: original_event.button,
            alt: original_event.altKey,
            ctrl: original_event.ctrlKey,
            shift: original_event.shiftKey,
        };
        return result;
    }

    //##############################################################################
    //
    // Event Handlers
    //
    // When the user clicks on an empty space, we may get edgeDeselected and
    // nodeDeselected events, and then a click event.
    //
    // When the user clicks on a node, we will get a selectNode event, possibly
    // followed by a selectEdge event, followed by a click event.
    //
    //#############################################################################

    on_node_selected(params) {
        if (this.debug) console.log("on_node_selected", params);
    }

    on_edge_selected(params) {
        if (this.debug) console.log("In on_edge_selected", params);
    }

    //-------------------------------------------------------------------------
    // handle a click event
    //     on ctl-click: 
    //        if a node was clicked, an edge from the current select node is added
    //        otherwise a new node is created at the click location
    //     on shift-click the clicked node will be deleted
    //-------------------------------------------------------------------------
    on_click(params) {
        if (this.debug) console.log("In on_click", params);
        let eventdata = this.event_data(params);
        if (this.debug) console.log("    eventdata:", eventdata);
        if (params.nodes.length == 0 && params.edges.length == 0) {
            // click was not on a node or edge
            this.selected_node = undefined;
            if (this.debug) console.log("    Background clicked");
            if (eventdata.ctrl) {
                if (this.debug) console.log("    This is a ctrl-click - add a new node");
                // add a new node
                let new_node = this.add_node(eventdata.x, eventdata.y);
                if (this.debug) console.log("    new node: ", new_node);
            }
        } else {
            // a node was clicked
            if (this.debug) console.log("    node clicked");
            // params.nodes contains a list nodes that were clicked (just one I think)
            let clicked_node = this.nodes.get(params.nodes[0]);
            if (eventdata.shift) {
                this.delete_selected_node();
                this.selected_node = undefined;
                return;
            }
            if (eventdata.ctrl) {
                if (this.selected_node) {
                    // add an edge from the clicked node to the currently selected node
                    if (this.debug) console.log(`    add edge from ${this.selected_node.label} to ${clicked_node.label}`);
                    this.add_edge(this.selected_node.id, clicked_node.id);
                }
            }
            this.selected_node = clicked_node;
            if (this.debug) console.log("    selected node: ", this.selected_node.label);
        }
    }
}
