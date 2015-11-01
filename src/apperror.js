var sprintf = require('sprintf-js').sprintf;

class AppError {

    constructor(key, format) {
        this.format = format;
        this.key = key != null ? key : "";
    }

    toString() {
        return sprintf(this.format, this);
    }
}
module.exports = AppError;