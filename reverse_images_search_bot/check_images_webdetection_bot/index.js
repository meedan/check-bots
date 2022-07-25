var http = require('http');

const config = require('./config.js'),
      Lokka = require('lokka').Lokka,
      util = require('util'),
      Transport = require('lokka-transport-http').Transport;
const replyToCheck = (pmid, team_slug, text, callback) => {
  console.log('pmid', pmid);
  console.log('team_slug', team_slug);
  console.log('text', text);
  const vars = {
    text,
    pmid,
    clientMutationId: 'hello-check' + parseInt(new Date().getTime()),
  };

  const mutationQuery = `($text: String!, $pmid: String!, $clientMutationId: String!) {
    createComment: createComment(input: { clientMutationId: $clientMutationId, text: $text, annotated_id: $pmid, annotated_type: "ProjectMedia"}) {
      comment {
        text
      }
    }
  }`;

  const headers = {
    'X-Check-Token': config.checkApiAccessToken
  };

  const transport = new Transport(config.live.checkApiUrl + '/api/graphql?team=' + team_slug, { headers, credentials: false, timeout: 120000 });
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

exports.handler = (event, context, callback) => {


  // request('http://127.0.0.1:3100/webdetection?image_url=%22x%22', { json: true }, (err, res, body) => {
  //   if (err) { return console.log(err); }
  //   console.log(body.url);
  //   console.log(body.explanation);
  // });
  
  const data = JSON.parse(event.body);
  console.log('JSON.parse(event.body)', data);
  if (data.event === 'create_project_media') {
    // console.log(util.inspect(context));
    //const content = data.data.media.url// || data.data.media.quote;
    // const headers = util.inspect(event.headers);
    const headers = null;
    const pmid = data.data.dbid.toString();
    const projectId = data.data.project.dbid;
    const picture = data.data.picture.toString();
    console.log('picture', picture);

    console.log('projectId', projectId);
    if (projectId == 14912) {
        console.log('da5al','da5al');
        const https = require('https');
        
        const http = require("http");
    // const https = require("https");
    const url_obj = require("url");
    // const https = require('https')
    // let url = "https://8uvhoko4d6.execute-api.us-east-1.amazonaws.com/default/reverse_images_search?image_url=https://assets.checkmedia.org/uploads/uploaded_image/779075/embed_173cbfefc3f68ad010d9bdc01d326dd1.jpeg"
    let url = "https://8uvhoko4d6.execute-api.us-east-1.amazonaws.com/default/reverse_images_search?image_url="+picture

  console.log("request url", url);
  console.log("p",picture)
    console.log("ps","https://8uvhoko4d6.execute-api.us-east-1.amazonaws.com/default/reverse_images_search?image_url="+picture)

    const promise = new Promise(function(resolve, reject) {
    https.get(url, (res) => {
    console.log("https.get(url, (res)");
              res.setEncoding('utf8');
        let responseBody = '';
    
        res.on('data', (chunk) => {
            responseBody += chunk;
        });
    
        res.on('end', () => {
           console.log("responseBody");
          console.log(responseBody);
                replyToCheck(pmid, data.team.slug,responseBody, callback);

            // resolve(JSON.parse(responseBody));
        });
    
    resolve(res.statusCode)
    }).on('error', (e) => {
    console.log("2");
    reject(Error(e))
    })
    })
      // replyToCheck(pmid, data.team.slug,'22 Hello from bot! You added ' + data.data.title + ' to ' + data.team.slug + '. The headers: ' + headers , callback);
    }
  } else if (data.event === 'update_project_media') {
    console.log(util.inspect(context));
    const content = data.data.media.url || data.data.media.quote;
    const log = util.inspect(data.data.log);
    const pmid = data.data.dbid.toString();
    replyToCheck(pmid, data.team.slug, 'Hello from bot! You updated ' + content + '. The changes: ' + log, callback);
  } else if (data.event === 'update_annotation_verification_status') {
    const content = util.inspect(data.data.data);
    const log = util.inspect(data.data.version);
    const pmid = data.data.annotated_id.toString();
    console.log('pmid', pmid);
    replyToCheck(pmid, data.team.slug, 'Hello from bot! Verification status updated ' + content + '. The changes: ' + log, callback);
  }
  else {
    callback(null);
  }
};
