"use strict";

var _ = require('lodash');
var EventEmitter = require('micro-events');
var Check = require("./check.js");
var Errors = require("./errors.js");
var Command = require("./command.js");

export default class DataContext extends EventEmitter {

    /**
     * Create empty data context object.
     */
    constructor(...args) {
        super();
        this._errors = new Errors();
        this._validating = false;
        _.each(this.properties(), (property, name) => {
            if (property.init != null) {
                property.init(this, name, ...args);
            }
        });
        if (this.__init != null) {
            this.__init(...args);
        }
    }

    /**
     * Fire property change event. Also trigger dependent properties change events.
     * @param name
     * @param newValue
     * @param oldValue
     * @returns {*}
     */
    firePropertyChange(name, newValue, oldValue) {
        if (!this._validating) {
            this.emit(name, newValue, name, oldValue);
            let property = this.property(name);
            if (property != null && property.dependent != null) {
                _.each(property.dependent, (p)=> {
                    if (this.property(p) != null) {
                        firePropertyChange(this, p, this[p]);
                    }
                });
            }
        }

    }

    /**
     * Clear all data context writable properties and set properties specified by newData
     * @param newData
     */
    reset(newData) {
        if (!newData) newData = {};
        _.each(this.properties(), (property, name)=> {
            if (property.writable) {
                this[name] = newData[name] || property.default;
            }
        });
    }

    /**
     * Fill writable properties from new data. If value is not found in newData then it is left as is.
     * @param newData
     */
    putAll(newData) {
        if (!newData) return;
        _.each(this.properties(), (property, name)=> {
            if (property.writable && newData.hasOwnProperty(name)) {
                this[name] = newData[name];
            }
        });
    }

    /**
     * Return array of errors for given key. If key is not given return all errors.
     * @param key
     * @returns {*}
     */
    errors(key) {
        return _.map(this._errors.errors(key), (error)=> {
            return error.toString();
        });
    }

    /**
     * True if data context has errors for a given key
     * @param key
     * @returns {*}
     */
    hasErrors(key) {
        return !this.isValid(key);
    }

    /**
     * True if data context and it components does not have any errors
     * @param key
     * @returns {*}
     */
    isValid(key) {
        let valid = this._errors.isValid(key);
        if (valid && key == null) {
            valid = _.every(this.properties(), (property, name) => {
                if (property.component != null && _.isFunction(this[name].isValid)) {
                    return this[name].isValid();
                } else {
                    return true;
                }
            });
        }
        return valid;
    }

    /**
     * Return 'checker' object which add errors to this data context.
     * @param key
     * @param value
     * @returns {*}
     */
    check(key, value) {
        return this._errors.check(key, value);
    }

    /**
     * Clear errors in this data context. If key is not given then clear all errors.
     * @param key
     */
    clearErrors(key) {
        this._errors.clear(key);
        if (key == null) {
            _.every(this.properties(), (property, name) => {
                if (property.component != null && _.isFunction(this[name].clearErrors)) {
                    return this[name].clearErrors();
                } else {
                    return true;
                }
            });
        }
    }

    /**
     * Return array data context property descriptors.
     */
    properties() {
        return this.constructor.properties();
    }

    /**
     * Return data context property descriptor
     * @param name
     */
    property(name) {
        return this.constructor.property(name);
    }

    /**
     * Run all setters in data context which in turn trigger their validation
     * @returns {*}
     */
    validate() {
        let changedProps = [];
        try {
            this._validating = true;
            _.each(this.properties(), (property, name)=> {
                var descriptor = this.property(name);
                if (descriptor != null) {
                    if (descriptor.component != null && _.isFunction(this[name].validate) && _.isFunction(this[name].isValid)) {
                        let validComponent = this[name].isValid();
                        let validProp = this.isValid(name);
                        if (validComponent != this[name].validate() || validProp != this.isValid(name)) {
                            changedProps.push(name);
                        }
                    } else if (descriptor.writable) {
                        //trigger validation by invoking setter
                        let valid = this.isValid(name);
                        this[name] = this[name];
                        if (valid != this.isValid(name)) {
                            changedProps.push(name);
                        }
                    }
                }
            });
        } finally {
            this._validating = false;
            _.each(changedProps, (name)=> {
                var val = this[name];
                this.firePropertyChange(name, val, val);
            });
        }
        return this.isValid();
    }

    get validating() {
        return this._validating;
    }

    /**
     * Attach event listener to all property change events in this data context.
     * When property changed 'update' callback receive object generated by propertyState.
     * @param update {Function} function (newValue, propertyName, oldValue)
     * @returns {Function} listener object
     */
    attach(update) {
        _.each(this.properties(), (property, name) => {
            this.on(name, update);
        });
        return update;
    }

    /**
     * Detach event listener previousl attached by 'attach'
     * @param listener
     */
    detach(listener) {
        _.each(this.properties(), (property, name)=> {
            this.off(name, listener);
        });
    }

    /**
     * @return all commands which are running at the moment
     */
    runningCommands() {
        return _(this.properties())
            .map((property, name) => {
                if (property.command && this[name].isRunning) {
                    return this[name];
                }
            })
            .compact().values();
    }
}

/*
 Helper method to generate command and property definitions.

 Command is generated if params has 'execute' property, otherwise property is generated.

 See methods 'DataContext.property' and 'DataContext.command' above for details.
 */
DataContext.properties = function (params) {
    if (arguments.length == 0) {
        var result = {};
        var prototype = this.prototype;
        while (prototype != null) {
            if (prototype.constructor && prototype.constructor.dataContext$properties) {
                var properties = prototype.constructor.dataContext$properties;
                _.defaults(result, properties);
            }
            prototype = Object.getPrototypeOf(prototype);
        }
        return result;
    } else {
        for (var property in params) {
            if (params.hasOwnProperty(property)) {
                var definition = params[property];
                this.property(property, definition);
            }
        }
    }
};

/**
 * Generate property named 'name' which can be used to get/set object property
 * When property is set, an event with same name is fired.
 * Properties could be:
 * 1. RW property MyObject.property('p', { get: function () {}, set: function () {} })
 * 2. RO property MyObject.property('p', { get: function () {} })
 * 3. Default RW property MyObject.property('p', {}); Trivial getter and setter are generated.
 * 4. Command properties MyObject.property('command', {execute() { return 'Hello';}});
 * 5. Components (child datacontexts) MyObject.property('command', {component:MyComonentType, arg1:1, arg2:2});
 */
DataContext.property = function (property, definition) {
    var properties;
    if (!definition) {
        var prototype = this.prototype;
        while (prototype != null) {
            if (prototype.constructor && prototype.constructor.dataContext$properties) {
                properties = prototype.constructor.dataContext$properties;
                if (property in properties) return properties[property];
            }
            prototype = Object.getPrototypeOf(prototype);
        }
    } else {
        var existingProperty = this.property(property);
        if (existingProperty != null) {
            definition = _.extend({}, existingProperty, definition);
        }
        if (definition.execute != null || definition.canExecute != null) {
            this.command(property, definition);
        } else if (definition.component != null) {
            this.component(property, definition);
        } else {
            this._defProperty(property, definition);
        }
    }
}

/**
 * Generate readonly command property. Such property hold instance of command.
 * When command is executed an event named as property is fired.
 * Ex: MyObject.command('loadSome', {
 * execute: function () { ... },
 * canExecute: function () { ... }
 * });

 * Property definition passed to DataContext.command passed thru to Command object as is.
 * See Command documentation for details.

 * You can override commands in sub classes. Ex:
 * class Subclass extends MyObject {}
 * Subclass.command('loadSome', { debounce: { timeout: 1000 } });
 */
DataContext.command = function (name, config) {
    var ivar = "_" + name;
    var property = this.property(name);
    if (property) {
        if (!property.command)
            throw new Error("Cannot override regular property with command");
        config = _.extend({}, property.command, config);
    }

    this._defProperty(name, {
        command: config,
        dependent: config.dependent,
        writable: false,
        describe: function (viewModel, key) {
            return {
                [key]: {
                    isRunning: viewModel[key].isRunning,
                    canExecute: !!viewModel[key].canExecute(),
                    error: viewModel[key].error
                }
            };
        },
        get: function () {
            var cmd = this[ivar];
            if (!cmd) {
                cmd = this[ivar] = new Command(config, this);
                cmd.name = name;
                cmd.on('execute', ()=> {
                    this.firePropertyChange(name, cmd, cmd);
                });
            }
            return this[ivar];
        }
    });
};

DataContext.component = function (name, def) {
    def.describe = function (viewModel, propName) {
        let component = viewModel[propName];
        return {
            [propName]: _.reduce(component.properties(), (acc, property, name)=> {
                return _.extend(acc, property.describe(component, name))
            }, {}),
            [propName + "Errors"]: viewModel.errors(propName)
        }
    };
    def.init = _.wrap(def.init || _.noop, function (init, model, name, ...args) {
        model[name] = new this.component(model, this, name, ...args);
        init(model, this, name, ...args);
    });
    _.defaults(def, def.component.propertyDefaults);
    this._defProperty(name, def);
}

DataContext._defProperty = function (name, definition) {

    if (arguments.length == 1) {
        var prototype = this.prototype;
        while (prototype != null) {
            if (prototype.constructor && prototype.constructor.dataContext$properties) {
                let properties = prototype.constructor.dataContext$properties;
                if (properties[name]) return properties[name];
            }
            prototype = Object.getPrototypeOf(prototype);
        }
    } else {
        if (!this.hasOwnProperty('dataContext$properties')) {
            Object.defineProperty(this, "dataContext$properties", {
                configurable: false,
                enumerable: false,
                value: {}
            });
        }

        let properties = this.dataContext$properties;
        if (!_.isObject(definition)) throw new Error("Property definition should be an object.");

        let property = _.extend({}, definition);
        _.defaults(property, {
            resettable: true,
            name: name,
            describe: function (viewModel, key) {
                return {
                    [key]: viewModel[key],
                    [key + "Errors"]: viewModel.errors(key)
                };
            }
        });

        let defaultValue = property.default;
        if (_.isFunction(property.default)) {
            Object.defineProperty(property, "default", {get: defaultValue})
        } else {
            Object.defineProperty(property, "default", {value: defaultValue})
        }

        properties[name] = property;

        if (property.get && property.set) {
            property.writable = true;
            Object.defineProperty(this.prototype, name, makeRWProperty(name, property));
        } else if (property.get) {
            property.writable = false;
            Object.defineProperty(this.prototype, name, makeReadonlyProperty(name, property));
        } else {
            property.writable = true;
            Object.defineProperty(this.prototype, name, makeDefaultRWProperty(name, property));
        }
    }
};

var firePropertyChange = function (model, name, newValue, oldValue) {
    if (oldValue !== newValue) {
        return model.firePropertyChange(name, newValue, oldValue);
    }
};

var makeReadonlyProperty = function (name, property) {
    return {
        get() {
            var value = property.get.call(this);
            return _.isUndefined(value) ? property.default : value;
        },
        enumerable: true,
        configurable: true
    }
};

var makeRWProperty = function (name, property) {
    return {
        get () {
            var value = property.get.call(this);
            return _.isUndefined(value) ? property.default : value;
        },
        set(newValue){
            var oldValue = property.get.call(this);
            property.set.call(this, newValue);
            firePropertyChange(this, name, newValue, oldValue);
        },
        enumerable: true,
        configurable: true
    };
};

var makeDefaultRWProperty = function (name, property) {
    var ivar = "_" + name;
    return {
        get() {
            var value = this[ivar];
            return _.isUndefined(value) ? property.default : value;
        },
        set(newValue) {
            var oldValue = this[ivar];
            this[ivar] = newValue;
            firePropertyChange(this, name, newValue, oldValue);            
        },
        enumerable: true,
        configurable: true
    }
};
