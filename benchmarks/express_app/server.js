require('../../lib/setup.js').enable();

function RequestZone(req, res, next) {
    zone.data.url = req.url;
    next();
  }
  
  function ErrorHandler(err) {
      console.error(err);
    }

function ZonedRequestHandler(req, res, next) {
  zone.create(RequestZone, {arguments: [req, res, next]}).catch (ErrorHandler);
}

express = require('express');
var app = express();
var bodyParser = require('body-parser');

app.use(ZonedRequestHandler);

app.use(bodyParser());
var router = express.Router();

router.get('/', function(req, res) {
  res.json({
    // zone: zone.name,
    message: 'Hello world'
  });
});

app.use('/api', router);
app.listen(3001);
