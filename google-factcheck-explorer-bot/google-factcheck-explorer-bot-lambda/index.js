const config = require('./config.js'), 
        Lokka = require('lokka').Lokka,
        util = require('util'),
        Transport = require('lokka-transport-http').Transport;
const aws = require('aws-sdk');

// This is the 'callback' via GraphQL API to tell Check to show the included text as a comment, 
// associted with the project media id
const replyToCheck = async (pmid, team_slug, text, callback) => {
    console.log('pmid', pmid);
    console.log('team_slug', team_slug);
    console.log('replyToCheck:', text);
    const vars = {
      text,
      pmid,
      clientMutationId: 'goolge-factcheck-bot' + parseInt(new Date().getTime(), 10),
    };
  
    const mutationQuery = `($text: String!, $pmid: String!, $clientMutationId: String!) {
      createComment: createComment(input: { clientMutationId: $clientMutationId, text: $text, annotated_id: $pmid, annotated_type: "ProjectMedia"}) {
        comment {
          text
        }
      }
    }`;


    const headers = { 'X-Check-Token': config.checkApiAccessToken };
    // TODO: live/qa switch?
    const transport = new Transport(config.live.checkApiUrl + '/api/graphql?team=' + team_slug, { headers, credentials: false, timeout: 120000 }); //TODO LIVE
    const client = new Lokka({ transport });

    console.log('Sending Project Media comment mutation with vars: ' + JSON.stringify(vars));
    //const resp = await client.mutate(mutationQuery, vars);
    //console.log('resp', resp);
    client.mutate(mutationQuery, vars)
    .then(function(resp, err) {
        console.log('Response: ' + util.inspect(resp));
        callback(null);
    })
    .catch(function(e) {
        console.log('Error when executing Project Media comment mutation: ' + util.inspect(e));
        callback(null);
    });
};

// This is the event handleri, to be triggered on each new Project Media creation
// it will call a search in Alegre to look for similar ClaimReview items in the 
// GoogleFactCheck feed. 
exports.handler = (event, context, callback) => {
    const data = JSON.parse(event.body);
    const feed_id = config.googleFactCheckFeedId // this will be different in live vs QA
    const api_key = config.checkApiAccessToken
    console.log('JSON.parse(event.body)', data);
    if (data.event === 'create_project_media') {
      const pmid = data.data.dbid.toString();
      const type = data.data.type;
      //TODO: Decide whether to include imported reports ("Blank")
      if(type=="Claim" || type=="Link" || type=="Blank"){ 
        const title = data.data.title.toString();
        const description = data.data.description.toString();
        //TODO: if desription is different than the title, make a second request
        const http = require('https');
  
        var options = {
          hostname: config.searchapiurl,
          path: `/api/v2/feeds?filter\[feed_id\]=${feed_id}&filter\[query\]=${encodeURIComponent(title)}`,
          headers: {
              Accept: 'application/vnd.api+json',
              'X-Check-Token': `${api_key}`, // This API key has access to Check workspace with googleFactCheck items
            },
          method: 'GET'  // post not configurd
        };
        console.log(options)

        //TODO: check if the length is appropriate for GET, or figure out how to get cloudflare to let the POST in
        
        var req = http.request(options, (res) => {
          res.setEncoding('utf8');
          let responseBody = '';
        
          res.on('data', (chunk) => {
              responseBody += chunk;
          });
        
          res.on('end', () => {
            console.log('request status',res.statusCode)
            // TODO: if the request status is an error code, lets error out here?
            console.log('response body:',responseBody);
            const json_obj = JSON.parse(responseBody);
            let text = `The closest related ClaimReviews are\n`;
            for (let i=0; i<Math.min(3,json_obj["hits"]["hits"].length); i++) {
                // TODO: get the google claim url out of the response, not twitter
              text+=`${i+1}. ${json_obj["hits"]["hits"][i]["_source"]["text"].trim()}. (${Math.round(json_obj["hits"]["hits"][i]["_score"]*100)/100.0}) ${twitterid2href(json_obj["hits"]["hits"][i]["_id"])}\n`;
            }
            console.log(text);
            // make a call back to Check with the text to be used a comments on the PM item
            replyToCheck(pmid, data.team.slug, text, callback);
          });
        });
        
        req.on('error', (e) => {
          console.error(e);
        });
        
        //req.write(postData);
        req.end();
      }
     
    } 
    else {
      callback(null);
    }
  };
  