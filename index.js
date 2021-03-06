"use strict";

import mixin from "./src/mixin";

module.exports = {
    DataContext: require("./src/datacontext.js"),
    Errors: require("./src/errors.js"),
    Check: require("./src/check.js"),
    controller: require("./src/controller.jsx"),
    Command: require("./src/command.js"),
    mixin: mixin
};