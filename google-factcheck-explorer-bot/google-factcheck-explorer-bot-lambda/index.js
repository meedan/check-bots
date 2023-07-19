const config = require('./config.js'), 
        Lokka = require('lokka').Lokka,
        util = require('util'),
        Transport = require('lokka-transport-http').Transport;
const aws = require('aws-sdk');


const getConfigFromEnvWithFallback = (env_key, fallback_value=None) => {
  // get secrets from local env, falling back to config
  if (env_key in process.env) {
    value = process.env[env_key];
  } else {
    console.warn('Environment variable for ' + env_key + ' is not defined, using value from config');
    value = fallback_value;
  }
  return value;
};

// secret api token with permissions to access feed and write to bot target
const CHECK_API_GOOGLE_FACT_CHECK_ACCESS_TOKEN = getConfigFromEnvWithFallback('CHECK_API_GOOGLE_FACT_CHECK_ACCESS_TOKEN', config.checkApiAccessToken)

// url for check-api (live vs QA)
const CHECK_API_URL = getConfigFromEnvWithFallback('CHECK_API_URL', config.checkApiUrl)

// id of feed where claim reviews will be queried (this will be different in live vs QA)
const CHECK_API_WORKSPACE_ACCESS_TOKEN = getConfigFromEnvWithFallback('CHECK_API_WORKSPACE_ACCESS_TOKEN',config.checkApiWorkspaceAccessToken)


// This is the 'callback' via GraphQL API to tell Check to show the included text as a comment, 
// associted with the project media id for the specific team indicated by the team_slug.
// The bot must be authorized (via its api key amd TeamBotIntegration) to make edits to the 
// team's ProjectMedia
const replyToCheck = async (pmid, team_slug, text, callback) => {
    console.log('pmid', pmid);
    console.log('team_slug', team_slug);
    console.log('replyToCheck:', text);
    const vars = {
      text,
      pmid,
      clientMutationId: 'google-factcheck-bot' + parseInt(new Date().getTime(), 10),
    };
  
    const mutationQuery = `($text: String!, $pmid: String!, $clientMutationId: String!) {
      createComment: createComment(input: { clientMutationId: $clientMutationId, text: $text, annotated_id: $pmid, annotated_type: "ProjectMedia"}) {
        comment {
          text
        }
      }
    }`;

    // this access token needs permission to write into the project media of the workspace
    // where the bot is installed
    const headers = { 'X-Check-Token': CHECK_API_WORKSPACE_ACCESS_TOKEN };
    // NOTE: if API key lacks appropriate permissions, will probably see:
    // "Error when executing Project Media comment mutation: Error: GraphQL Error: No permission to create Comment"
    const transport = new Transport('https://' + CHECK_API_URL + '/api/graphql?team=' + team_slug, { headers, credentials: false, timeout: 120000 });
    console.log(transport)
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

// This is the event handler, to be triggered on each new Project Media creation
// it will call a search in Alegre to look for similar ClaimReview items in the 
// GoogleFactCheck feed defined in the config. 
exports.handler = (event, context, callback) => {
    const data = JSON.parse(event.body);
    console.log('JSON.parse(event.body)', data);
    if (data.event === 'create_project_media') {
      console.log('Google Fact Check bot processing project media creation event')
      // there could be an error paylod instead, but we let it fail to surface
      const pmid = data.data.dbid.toString();
      const type = data.data.type;
      //TODO: Decide whether to include imported reports ("Blank")
      if(type=="Claim" || type=="Link" || type=="Blank"){ 
        const title = data.data.title.toString();
        const description = data.data.description.toString();
        //TODO: if desription is different than the title, make a second request
        const http = require('https');
  
        var options = {
          hostname: CHECK_API_URL,
          path: `/api/v2/feeds?filter\[query\]=${encodeURIComponent(title)}`,
          headers: {
              Accept: 'application/vnd.api+json',
              'X-Check-Token': `${CHECK_API_GOOGLE_FACT_CHECK_ACCESS_TOKEN}`, // This API key has access to Check workspace with googleFactCheck items
            },
          method: 'GET'  // post not configurd
        };

        
        var req = http.request(options, (res) => {
          res.setEncoding('utf8');
          let responseBody = '';
        
          res.on('data', (chunk) => {
              responseBody += chunk;
          });
        
          res.on('end', () => {
            if (res.statusCode >= 400){
              console.error('Request error status',res.statusCode)
              console.log('Error response body:',responseBody);
            }
            console.log('response body:',responseBody);
            const json_obj = JSON.parse(responseBody);
            // check if anything matched {"data":[],"meta":{"record-count":0}}
            if (json_obj["meta"]["record-count"] > 0){
              // {"data":[{"id":"20007","type":"feeds","links":{"self":"https://qa-check-api.checkmedia.org/api/v2/feeds/20007"},
              // "attributes":{"claim":"-","claim-context":null,"claim-tags":"",
              // "fact-check-title":"Madhuri Dixit campaigning For Imran Khan?",
              // "fact-check-summary":"Pakistan's PTI party is using Amitabh Bachchan and Madhuri Dixit photos on their campaign posters",
              // "fact-check-published-on":1679572669,"fact-check-rating":"undetermined",
              // "published-article-url":"https://www.indiatoday.in/fact-check/story/viral-test-big-b-madhuri-dixit-campaigning-for-imran-khan-1294131-2018-07-24",
              // "organization":"Google fact check tools"}}],
              // "meta":{"record-count":1}}
              let text = `<h6>Closely releated ClaimReviews from Google Factcheck Tools:</h6>\n`;
              text = text + "<ul>"
              for (let i=0; i<Math.min(3,json_obj["meta"]["record-count"]); i++) {
                // extract items from claim and format text to display as comment
                claim_title = json_obj["data"][i]["attributes"]["fact-check-title"].trim()
                source_url = json_obj["data"][i]["attributes"]["published-article-url"]
                text+=`<li> ${claim_title}. ${source_url}</li>\n`;
              }
              text += "</ul>"
              // make a call back to Check with the text to be used a comments on the PM item
              replyToCheck(pmid, data.team.slug, text, callback);
            } else {
              console.log('no matching ClaimReviews returned')
            }
          });
        });
        
        req.on('error', (e) => {
          console.error(e);
          // surface connection errors as exceptions
          throw e;
        });

        req.end();
      }
     
    } 
    else {
      callback(null);
    }
  };
  