import React from "react"
import _ from "lodash"

/**
 * Generate Controller component
 *
 * Controller is higher-order React component to deal with view models.
 *
 * View model is an object derived from DataContext. Such objects has number of properties and commands
 * and fire events when these changed. Controller component listen to view model events and update
 * component state with view model data.
 *
 * Since calling 'viewModel' properties directly might cause data changes
 * (ex: property getter change some other property directly or indirectly) Controller
 * also maintain 'viewModelState' which contains last known 'viewModel' state.
 *
 * viewModelState object carry information about property values as well as associated errors.
 * For a view model with two properties: X and command Y state object will be
 * <code>
 * {
 *   X: 'x property value',
 *   XErrors: [<errors associated with X property, usually validation errors>],
 *   Y: {
 *     isRunning: true,
 *     canExecute: false
 *   }
 * }
 * </code>
 * You can safely read these values in your render method and use this.context.viewModel
 * to update model data;
 *
 * Controller component pass viewModelState as 'data' prop to wrapper component. Ex:
 * <code>
 * class Wrapped extends React.Component {
 *   render() {
 *     return (
 *       <span>X value:{this.props.data.X} X errors length: {this.props.data.XErrors.length}</span>
 *     );
 *   }
 * }
 * class Model extends DataContext {
 * }
 * DataContext.properties({
 *   X: {default:''}
 * });
 * export default controller(Wrapped, {clazz: Model});
 * </code>
 *
 * @param Component
 * @param clazz - constructor function
 * @param factory - factory function to create view model (function (props) {})
 * @returns {Controller}
 *
 */
export default function controller(Component, params) {
    class Controller extends React.Component {

        constructor(props, context) {
            super(props);
            this.viewModel = this._createViewModel(props, context);
            this.update();
            this._attachViewModel(props);
            this.canSetState = false;
        }

        _createViewModel(props, context) {
            let { clazz:ctor, factory } = params;
            return ctor != null ? new ctor(props, context) : factory.call(this, props, context);
        }

        componentWillReceiveProps(props) {
            if (this.props.viewModel !== props.viewModel) {
                this._detachViewModel();
                this.viewModel = this._createViewModel(props, this.context);
                this._attachViewModel(props);
            }
        }

        componentWillUnmount() {
            this._detachViewModel();
            this.canSetState = false;
        }

        componentDidMount() {
            this.canSetState = true;
        }

        _propertyState(key, property) {
            let update = {};
            if (property != null) {
                _.extend(update,  property.describe(this.viewModel, key));
            }
            return update;
        }

        update(property) {
            let stateUpdate = {};
            if (arguments.length == 0) {
                _.each(this.viewModel.properties(), (property, key) => {
                    _.extend(stateUpdate, this._propertyState(key, property));
                });
            } else {
                stateUpdate = this._propertyState(property.name, property);
            }
            if (this.canSetState) {
                this.setState(stateUpdate);
            } else {
                if (this.state == null) {
                    this.state = {};
                }
                _.extend(this.state, stateUpdate);
            }
        }

        _attachViewModel(props) {
            if (this.modelListener == null) {
                this.viewModel.clearErrors();
                this.modelListener = this.viewModel.attach((newValue, propertyName)=> {
                    this.update(this.viewModel.property(propertyName));
                });
                this.update();
            } else {
                console.warn("Attaching already attached controller");
            }
        }

        _detachViewModel() {
            if (this.modelListener) {
                this.viewModel.detach(this.modelListener);
                this.modelListener = null;
            }
        }

        render() {
            return (
                <Component {...this.props} data={this.state}>
                    {this.props.children}
                </Component>
            );
        }

        getChildContext() {
            return {
                viewModel: this.viewModel,
            };
        }
    }

    Controller.childContextTypes = {
        viewModel: React.PropTypes.object,
    }

    Controller.contextTypes = {
        viewModel: React.PropTypes.object
    }

    if (Component.contextTypes == null) {
        Component.contextTypes = {};
    }
    _.extend(Component.contextTypes, {
        viewModel: React.PropTypes.object
    });
    return Controller;
}

