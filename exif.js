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

  client.mutate(mutationQuery, vars)
  .then(function(resp, err) {
    console.log('Response: ' + util.inspect(resp));
    callback(null);
  })
  .catch(function(e) {
    console.log('Error when executing mutation: ' + util.inspect(e));
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

  replyToCheck(mutationQuery, vars, team_slug, callback);
};

const addSuggestion = (coordinates, task_id, task_type, task_dbid, name, team_slug, callback) => {
  const setFields = {};
  setFields[`task_${task_type}`] = task_dbid.toString();
  setFields[`suggestion_${task_type}`] = JSON.stringify({ suggestion: convertToGeoJSON(coordinates, name), comment: `According to the EXIF information in this image, this seems to be located at ${name}: http://www.google.com/maps/place/${coordinates[0]},${coordinates[1]}` });

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
        suggestions_count
      }
    }
  }`;

  replyToCheck(mutationQuery, vars, team_slug, callback);
};

const main = (image_url, pmid, team_slug, settings, callback) => {
  request({ uri: image_url, encoding: null }, (err, resp, buffer) => {
    if (!err) {
      try {
        new ExifImage({ image: buffer }, (error, metadata) => {
          if (!error) {
            const link = settings.link || 'http://metapicz.com/#landing?imgsrc={URL}'
            const message = [
              '• Make: ' + (metadata.image.Make || 'Not found'),
              '• Model: ' + (metadata.image.Model || 'Not found'),
              '• Software: ' + (metadata.image.Software || 'Not found'),
              '• Date: ' + (metadata.exif.DateTimeOriginal || 'Not found'),
              'See full EXIF information at ' + link.replace('{URL}', image_url)
            ].join("\n");
            console.log('Sending to Check: ' + util.inspect(message));
            addComment(pmid, 'EXIF Data', message, null, team_slug, callback);
          }
          else {
            console.log('Error on reading EXIF data: ' + e.message);
            callback(null);
          }
        });
      } catch(error) {
        console.log('Error: ' + error.message);
        callback(null);
      }
    }
    else {
      console.log('Error on getting remote image: ' + util.inspect(err));
      callback(null);
    }
  });
};

const parseDMS = (input) => {
  const parts = input.split(' ');
  const lat = convertDMSToDD(parts[0], parts[1], parts[2], parts[3]);
  const lng = convertDMSToDD(parts[4], parts[5], parts[6], parts[7]);
  return [lat, lng];
};

const convertDMSToDD = (degrees, minutes, seconds, direction) => {
  let dd = parseFloat(degrees) + parseFloat(minutes)/60 + parseFloat(seconds)/(60*60);
  if (direction == "S" || direction == "W") {
    dd = dd * -1;
  }
  return dd;
};

const convertToGeoJSON = (coordinates, name) => {
  const geojson = JSON.stringify({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates
    },
    properties: {
      name
    }
  });
  return geojson;
};

const suggest = (image_url, task_id, task_type, task_dbid, team_slug, callback) => {
  request({ uri: image_url, encoding: null }, (err, resp, buffer) => {
    if (!err) {
      try {
        new ExifImage({ image: buffer }, (error, metadata) => {
          if (!error) {
            const { gps } = metadata;
            if (gps) {
              const lat = `${gps.GPSLatitude.join(' ')} ${gps.GPSLatitudeRef}`;
              const lon = `${gps.GPSLongitude.join(' ')} ${gps.GPSLongitudeRef}`;
              const coordinates = parseDMS(lat + ' ' + lon);
              geocoder.reverse({ lat, lon }, function(err, res) {
                let name = null;
                if (!err) {
                  let names = [];
                  const parts = [res[0].city, res[0].state, res[0].country];
                  for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    if (part) {
                      names.push(part);
                    }
                  }
                  name = names.join(', ');
                }
                if (!name) {
                  name = 'No name';
                }
                addSuggestion(coordinates, task_id, task_type, task_dbid, name, team_slug, callback);
              });
            }
          }
          else {
            console.log('Error on reading EXIF data: ' + e.message);
            callback(null);
          }
        });
      } catch(error) {
        console.log('Error: ' + error.message);
        callback(null);
      }
    }
    else {
      console.log('Error on getting remote image: ' + util.inspect(err));
      callback(null);
    }
  });
};

const assignedToCammie = (data) => {
  let assigned = false;
  const edges = data.data.assignments.edges;
  for (let i = 0; i < edges.length; i++) {
    if (!assigned && edges[i].node.name === 'Cammie the EXIF Bot') {
      assigned = true;
    }
  }
  return assigned;
};

exports.handler = (event, context, callback) => {
  const data = JSON.parse(event.body);
  if (data.event === 'create_project_media' && data.data.report_type === 'uploadedimage') {
    const image_url = data.data.media.picture.replace(/^https?:\/\/[^\/]+/, config.checkApiUrl);
    const pmid = data.data.dbid.toString();
    const team_slug = data.team.slug;
    let settings = data.settings || '{}';
    settings = JSON.parse(settings);
    if (image_url && pmid && team_slug) {
      main(image_url, pmid, team_slug, settings, callback);
    }
    else {
      callback(null);
    }
  }
  else if ((data.event === 'update_annotation_task_geolocation' || data.event === 'create_annotation_task_geolocation') && data.data.project_media.report_type === 'uploadedimage' && assignedToCammie(data)) {
    const image_url = data.data.project_media.media.picture.replace(/^https?:\/\/[^\/]+/, config.checkApiUrl);
    const task_id = data.data.id.toString();
    const task_dbid = data.data.dbid.toString();
    const task_type = JSON.parse(data.data.content)['type'];
    const team_slug = data.team.slug;
    const suggestions_count = parseInt(JSON.parse(data.data.content)['suggestions_count']);
    if (image_url && task_id && task_type && team_slug && !suggestions_count) {
      suggest(image_url, task_id, task_type, task_dbid, team_slug, callback);
    }
    else {
      callback(null);
    }
  }
  else {
    callback(null);
  }
};
