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

      lambda
        .invoke({ FunctionName: 'health-desk-bot-background', InvocationType: 'RequestResponse', Payload: payload })
        .on('success', function(response) { console.log("Success:", response.data); callback(null); })
        .on('error', function(error, response) { console.log("Error:", error); console.log("response:", response); })
        .send();
    } else {
      callback(null);
    }
  } else {
    callback(null);
  }
};
