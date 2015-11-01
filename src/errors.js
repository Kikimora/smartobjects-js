var _ = require('lodash');
var EventEmitter = require('micro-events');
var Check = require("./check.js");

class Errors extends EventEmitter {

    constructor() {
        super();
        this._errors = [];
    }

    add(error) {
        this._errors.push(error);
        return this.emit('change', error.key);
    }

    clear(key) {
        var old = this._errors;
        if (key != null) {
            this._errors = _.filter(this._errors, (err)=> { return err.key != key; });
        } else {
            this._errors = [];
        }
        if (old.length != this._errors.length) {
            return this.emit('change', key);
        }
    }

    hasErrors(key) {
        return !this.isValid(key);
    }

    isValid(key) {
        if (key == null) {
            return this._errors.length == 0;
        } else {
            return !(_.find(this._errors, (err)=> { return err.key == key; }));
        }

    }

    check(key, value) {
        this.clear(key);
        return new Check(this, key, value);
    }

    errors(key) {
        if (key == null) {
            return _.clone(this._errors);
        }
        return _.filter(this._errors, (err)=> {
            return err.key === key;
        });
    }
}

module.exports = Errors;