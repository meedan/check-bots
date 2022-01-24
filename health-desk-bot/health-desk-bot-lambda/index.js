const config = require('./config.js');
const aws = require('aws-sdk');

exports.handler = (event, context, callback) => {
  const data = JSON.parse(event.body);

  if (data.event === 'create_project_media') {
    const text = data.data.title;
    const pmid = data.data.dbid.toString();
    const slug = data.team.slug;

    if (text) {
      console.log('text', text);

      // Invoke Lambda function to get alegre matches and reply to check in background
      aws.config.loadFromPath('./aws.json');
      const lambda = new aws.Lambda({ region: config.awsRegion });
      const payload = JSON.stringify({ data: data });
      console.log('payload', payload);

      const lambdaRequest = lambda.invoke({ FunctionName: 'health-desk-bot-background', InvocationType: 'Event', Payload: payload });
      lambdaRequest.send();

      callback(null);
    } else {
      callback(null);
    }
  } else {
    callback(null);
  }
};
