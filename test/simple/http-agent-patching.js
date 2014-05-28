
require('../common.js');

var assert = require('assert');
var _http_agent = require('_http_agent');
var Zone = zone.Zone;

var agent1, agent2, agent3;

agent1 = _http_agent.globalAgent;

zone.create(function() {
  agent2 = _http_agent.globalAgent;
});

zone.create(function() {
  agent3 = _http_agent.globalAgent;
});

assert(agent1 !== agent2);
assert(agent1 !== agent3);
