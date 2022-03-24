
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

const changeStatusToReverseImageSearch = (pmid,team_slug,json_obj,callback) => {
  const vars = {
    pmid,
    clientMutationId: 'hello-check' + parseInt(new Date().getTime()),
  };

  const query = `{
    project_media(ids:"${pmid}"){
    last_status_obj {
      id # will use this id to update status
    }
  }}`;

  const headers = {
    'X-Check-Token': config.checkApiAccessToken
  };

  const transport = new Transport(config.live.checkApiUrl + '/api/graphql?team=' + team_slug, { headers, credentials: false, timeout: 120000 });
  const client = new Lokka({ transport });

  client.query(query, vars)
  .then(function(resp, err) {
    const status_id = resp['project_media']['last_status_obj']['id']
    console.log('Response: ' + util.inspect(resp));

    const mutationQuery = `{ updateDynamic(input: {
      clientMutationId: "1",
      id: "${status_id}",
      set_fields: "{\\"verification_status_status\\":\\"1642771242736\\"}",
    }) {
      project_media {
        id
        last_status
      }
    } }`;

    client.mutate(mutationQuery, vars)
    .then(function(resp, err) {
      console.log('Response: ' + util.inspect(resp));
      createReportCheck(pmid, team_slug,json_obj['summary_report'], callback);
      replyToCheck(pmid, team_slug,json_obj['details_note'], callback);
      callback(null);
    })
    .catch(function(e) {
      console.log('Error when executing mutation: ' + util.inspect(e));
      callback(null);
    });
  })
  .catch(function(e) {
    console.log('Error when executing mutation: ' + util.inspect(e));
  });
};

const createReportCheck = (pmid, team_slug, text, callback) => {
  console.log("createReportCheck")
  console.log('pmid', pmid);
  console.log('team_slug', team_slug);
  console.log('text', text);
  const vars = {
    text,
    pmid,
    clientMutationId: 'hello-check' + parseInt(new Date().getTime()),
  };

  const mutationQuery = `( $pmid: String!){
  createDynamicAnnotationReportDesign(input: {
    action: "save",
    clientMutationId: "1",
    annotated_type: "ProjectMedia",
    annotated_id: $pmid,
    set_fields: "{\\"state\\":\\"published\\",\\"options\\":[{\\"language\\":\\"en\\",\\"use_text_message\\":true,\\"title\\":\\"Report using google cloud vision\\",\\"text\\": \\"${text}\\"}]}"
  }) { dynamic { dbid } } }`;

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
  const data = JSON.parse(event.body);
  console.log('JSON.parse(event.body)', data);
  if (data.event === 'create_project_media') {
    const headers = null;
    const pmid = data.data.dbid.toString();
    const projectId = data.data.project.dbid;
    const picture = data.data.picture.toString();
    console.log('picture', picture);

    console.log('projectId', projectId);
    if (projectId == 14912 || 14837) {
        console.log('da5al','da5al');
        const https = require('https');

    const url_obj = require("url");
    let url = "https://8uvhoko4d6.execute-api.us-east-1.amazonaws.com/default/reverse_images_search?image_url="+picture

    console.log("request url", url);
    console.log("picture",picture)
    console.log("backend response","https://8uvhoko4d6.execute-api.us-east-1.amazonaws.com/default/reverse_images_search?image_url="+picture)

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
          const json_obj = JSON.parse(responseBody);
          console.log(json_obj);
          if (picture !== ""){
            changeStatusToReverseImageSearch(pmid,data.team.slug,json_obj, callback);
          }
        });

    resolve(res.statusCode)
    }).on('error', (e) => {
        console.log("2");
        reject(Error(e))
        })
       })
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
