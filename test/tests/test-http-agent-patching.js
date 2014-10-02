require('../common.js');

test.expect(2);

var _http_agent = require('_http_agent');
var agent1, agent2, agent3;

agent1 = _http_agent.globalAgent;

zone.create(function() {
  agent2 = _http_agent.globalAgent;
});

zone.create(function() {
  agent3 = _http_agent.globalAgent;
});

test.notStrictEqual(agent1, agent2);
test.notStrictEqual(agent1, agent3);
test.done();
