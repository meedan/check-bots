const Lokka = require('lokka').Lokka,
      config = require('./config.js').exif,
      util = require('util'),
      request = require('request'),
      ExifImage = require('exif').ExifImage,
      Transport = require('lokka-transport-http').Transport,
      NodeGeocoder = require('node-geocoder');

const options = { provider: 'opencage', apiKey: config.opencageKey };
const geocoder = NodeGeocoder(options);

// Send a mutation to Check API
const replyToCheck = (mutationQuery, vars, team_slug, callback) => {
  const headers = {
    'X-Check-Token': config.checkApiAccessToken
  };

  vars.clientMutationId = 'exifbot' + parseInt(new Date().getTime());

  const transport = new Transport(config.checkApiUrl + '/api/graphql?team=' + team_slug, { headers, credentials: false, timeout: 120000 });
  const client = new Lokka({ transport });

  return client.mutate(mutationQuery, vars)
  .then(function(resp, err) {
    console.log('Response: ' + util.inspect(resp));
    callback(null);
  })
  .catch(function(e) {
    console.error('Error sending response: ' + util.inspect(e));
    callback(null);
  });
};

const addComment = (pmid, title, description, image_url, team_slug, callback) => {
  const setFields = JSON.stringify({
    team_bot_response_formatted_data: JSON.stringify({
      title,
      description,
      image_url,
    })
  });

  const vars = {
    setFields,
    pmid
  };

  const mutationQuery = `($setFields: String!, $pmid: String!, $clientMutationId: String!) {
    createDynamic: createDynamic(input: { clientMutationId: $clientMutationId, set_fields: $setFields, annotated_id: $pmid, annotated_type: "ProjectMedia", annotation_type: "team_bot_response" }) {
      project_media {
        dbid
      }
    }
  }`;

  return replyToCheck(mutationQuery, vars, team_slug, callback);
};

const addResponse = (geojson, task_id, task_type, task_dbid, team_slug, callback) => {
  const setFields = {};
  setFields[`task_${task_type}`] = task_dbid.toString();
  setFields[`response_${task_type}`] = JSON.stringify(geojson);

  const response = JSON.stringify({
    annotation_type: `task_response_${task_type}`,
    set_fields: JSON.stringify(setFields)
  });

  const vars = {
    response,
    id: task_id
  };

  const mutationQuery = `($id: ID!, $response: String!, $clientMutationId: String!) {
    updateTask: updateTask(input: { clientMutationId: $clientMutationId, id: $id, response: $response }) {
      task {
        dbid
      }
    }
  }`;

  return replyToCheck(mutationQuery, vars, team_slug, callback);
};

const loadImage = function(image_url) {
  return new Promise(function(resolve, reject) {
    request({ uri: image_url, encoding: null }, (err, resp, buffer) => {
      if (!err) {
        resolve(buffer);
      }
      else {
        reject(new Error('Error on getting remote image: ' + util.inspect(err)));
      }
    });
  });
}

const getExif = function(image) {
  return new Promise(function(resolve, reject) {
    new ExifImage({ image }, (error, metadata) => {
      if (!error) {
        resolve(metadata);
      }
      else {
        reject(new Error('Error on reading EXIF data: ' + error.message));
      }
    });
  });
}

exports.getMetadata = function(image_url) {
  const empty = {
    make: 'Not found',
    model: 'Not found',
    software: 'Not found',
    date: 'Not found'
  };
  return loadImage(image_url).then(function(image) {
    return getExif(image);
  }, function(error) {
    console.error(error.message);
    return null;
  }).then(function(metadata) {
    return metadata ? Object.assign({}, empty, {
      make: metadata.image.Make,
      model: metadata.image.Model,
      software: metadata.image.Software,
      date: metadata.exif.DateTimeOriginal
    }) : empty;
  }, function(error) {
    console.error(error.message);
    return empty;
  });
}

const extract = async (image_url, pmid, team_slug, settings, callback) => {
  const metadata = await exports.getMetadata(image_url);
  const link = settings.link || 'http://metapicz.com/#landing?imgsrc={URL}'
  const message = [
    '• Make: ' + metadata.make,
    '• Model: ' + metadata.model,
    '• Software: ' + metadata.software,
    '• Date: ' + metadata.date,
    'See full EXIF information at ' + link.replace('{URL}', image_url)
  ].join("\n");
  console.log('Sending EXIF metadata: ' + util.inspect(message));
  await addComment(pmid, 'EXIF Data', message, null, team_slug, callback);
};

const parseDMS = (input) => {
  const parts = input.split(' ');
  const lat = convertDMSToDD(parts[0], parts[1], parts[2], parts[3]);
  const lon = convertDMSToDD(parts[4], parts[5], parts[6], parts[7]);
  return [lat, lon];
};

const convertDMSToDD = (degrees, minutes, seconds, direction) => {
  let dd = parseFloat(degrees) + parseFloat(minutes)/60 + parseFloat(seconds)/(60*60);
  if (direction == "S" || direction == "W") {
    dd = dd * -1;
  }
  return dd;
};

const convertToGeoJSON = (coordinates, name) => {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates
    },
    properties: {
      name
    }
  };
};

const getGeocode = (lat, lon) => {
  const coordinates = parseDMS(lat + ' ' + lon);
  return new Promise((resolve, reject) => {
    geocoder.reverse({ lat, lon }, (err, res) => {
      if (!err) {
        const name = [res[0].city, res[0].state, res[0].country]
          .filter(x => !!x)
          .join(', ');
        resolve(convertToGeoJSON(coordinates, name));
      }
      else {
        console.error('Geocoding error: ' + err);
        resolve(convertToGeoJSON(coordinates, 'No location name found'));
      }
    });
  });
}

exports.getGeolocation = (image_url) => {
  return loadImage(image_url).then((image) => {
    return getExif(image);
  }, (error) => {
    console.error(error.message);
    throw error;
  }).then((metadata) => {
    const { gps } = metadata;
    if (!gps || !Object.keys(gps).length) throw(new Error('No GPS information found'));
    const lat = `${gps.GPSLatitude.join(' ')} ${gps.GPSLatitudeRef}`;
    const lon = `${gps.GPSLongitude.join(' ')} ${gps.GPSLongitudeRef}`;
    return getGeocode(lat, lon);
  }, (error) => {
    console.error(error.message);
    throw error;
  });
}

const respond = async (image_url, task_id, task_type, task_dbid, team_slug, callback) => {
  const geojson = await exports.getGeolocation(image_url).catch(function(error) {
    // TODO send error reply.
    console.error('Geolocation error: ' + error.message);
  });
  if (geojson) {
    console.log('Sending GeoJSON task response: ' + util.inspect(geojson));
    await addResponse(geojson, task_id, task_type, task_dbid, team_slug, callback);
  }
};

exports.handler = async (event, context, callback) => {
  const data = JSON.parse(event.body);
  if (data.event === 'create_project_media' && data.data.report_type === 'uploadedimage') {
    const image_url = data.data.media.picture.replace(/^https?:\/\/[^\/]+/, config.checkApiUrl);
    const pmid = data.data.dbid.toString();
    const team_slug = data.team.slug;
    const settings = JSON.parse(data.settings || '{}');
    if (image_url && pmid && team_slug) {
      await extract(image_url, pmid, team_slug, settings, callback);
    }
    else {
      console.log('Not attempting to extract EXIF metadata.');
      callback(null);
    }
  }
  else if ((data.event === 'update_annotation_task_geolocation' || data.event === 'create_annotation_task_geolocation') && data.data.project_media.report_type === 'uploadedimage') {
    const content = JSON.parse(data.data.content);
    const image_url = data.data.project_media.media.picture.replace(/^https?:\/\/[^\/]+/, config.checkApiUrl);
    const task_id = data.data.id.toString();
    const task_dbid = data.data.dbid.toString();
    const task_type = content['type'];
    const team_slug = data.team.slug;
    const response = data.data.annotations.edges.filter(edge => edge.node.annotation_type === 'task_response_geolocation').length > 0;
    if (image_url && task_id && task_type && team_slug && !response) {
      await respond(image_url, task_id, task_type, task_dbid, team_slug, callback);
    }
    else {
      console.log('Not attempting to respond to geolocation task.');
      callback(null);
    }
  }
  else {
    console.log(`Ignoring event ${data.event}.`);
    callback(null);
  }
};

const isLambda = !!((process.env.LAMBDA_TASK_ROOT && process.env.AWS_EXECUTION_ENV) || false);
const isTesting = typeof global.it === 'function';
if (isLambda) {
  // AWS Lambda: do nothing.
} else if (isTesting) {
  // Testing: do nothing.
} else {
  // Local or elsewhere: listen manually.
  const express = require('express');
  const bodyParser = require('body-parser');
  const app = express();
  const port = process.env.PORT || 0xb001;
  app.use(bodyParser.json()); // for parsing application/json
  app.post('/', (req, res) => {
    console.log(req.body);
    req.body = JSON.stringify(req.body); // because the handler will try to parse it again
    exports.handler(req, null, () => {}).then(() => {
      res.end();
    }, (error) => {
      console.error(error.message);
      res.status(500).end();
    });
  });
  app.listen(port, () => console.log(`EXIF bot listening on port ${port}...`));
}
