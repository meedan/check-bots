const config = require('./config.js'),
      util = require('util'),
      Lokka = require('lokka').Lokka,
      Transport = require('lokka-transport-http').Transport;

// "graphql" => "data, project_media { title, dbid, status, report_status, media { quote, url }}"
exports.handler = (event, context, callback) => {
  const data = JSON.parse(event.body);
  if (data.event === 'publish_report') {
    var response = {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({report: data.data.data, item: data.data.project_media})
    }
    callback(null, response)
  }
  else {
    callback(null);
  }
};
