const express = require('express');
const serveStatic = require('serve-static');
const path = require('path');
const util = require('util');

const app = express();
const port = process.env.SERVER_PORT || 8586;
const functions = ['exif', 'youtube'];

function generateCallback(response) {
  const callback = function(value, resp) {
    console.log('Callback: ' + util.inspect(value));
    if (resp) {
      response.send(resp);
    }
  };
  return callback;
}

app.use(express.json());

functions.forEach(function(name) {
  app.post('/' + name, function(request, response){
    const lambda = require('./' + name).handler;
    console.log(name, util.inspect(request.body));
    try {
      lambda(request, null, () => {}).then(() => {
        response.end();
      }, (error) => {
        console.error(error.message);
        response.status(500).end();
      });
     }
     catch (e) {
        console.error(e.message);
        response.status(500).end();
     }
  });

  app.post('/health-desk', function(request, response){
    const lambda = require('./health-desk-bot/health-desk-bot-lambda-bg').handler;
    console.log('health-desk', util.inspect(request.body));
    try {
      lambda(request.body, null, () => {}).then(() => {
        response.end();
      }, (error) => {
        console.error(error.message);
        response.status(500).end();
      });
     }
     catch (e) {
        console.error(e.message);
        response.status(500).end();
     }
  });
});

console.log('Starting check-bots on port ' + port);
app.listen(port);
