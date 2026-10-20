const { transform } = require("./lib/localize-jsx.cjs");
module.exports = function (source) { return transform(source, this.resourcePath); };
