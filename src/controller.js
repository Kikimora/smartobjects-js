var _ = require("lodash");
var React = require("react");

/**
 * Generic mixin for react components to deal with view models.
 *
 * View model is an object derived from DataContext. Such objects has number of properties and commands
 * and fire events when these changed. Controller mixin listen to view model events and update
 * component state with view model data.
 *
 * First initialize controller by calling
 * <code>
 *     this.initController(props);
 * </code>
 * in constructor.
 *
 * When controller update component state it convert viewModel data into state object. Such state
 * object carry information about property values as well as associated errors. Ex:
 * Suppose view model has two properties: X and command Y; State object will be
 * <code>
 * {
 *   X: 'x property value',
 *   XErrors: [<errors associated with X property, usually validation errors>],
 *   Y: <command object>,
 *   YErrors: [<errors associated with Y command, usually server errors>]
 * }
 * </code>
 * Host components (which has controller mixed in) can use viewModel data by inspecting their state object. Ex:
 * <code>
 * render() {
 *  return (
 *      <span>X value:{this.state.X} X errors length: {this.state.XErrors.length}</span>
 *  );
 * }
 * </code>
 */
var Controller = {

    initController(props) {
    },

    _propertyState(state, key) {
        var update = {};

        if (state.hasOwnProperty("value")) {
            update[state.name] = state.value;
            update[state.name + "Errors"] = state.errors;
        } else {
            update[key] = state;
        }
        return update;
    },

    update(state, key) {
        if (arguments.length == 0) {
            state = {};
            _.each(this.viewModel.state(), (property, key) => {
                _.extend(state, this._propertyState(property, key));
            });
        } else {
            state = this._propertyState(state, key);
        }

        if (this.canSetState) {
            this.setState(state);
        } else {
            this.state = state;
        }
        return state;
    },

    attachViewModel(props) {
        if (this.modelListener == null) {            
            this.viewModel.clearErrors();
            this.modelListener = this.viewModel.attach((state)=> {
                this.update(state);
            });
            this.update();
        } else {
            console.warn("Attaching already attached controller");
        }
    },

    detachViewModel() {
        if (this.modelListener) {
            this.viewModel.detach(this.modelListener);
            this.modelListener = null;
        }
    },

    componentWillMount() {
        this.canSetState = true;
        this.attachViewModel(this.props);
    },

    componentDidMount() {
    },

    componentWillReceiveProps(props) {
        this.detachViewModel();
        this.attachViewModel(props);
    },

    componentWillUnmount() {
        this.detachViewModel();
        this.canSetState = false;
    },

    onChange(e) {
        e.stopPropagation();
        var target = e.target;
        //hmm... can I make this logic more extensible? 
        if (e.target.name) {
            if (target.type == "checkbox") {
                this.onValueChange(e.target.name, e.target.checked);
            } else {
                this.onValueChange(e.target.name, e.target.value);
            }
        }
    },

    onValueChange(name, value) {
        this.viewModel[name] = value;
    }
};

function controller(component) {
    _.defaults(component, Controller);
}
//extend 'controller' function with Controller methods
//so clients can invoke super methods with 
//var {controller} = require('smartobjects');
//controller.componentWillUnmount.call(this)
controller(controller);

module.exports = controller;