
module.exports = function(binding) {
  var Zone = zone.Zone;
  var Gate = zone.Gate;

  var cares_wrap = binding('cares_wrap');

  return {
    getaddrinfo: wrapResolver(cares_wrap.getaddrinfo),
    getHostByAddr: wrapResolver(cares_wrap.getHostByAddr),

    queryA: wrapResolver(cares_wrap.queryA),
    queryAaaa: wrapResolver(cares_wrap.queryAaaa),
    queryCname: wrapResolver(cares_wrap.queryCname),
    queryMx: wrapResolver(cares_wrap.queryMx),
    queryNaptr: wrapResolver(cares_wrap.queryNaptr),
    queryNs: wrapResolver(cares_wrap.queryNs),
    querySoa: wrapResolver(cares_wrap.querySoa),
    querySrv: wrapResolver(cares_wrap.querySrc),
    queryTxt: wrapResolver(cares_wrap.queryTxt),

    getServers: cares_wrap.getServers,
    setServers: cares_wrap.setServers,

    isIP: cares_wrap.isIP,
    strerror: cares_wrap.strerror,

    AF_INET: cares_wrap.AF_INET,
    AF_INET6: cares_wrap.AF_INET6,
    AF_UNSPEC: cares_wrap.AF_UNSPEC
  };

  function wrapResolver(baseMethod) {
    return function(req) {
      var wrap = this;
      var args = arguments;
      var result;

      new Gate(function ReqGate() {
        var realCallback = req.callback;
        req.callback = wrappedCallback;

        var gate = this;
        gate.name = baseMethod.name || 'DNS lookup';

        try {
          result = baseMethod.apply(cares_wrap, args);
        } catch (error) {
          gate.close();
          throw error;
        }

        function wrappedCallback() {
          gate.applyAsync(cares_wrap, realCallback, arguments);
          gate.close();
        }
      });

      return result;
    };
  }
};
