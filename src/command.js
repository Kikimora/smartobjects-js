/** @preventMunge */
//see next link to learn about preventMungle above
//http://stackoverflow.com/questions/30110437/leading-underscore-transpiled-wrong-with-es6-classes

var _ = require("lodash");
var $ = require("jquery");
var EventEmitter = require('micro-events');

class Command extends EventEmitter {

    constructor(config, context) {
        super();
        if (!config) {
            throw new Error("Command config required");
        }
        this.action = config.execute;
        this._context = context || null;
        this._isRunning = false;
        let plugins = _.omit(config, ["canExecute", "execute"]);
        _.forOwn(plugins, (value, key) => {
            if (Command.ext[key]) {
                Command.ext[key](this, value, config);
            }
        });
        if (config.canExecute != null) {
            this.condition = config.canExecute;
        } else {
            this.condition = function () {
                return !this._isRunning;
            }
        }
    }

    get action() {
        return this._execute;
    }

    set action(value) {
        if (!_.isFunction(value)) {
            throw new Error("Command action must be a function");
        }
        this._execute = value;
    }

    get condition() {
        return this._canExecute;
    }

    set condition(value) {
        if (!_.isFunction(value) && !_.isNull(value) && !_.isUndefined(value)) {
            throw new Error("Command condition must be null, undefined or function");
        }
        this._canExecute = value;
    }

    execute() {
        if (this.canExecute.apply(this, arguments)) {
            this._isRunning = true;
            this.notifyCanExecute();
            this.emit('execute', 'started');

            try {
                var result = this.action.apply(this.context, arguments);
                if (result && _.isFunction(result.always)) {
                    this._promise = result;
                } else {
                    this._promise = $.Deferred().resolve(result).promise();
                }
            } catch (e) {
                this._promise = $.Deferred().reject(e, "error", e.message).promise();
                console.warn('Command action failed with exception', e);
            }
            if (this._promise.state() === "pending") {
                this._promise.always(() => {
                    this._finishExecute();
                });
            } else {
                //don't run finish events synchronously
                setTimeout(() => {
                    this._finishExecute();
                });
            }

            return this._promise;
        } else {
            throw new Error("Cannot execute this command now");
        }
    }

    _finishExecute() {
        this._promise = null;
        this._isRunning = false;
        this.notifyCanExecute();
        this.emit('execute', 'finished');
    }

    tryExecute() {        
        var canExecute = this.canExecute.apply(this, arguments);
        if (canExecute) {
            return this.execute.apply(this, arguments);
        } else {
            var result = $.Deferred();
            //don't run finish events synchronously
            setTimeout(()=>{
                result.reject();
            });
            return result.promise();
        }
    }

    notifyCanExecute() {
        this.emit('canExecute');
    }

    canExecute() {        
        return this._canExecute.apply(this._context, arguments);
    }

    abort() {
        if (this._promise && this.promise.abort) {
            this._promise.abort();
        }
        return this._promise;
    }

    get isRunning() {
        return this._isRunning;
    }

    get promise() {
        return this._promise;
    }

    get context() {
        return this._context;
    }

    set context(value) {
        this._context = value;
    }
}

Command.ext = {
    debounce: function (command, config) {
        var originalAction = command.action;
        command.action = (...args)=> {
            if (!command._debouncedResult) {
                command._debouncedResult = $.Deferred();
            }            
            clearTimeout(command._timeout);
            command._timeout = setTimeout(function () {                
                var result;
                try {
                    result = originalAction.apply(command.context, args);
                    if (result && _.isFunction(result.always)) {
                        result.done(()=> {
                            command._debouncedResult.resolve(arguments);
                        }).fail(()=> {
                            command._debouncedResult.reject(arguments);
                        }).always(()=> {
                            command._debouncedResult = null;
                        });
                    } else {
                        command._debouncedResult.resolve(result);
                        command._debouncedResult = null;
                    }
                } catch (e) {
                    command._debouncedResult.reject(command.context, e);
                    command._debouncedResult = null;
                    console.warn('Debounced command action failed with exception', e);
                }
            }, config.timeout);
            return command._debouncedResult.promise();
        };
        //override default canExecute
        if (command.condition == null) {
            command.condition = function () { return true; }
        }
    },

    once: function (command, config, commandConfig) {
        var executed = false;
        var condition = commandConfig.canExecute || function () { return true; };
        command.condition = function () {
            return !executed && (!condition || condition.apply(command.context, arguments));
        };
        var action = command.action;
        command.action = function () {
            var result = action.apply(command.context, arguments);
            if (result && _.isFunction(result.always)) {
                result.done(()=> {
                    executed = true;
                });
            } else {
                executed = true;
            }
            return result;
        };
        command.resetOnce = function () {
            executed = false;
        }
    }
};

module.exports = Command;