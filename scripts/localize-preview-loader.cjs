const { transform } = require("./lib/localize-jsx.cjs");
const { bridgeScene } = require("./lib/scene-bridge.cjs");
module.exports = function (source) { return transform(bridgeScene(source), this.resourcePath); };
