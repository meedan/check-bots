const Lokka = require('lokka').Lokka,
      config = require('./config.js').exif,
      util = require('util'),
      request = require('request'),
      ExifImage = require('exif').ExifImage,
      Transport = require('lokka-transport-http').Transport;

// Send a mutation to Check API

const replyToCheck = (pmid, title, description, image_url, team_slug, callback) => {
  const setFields = JSON.stringify({
    team_bot_response_formatted_data: JSON.stringify({
      title,
      description,
      image_url,
    })
  });

  const vars = {
    setFields,
    pmid,
    clientMutationId: 'exifbot' + parseInt(new Date().getTime()),
  };

  const mutationQuery = `($setFields: String!, $pmid: String!, $clientMutationId: String!) {
    createDynamic: createDynamic(input: { clientMutationId: $clientMutationId, set_fields: $setFields, annotated_id: $pmid, annotated_type: "ProjectMedia", annotation_type: "team_bot_response" }) {
      project_media {
        dbid
      }
    }
  }`;
  
  const headers = {
    'X-Check-Token': config.checkApiAccessToken
  };

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

const main = (image_url, pmid, team_slug, callback) => {
  request({ uri: image_url, encoding: null }, (err, resp, buffer) => {
    if (!err) {
      try {
        new ExifImage({ image: buffer }, (error, metadata) => {
          if (!error) {
            const message = [
              '• Make: ' + metadata.image.Make,
              '• Model: ' + metadata.image.Model,
              '• Software: ' + metadata.image.Software,
              '• Date: ' + metadata.exif.DateTimeOriginal,
              'See full EXIF information at http://metapicz.com/#landing?imgsrc=' + image_url
            ].join("\n");
            console.log('Sending to Check: ' + util.inspect(message));
            replyToCheck(pmid, 'EXIF Data', message, null, team_slug, callback);
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

exports.handler = (event, context, callback) => {
  const data = JSON.parse(event.body);
  if (data.event === 'create_project_media' && data.data.report_type === 'uploadedimage') {
    const image_url = data.data.media.picture.replace(/^https?:\/\/[^\/]+/, config.checkApiUrl);
    const pmid = data.data.dbid.toString();
    const team_slug = data.team.slug;
    if (image_url && pmid && team_slug) {
      main(image_url, pmid, team_slug, callback);
    }
    else {
      callback(null);
    }
  }
  else {
    callback(null);
  }
};
