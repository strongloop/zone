exports = module.exports = require('native:_http_agent');

var Agent = exports.Agent;

// Monkey-patch the globalAgent property to always use a single agent in the
// active zone. The HTTP agent and the HTTP client are so intertwined that it
// is not practical to share them between zones.
zone.root._httpAgent = exports.globalAgent;

function getAgent() {
  if (zone._httpAgent) return zone._httpAgent;

  var agent = new Agent();
  zone._httpAgent = agent;
  return agent;
}

function setAgent(agent) { zone._httpAgent = agent; }

Object.defineProperty(
    exports, 'globalAgent',
    {get: getAgent, set: setAgent, enumerable: true, configurable: false});
