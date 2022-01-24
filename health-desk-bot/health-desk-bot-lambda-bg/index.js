const axios = require('axios');
const config = require('./config.js');
const Lokka = require('lokka').Lokka;
const util = require('util');
const Transport = require('lokka-transport-http').Transport;

const queryAlegre = (text, respond) => {
  axios
    .get(config.alegreSimilarityEndpoint, {
      data: {
        text,
        model: "elasticsearch",
        context: {
          health_desk: true,
          field: ["title", "summary", , "question"],
        },
      }
    })
    .then(res => {
      console.log(`statusCode: ${res.status}`);
      console.log('res.data', res.data);
      if (res.data.result && res.data.result.length) {
        respond('A Health Desk article has matched this media. View the article at ' + res.data.result[0]['_source'].context.url + ' - Health Desk provides context to journalists on health topics.');
      } else {
        respond('Nothing found on Health Desk.');
      }
    })
    .catch(error => {
      console.error('error', error);
    });
};

const replyToCheck = async (pmid, team_slug, text, callback) => {
  console.log('pmid', pmid);
  console.log('team_slug', team_slug);
  console.log('replyToCheck:', text);
  const vars = {
    text,
    pmid,
    clientMutationId: 'health-desk-bot' + parseInt(new Date().getTime(), 10),
  };

  const mutationQuery = `($text: String!, $pmid: String!, $clientMutationId: String!) {
    createComment: createComment(input: { clientMutationId: $clientMutationId, text: $text, annotated_id: $pmid, annotated_type: "ProjectMedia"}) {
      comment {
        text
      }
    }
  }`;

  const headers = { 'X-Check-Token': config.checkApiAccessToken };
  const transport = new Transport(config.qa.checkApiUrl + '/api/graphql?team=' + team_slug, { headers, credentials: false, timeout: 120000 });
  const client = new Lokka({ transport });

  console.log('Sending mutation with vars: ' + JSON.stringify(vars));
  const resp = await client.mutate(mutationQuery, vars);
  console.log('resp', resp);
};

exports.handler = (payload, context, callback) => {
  const data = payload.data;
  console.log('data', data);

  if (data.event === 'create_project_media') {
    const text = data.data.title;
    const pmid = data.data.dbid.toString();
    const slug = data.team.slug;
    const respond = (botNote) => replyToCheck(pmid, slug, botNote, callback);

    console.log('text', text);
    if (text) queryAlegre(text, respond);
  } else {
    callback(null);
  }
};
