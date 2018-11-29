const getJSON = require('get-json'),
      config = require('./config.js').similarity,
      Lokka = require('lokka').Lokka,
      util = require('util'),
      request = require('request'),
      Transport = require('lokka-transport-http').Transport;

// Send a mutation to Check API

const replyToCheck = (pmid, title, description, team_slug, callback) => {
  const setFields = JSON.stringify({
    team_bot_response_formatted_data: JSON.stringify({
      title,
      description,
    })
  });

  const vars = {
    setFields,
    pmid: pmid.toString(),
    clientMutationId: 'similaritybot' + parseInt(new Date().getTime()),
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

const sendRequestToAlegre = (endpoint, params, successCallback, failureCallback) => {
  const options = {
    uri: config.alegreUrl + '/' + endpoint,
    method: 'POST',
    json: params
  };

  request(options, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      successCallback(response);
    }
    else {
      console.log('Error when requesting Alegre: ' + util.inspect(error));
      failureCallback(error);
    }
  });
};

const storeClaimInAlegre = (claim, id, pmid, pid, team, callback) => {
  const successCallback = (response) => {
    replyToCheck(pmid, 'Claim sent to Alegre', "This claim was sent to Alegre's similarity index and if a similar claim is found, it will be related to this one.", team.slug, callback);
  };
  const failureCallback = (error) => {
    replyToCheck(pmid, 'Claim NOT sent to Alegre', "Sorry, I could not send this claim to Alegre's similarity index. Please contact the support.", team.slug, callback);
  };
  sendRequestToAlegre('similarity/', { text: claim, context: { team_id: team.dbid, project_id: pid, project_media_id: pmid, project_media_graphql_id: id } }, successCallback, failureCallback);
};

const createRelationshipsOnCheck = (claim, id, pmid, pid, team, callback) => {
  const similar = claims.shift();

  const vars = {
    id: similar,
    relatedToId: pmid,
    clientMutationId: 'similaritybot' + parseInt(new Date().getTime()),
  };

  const mutationQuery = `($relatedToId: Int!, $id: ID!, $clientMutationId: String!) {
    updateProjectMedia: updateProjectMedia(input: { clientMutationId: $clientMutationId, id: $id, related_to_id: $relatedToId }) {
      project_media {
        dbid
      }
    }
  }`;
  
  const headers = {
    'X-Check-Token': config.checkApiAccessToken
  };

  const transport = new Transport(config.checkApiUrl + '/api/graphql?team=' + team.slug, { headers, credentials: false, timeout: 120000 });
  const client = new Lokka({ transport });

  client.mutate(mutationQuery, vars)
  .then(function(resp, err) {
    console.log('Response: ' + util.inspect(resp));
    if (claims.length > 0) {
      createRelationshipsOnCheck(claim, id, pmid, pid, team, callback);
    }
    else {
      storeClaimInAlegre(claim, id, pmid, pid, team, callback);
    }
  })
  .catch(function(e) {
    console.log('Error when executing mutation: ' + util.inspect(e));
    callback(null);
  });
};

const claims = [];

const main = (claim, id, pmid, pid, team, callback) => {
  const successCallback = (response) => {
    response.body.result.forEach((result) => {
      const claim = result['_source'];
      if (claim.context && claim.context.project_media_id !== pmid) {
        claims.push(claim.context.project_media_graphql_id);
      }
    });
    if (claims.length > 0) {
      createRelationshipsOnCheck(claim, id, pmid, pid, team, callback);
    }
    else {
      storeClaimInAlegre(claim, id, pmid, pid, team, callback);
    }
  };
  const failureCallback = (error) => {
  };
  sendRequestToAlegre('similarity/query', { text: claim, context: { project_id: pid } }, successCallback, failureCallback);
};

exports.handler = (event, context, callback) => {
  const data = JSON.parse(event.body);
  if (data.event === 'create_project_media') {
    const claim = data.data.media.quote;
    if (claim) {
      const pmid = parseInt(data.data.dbid, 10);
      const pid = parseInt(data.data.project_id, 10);
      const { team } = data;
      main(claim, data.data.id, pmid, pid, team, callback);
    }
    else {
      callback(null);
    }
  }
  else {
    callback(null);
  }
};

// Please uncomment the lines below to test this on local
/*
const callback = (x) => {
  console.log(util.inspect(x));
};

exports.handler(
  {
    body: JSON.stringify({
      event: 'create_project_media',
      team: {
        dbid: 1285,
        slug: 'caio-bot-garden'
      },
      data: {
        id: "UHJvamVjdE1lZGlhLzI3NjU3\n",
        dbid: 27657,
        project_id: 2000,
        media: {
          quote: 'This is simply a test'
        }
      }
    })
  },
  null,
  callback
);
*/
