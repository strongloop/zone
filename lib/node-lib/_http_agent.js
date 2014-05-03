
exports = module.exports = require('native:_http_agent');

var Agent = exports.Agent;


// Monkey-patch the globalAgent property to always use a single agent in the
// active zone. The HTTP agent and the HTTP client are so intertwined that it
// is not practical to share them between zones.

zone.root.__http_agent__ = exports.globalAgent;

function getAgent() {
  if (zone.__http_agent__)
    return zone.__http_agent__;

  var agent = new Agent();
  zone.__http_agent__ = agent;
  return agent;
}

function setAgent(agent) {
  zone.__http_agent__ = agent;
}

Object.defineProperty(exports,
                      'globalAgent',
                      { get: getAgent,
                        set: setAgent,
                        enumerable: true,
                        configurable: false
                      });
