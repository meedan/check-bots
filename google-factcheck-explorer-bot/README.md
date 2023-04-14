# Google factcheck explorer bot

Shows Notes with Claim Review content that has been imported from https://toolbox.google.com/factcheck/explorer that is simlar to the Project Media item.

# Overview

## Background data
For items to become availible to be displayed by the bot
* ClaimReivew objects are parsed daily by Fetch plugin `fetch/lib/claim_review_parsers/google_fact_check.rb`
    - TODO: replace this with more efficient ingest process, perhaps based on the code in `/ingest`
* the google-fact-check-tools workspace https://checkmedia.org/google-fact-check-tools/project/15547 listens for 
new ClaimReviews and stored in Check under its team id.  
* google-fact-check-tools also publishes the content to a "shared feed'
* the items on the shared feed are availible for similarity queries via Check API

## Bot operation
When this bot is configured in a workspace
* the bot listens on a webhook for new ProjectMedia creation events `/google-factcheck-explorer-bot`
* the text from the PM is similarity compared with the availible set of ClaimReview items via Check API in a query 
managed by an AWS Lambda function defined in `/google-factcheck-explorer-bot-lambda`
* any resulting items are displayed

# Bot testing setup
## testing the background side
* Setup a workspace in QA to host the content (will this work or need to do locally)
* Configure a shared feed for it and an api key https://meedan.atlassian.net/wiki/spaces/ENG/pages/1126105091
* Import the google claim review content from Fetch https://meedan.atlassian.net/wiki/spaces/ENG/pages/1163821066/How+to+re-+import+content+from+Fetch+into+a+Check+workspace
* Confirm that the feed can be queried:
```
curl -X GET -H "Accept: application/vnd.api+json" -H "X-Check-Token: <API_KEY_GOES_HERE>" "https://qa-check-api.checkmedia.org/api/v2/feeds?filter\[feed_id\]=16&filter\[query\]=test"
```
which should give a response like
```
{"data":[{"id":"20007","type":"feeds","links":{"self":"https://qa-check-api.checkmedia.org/api/v2/feeds/20007"},"attributes":{"claim":"-","claim-context":null,"claim-tags":"","fact-check-title":"Viral Test: Big B, Madhuri Dixit campaigning For Imran Khan?","fact-check-summary":"Pakistan's PTI party is using Amitabh Bachchan and Madhuri Dixit photos on their campaign posters","fact-check-published-on":1679572669,"fact-check-rating":"undetermined","published-article-url":"https://www.indiatoday.in/fact-check/story/viral-test-big-b-madhuri-dixit-campaigning-for-imran-khan-1294131-2018-07-24","organization":"Google fact check tools"}},{"id":"19384","type":"feeds","links":{"self":"https://qa-check-api.checkmedia.org/api/v2/feeds/19384"},"attributes":{"claim":"-","claim-context":null,"claim-tags":"","fact-check-title":"The Legend of the 'Pencil Death' Exam Suicide","fact-check-summary":"A student, stressed to the breaking point by the pressures of exams, committed suicide during a test by shoving pencils up his nostrils and into his brain.","fact-check-published-on":1679571320,"fact-check-rating":"undetermined","published-article-url":"https://www.snopes.com/fact-check/pencil-death/","organization":"Google fact check tools"}},{"id":"19302","type":"feeds","links":{"self":"https://qa-check-api.checkmedia.org/api/v2/feeds/19302"},"attributes":{"claim":"-","claim-context":null,"claim-tags":"","fact-check-title":"FACT CHECK: Poppy Seeds Alter Drug Test Results?","fact-check-summary":"The consumption of poppy seeds used on bagels and muffins can produce positive results on drug screening tests.","fact-check-published-on":1679571142,"fact-check-rating":"undetermined","published-article-url":"https://www.snopes.com/fact-check/poppy-seeds-alter-drug-test-results/","organization":"Google fact check tools"}}],"meta":{"record-count":3}}%       
```

## deploying the AWS lambda
This give instructions for deploying a related bot https://meedan.atlassian.net/wiki/spaces/ENG/pages/1126531073/How+to+deploy+Check+Slack+Bot
how to deploy lambdas in general https://docs.aws.amazon.com/lambda/latest/dg/lambda-deploy-functions.html
* If this is a release, bump the version number in `package.json`
* update secrets in config JS (for QA or Live)
* also run `npm install` to install all the required libraries locally
* `npm run build` this runs toplevel build script in `package.json` and creates a `google-factcheck-explorer-bot-lambda.zip` file with all the bots in it, and all of their requirements TODO: can this be defined per bot

* rename the zip file with qa prefix
* upload to https://s3.console.aws.amazon.com/s3/buckets/meedan-check-bot?region=us-east-1&tab=objects  
* `aws lambda update-function-code --function-name qa-google-factcheck-explorer-bot --zip-file fileb://qa_google-factcheck-explorer-bot-lambda.zip`
* https://docs.aws.amazon.com/lambda/latest/dg/nodejs-package.html
* https://eu-west-1.console.aws.amazon.com/lambda/home?region=eu-west-1#/functions/qa-google-factcheck-explorer-bot



## testing the bot side
* Copy `config.js.example` to `config.js` and define your local configurations with `checkApiUrl: http://localhost:3000`.
* TODO: can the local point to QA to host the items?
* Start Check web and bots containers locally `docker-compose -f docker-compose.yml up bots web`
    * configure a workspace to *install* the bots for testing by logging into check-web at `localhost:3333`
    *  https://meedan.atlassian.net/wiki/spaces/ENG/pages/1126268929/How+to+configure+a+webhook+for+a+Check+Bot 
* The `check-bots` container should start `server.js` on port `8586`
* On the Check side, the bot request URL should be set to `http://bots:8586/<bot-slug>` ('exif', 'youtube' or 'health-desk').