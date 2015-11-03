var AppError = require("./apperror.js");
var _ = require("lodash");
var URLRegex = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/;
var EmailRegex = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;

class Check {

    constructor(errors, key, value) {
        if (key == null) key = "";
        this._errors = errors;
        this._key = key;
        this._value = value;
    }

    fail(msg, params) {
        return this._errors.add(_.extend(new AppError(this._key, msg), params));
    }

    failIf(msg, fn) {
        var params;
        if (this.isValid()) {
            params = fn(this._value);
            if (_.isObject(params)) {
                this.fail(msg, params);
            } else if (params) {
                this.fail(msg);
            }
        }
        return this;
    }

    isValid() {
        return this._errors.isValid(this._key);
    }

    value(v) {
        if (v == null) {
            return this._value;
        }
        return this._value = v;
    }

    key() {
        return this._key;
    }

    notNull(msg) {
        if (msg == null) msg = "%(key)s should not be null";
        return this.failIf(msg, function (v) {
            return v == null;
        });
    }

    isNull(msg) {
        if (msg == null) msg = "%(key)s should be null";
        return this.failIf(msg, function (v) {
            return v != null;
        });
    }

    notEmpty(msg) {
        if (msg == null) msg = "%(key)s should not be empty";
        return this.failIf(msg, function (v) {
            if (_.isNull(v) || _.isUndefined(v) || _.isNaN(v)) {
                return true;
            } else if (_.isString(v) || _.isArray(v)) {
                return v.length == 0;
            } else if (_.isObject(v)) {
                return _.keys(v).length == 0;
            } else {
                return false;
            }
        });
    }

    email(msg) {
        if (msg == null) msg = "%(key)s is not valid email";
        return this.failIf(msg, function (v) {
            return !EmailRegex.test(v);
        });
    }

    lessThan(expected, msg) {
        if (msg == null) msg = "%(key)s %(actual)s should not be less than %(expected)s";
        return this.failIf(msg, function (v) {
            if (!(v < expected)) {
                return {
                    expected: expected,
                    actual: v
                };
            }
        });
    }

    lessEqThan(expected, msg) {
        if (msg == null) msg = "%(key)s %(actual)s should not be less or equal to %(expected)s";
        return this.failIf(msg, function (v) {
            if (!(v <= expected)) {
                return {
                    expected: expected,
                    actual: v
                };
            }
        });
    }

    notLessThan(expected, msg) {
        if (msg == null) msg = "%(key)s %(actual)s should not be less than %(expected)s";
        return this.failIf(msg, function (v) {
            if (v < expected) {
                return {
                    expected: expected,
                    actual: v
                };
            }
        });
    }


    moreThan(expected, msg) {
        if (msg == null) msg = "%(key)s %(actual)s should not be more than %(expected)s";
        return this.failIf(msg, function (v) {
            if (!(v > expected)) {
                return {
                    expected: expected,
                    actual: v
                };
            }
        });
    }

    moreEqThan(expected, msg) {
        if (msg == null) msg = "%(key)s %(actual)s should not be more or equal to %(expected)s";
        return this.failIf(msg, function (v) {
            if (!(v >= expected)) {
                return {
                    expected: expected,
                    actual: v
                };
            }
        });
    }

    equalTo(expected, msg) {
        if (msg == null) msg = "%(key)s %(actual)s should not be equal to %(expected)s";
        return this.failIf(msg, function (v) {
            if (v !== expected) {
                return {
                    expected: expected,
                    actual: v
                };
            }
        });
    }

    toNumber(msg) {
        if (msg == null) msg = "%(actual)s is not an integer";
        return this.failIf(msg, (v)=> {
            var val = this._value = parseFloat(v);
            if (!_.isFinite(val)) {
                return {
                    actual: v
                };
            }
        });
    }

    isValidURL(msg) {
        if (msg == null) msg = "%(key)s is not valid URL";
        return this.failIf(msg, function (v) {
            return !URLRegex.test(v);
        });
    }

    toDate(msg) {
        if (msg == null) {
            msg = "Value (%(actual)s) is not a date";
        }
        return this.failIf(msg, (v)=> {
            var parsed;
            if (!(v instanceof Date)) {
                parsed = Date.parse(v);
                this.value(new Date());
                this.value().setTime(parsed);
                if (isNaN(parsed)) {
                    return {
                        actual: v
                    };
                }
            }
        });
    }
}
module.exports = Check;