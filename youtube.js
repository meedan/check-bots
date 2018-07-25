const getJSON = require('get-json'),
      config = require('./config.js').youtube,
      Lokka = require('lokka').Lokka,
      util = require('util'),
      request = require('request'),
      cheerio = require('cheerio'),
      Entities = require('html-entities').AllHtmlEntities,
      Transport = require('lokka-transport-http').Transport;

// Given a YouTube URL, return the video ID

const getIdFromYouTubeUrl = (url) => {
  let id = null;
  let parts = url.match(/^https?:\/\/(youtube\.com|www\.youtube\.com)\/watch\?v=([a-zA-Z0-9_-]+)/);
  if (parts && parts[2]) {
    id = parts[2];
  }
  else {
    parts = url.match(/^https?:\/\/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (parts && parts[1]) {
      id = parts[1];
    }
  }
  return id;
};

// Get a reverse image search result
const getReverseImageResult = (image_url, callback) => {
  let options = {
    url: 'https://www.google.com/searchbyimage',
    qs: { image_url },
    headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.64 Safari/537.11' }
  };
  
  request.get(options, function(err, res, body) {
    if (!err) {
      const $ = cheerio.load(body);
      let name = $('#topstuff .card-section > div + div a').html();
      if (name) {
        const entities = new Entities();
        name = entities.decode(name);
        callback(name);
      }
      else {
        callback(null);
      }
    }
    else {
      callback(null);
    }
  });
};

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
    clientMutationId: 'youtubebot' + parseInt(new Date().getTime()),
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

const main = (url, pmid, team_slug, callback) => { 
  if (!url) {
    console.log('Please pass a YouTube URL');
    callback(null);
    return false;
  }
  
  const id = getIdFromYouTubeUrl(url);
  if (!id) {
    console.log('Could not find a YouTube video id in that URL, sorry');
    callback(null);
    return false;
  }
  
  getJSON('https://www.googleapis.com/youtube/v3/videos?id=' + id + '&part=snippet,statistics,recordingDetails&key=' + config.youtubeKey, (error, response) => {
    const uploaded_at = response.items[0]['snippet']['publishedAt'];
    let timestampMsg = 'This video was published at ' + uploaded_at;
    if (typeof response.items[0]['recordingDetails'] != 'undefined') {
      if (response.items[0]['recordingDetails']['recordingDate']) {
        timestampMsg += ' but recorded at ' + response.items[0]['recordingDetails']['recordingDate'];
      }
      
      if (typeof response.items[0]['recordingDetails']['location'] != 'undefined') {
        const lat = response.items[0]['recordingDetails']['location']['latitude'];
        const lon = response.items[0]['recordingDetails']['location']['longitude'];
        replyToCheck(pmid, 'YouTube Geolocation', 'View on a map the location of this video: https://www.google.com/maps/search/' + lat + ',+' + lon + '.', null, team_slug, callback);
      }
    }
    replyToCheck(pmid, 'YouTube Timestamp', timestampMsg, null, team_slug, callback);
    for (let i=0; i < 4; i++) {
      const prefix = i > 0 ? 'hq' : '';
      const image_src = 'http://img.youtube.com/vi/' + response.items[0]['id'] + '/' + prefix + i + '.jpg';
      const reverse_image_url = 'https://www.google.com/searchbyimage?image_url=' + image_src;
      getReverseImageResult(image_src, (reverse_image_result) => {
        if (reverse_image_result) {
          replyToCheck(pmid, 'YouTube Thumbnail', 'Reverse image search result for this image: ' + reverse_image_result + '. More results at: ' + reverse_image_url + '.', image_src, team_slug, callback);
        }
        else {
          replyToCheck(pmid, 'YouTube Thumbnail', 'No reverse image search results for this image for now. You can try again at: ' + reverse_image_url + '.', image_src, team_slug, callback);
        }
      });
    }
  });
};

exports.handler = (event, context, callback) => {
  const data = JSON.parse(event.body);
  if (data.event === 'create_project_media') {
    const url = data.data.media.url;
    const pmid = data.data.dbid.toString();
    main(url, pmid, data.team.slug, callback);
  }
  else {
    callback(null);
  }
};
