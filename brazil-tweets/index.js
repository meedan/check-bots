const config = require('./config.js'),
      Lokka = require('lokka').Lokka,
      util = require('util'),
      Transport = require('lokka-transport-http').Transport;
      
const replyToCheck = async (pmid, team_slug, text, callback) => {
  console.log('pmid', pmid);
  console.log('team_slug', team_slug);
  console.log('replyToCheck:', text);
  const vars = {
    text,
    pmid,
    clientMutationId: 'brazil-politics-bot' + parseInt(new Date().getTime(), 10),
  };

  const mutationQuery = `($text: String!, $pmid: String!, $clientMutationId: String!) {
    createComment: createComment(input: { clientMutationId: $clientMutationId, text: $text, annotated_id: $pmid, annotated_type: "ProjectMedia"}) {
      comment {
        text
      }
    }
  }`;

  const headers = { 'X-Check-Token': config.checkApiAccessToken };
  const transport = new Transport(config.qa.checkApiUrl + '/api/graphql?team=' + team_slug, { headers, credentials: false, timeout: 120000 }); //TODO LIVE
  const client = new Lokka({ transport });

  console.log('Sending mutation with vars: ' + JSON.stringify(vars));
  //const resp = await client.mutate(mutationQuery, vars);
  //console.log('resp', resp);
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

const twitterid2href = function(s) {
  s=s.split(":");
  return `https://twitter.com/${s[1]}/statuses/${s[2]}`;
};

exports.handler = (event, context, callback) => {
  const data = JSON.parse(event.body);
  console.log('JSON.parse(event.body)', data);
  if (data.event === 'create_project_media') {
    const pmid = data.data.dbid.toString();
    const type = data.data.type;
    if(type=="Claim" || type=="Link" || type=="Blank"){ //TODO: Decide whether to include imported reports ("Blank")
      const title = data.data.title.toString();

      const http = require('http');
  
      var postData = JSON.stringify({
          'query' : title
      });
      
      var options = {
        hostname: config.searchapiurl,
        path: '/query',
        method: 'POST'
      };
      
      var req = http.request(options, (res) => {
        res.setEncoding('utf8');
        let responseBody = '';
      
        res.on('data', (chunk) => {
            responseBody += chunk;
        });
      
        res.on('end', () => {
          console.log(responseBody);
          const json_obj = JSON.parse(responseBody);
          //const text=responseBody;
          //console.log(json_obj);
          //let text = `Found ${json_obj["hits"]["total"]["value"]} related tweets on Twitter. The top three are\n`;
          let text = `The closest related tweets on Twitter are\n`;
          for (let i=0; i<Math.min(3,json_obj["hits"]["hits"].length); i++) {
            text+=`${i+1}. ${json_obj["hits"]["hits"][i]["_source"]["text"].trim()}. (${Math.round(json_obj["hits"]["hits"][i]["_score"]*100)/100.0}) ${twitterid2href(json_obj["hits"]["hits"][i]["_id"])}\n`;
          }
          console.log(text);
          //if (json_obj['is_politics'] == "1"){
          replyToCheck(pmid, data.team.slug, text, callback);
          //}
        });
      });
      
      req.on('error', (e) => {
        console.error(e);
      });
      
      req.write(postData);
      req.end();
    }
   
  } 
  else {
    callback(null);
  }
};


