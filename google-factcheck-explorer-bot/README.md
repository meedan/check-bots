# Google factcheck explorer bot

Shows Notes with Claim Review content that has been imported from https://toolbox.google.com/factcheck/explorer that is simlar to the Project Media item.

# Overview

NOTE: These instructions include references to documentation and AWS infrastructure that are not
visable outside the Meedan organization. Please contact us if you need information about any of 
these resources to install this code on your own system.

## Background data
For items to become availible to be displayed by the bot
* ClaimReivew objects are parsed daily by Fetch plugin `fetch/lib/claim_review_parsers/google_fact_check.rb`
    - TODO: replace this with more efficient ingest process, perhaps based on the code in `/ingest` (this code is currently not used)
* The google-fact-check-tools workspace https://checkmedia.org/google-fact-check-tools/project/15547 listens for 
new ClaimReviews and stored in Check under its team id.   
* The items in the workspace are availible for similarity queries via Check API, with access permission determined by API key. 
* NOTE: usually items in the project need to be in the 'published' state to be availible for similarity matching. It may be necessary to toggle them using a script like https://github.com/meedan/check-scripts/blob/main/publish_imported_reports.rb

## Bot operation
When this bot is configured in a workspace
* The bot listens on a webhook for new ProjectMedia creation events for a team, configured as per internal wiki page `How to configure a webhook for a Check Bot`
```
    bot_user = BotUser.where(name: "Google fact check workspace API Client")[0]
    bot_user.set_request_url = "<bot api gatway url>"
    bot_user.set_events = [{"event"=>"create_project_media", "graphql"=>"dbid, title, description, type"}]
    bot_user.save!
```
* The text from the PM is similarity compared with the availible set of ClaimReview items via Check API in a query 
managed by an AWS Lambda function defined in `/google-factcheck-explorer-bot-lambda`
* Any resulting ClaimReview links are written back as 'comments' on the ProjectMedia items in the workspace to be displayed as Notes the sidebar
* An appropriately configured API key is needed to give bot permissions to write to the workspace. This is done by mapping the BotUser to the team. Internal wiki page `How to create an API key for a Check workspace`

# Bot testing setup
## Testing the background side
* Setup a workspace in QA to host the content (will this work or need to do locally)
* Configure an api key with premissions to access the workspace via a `BotUser`. Internal wiki page `How to create an API key for a Check workspace`
* Import the google claim review content from Fetch. Internal wiki page `How to re- import content from Fetch into a Check workspace`
* Confirm that the feed can be queried:
```
curl -X GET -H "Accept: application/vnd.api+json" -H "X-Check-Token: <API_KEY_GOES_HERE>" "https://qa-check-api.checkmedia.org/api/v2/feeds?filter\[query\]=test"
```
which should give a response like
```
{"data":[{"id":"20007","type":"feeds","links":{"self":"https://qa-check-api.checkmedia.org/api/v2/feeds/20007"},"attributes":{"claim":"-","claim-context":null,"claim-tags":"","fact-check-title":"Viral Test: Big B, Madhuri Dixit campaigning For Imran Khan?","fact-check-summary":"Pakistan's PTI party is using Amitabh Bachchan and Madhuri Dixit photos on their campaign posters","fact-check-published-on":1679572669,"fact-check-rating":"undetermined","published-article-url":"https://www.indiatoday.in/fact-check/story/viral-test-big-b-madhuri-dixit-campaigning-for-imran-khan-1294131-2018-07-24","organization":"Google fact check tools"}},{"id":"19384","type":"feeds","links":{"self":"https://qa-check-api.checkmedia.org/api/v2/feeds/19384"},"attributes":{"claim":"-","claim-context":null,"claim-tags":"","fact-check-title":"The Legend of the 'Pencil Death' Exam Suicide","fact-check-summary":"A student, stressed to the breaking point by the pressures of exams, committed suicide during a test by shoving pencils up his nostrils and into his brain.","fact-check-published-on":1679571320,"fact-check-rating":"undetermined","published-article-url":"https://www.snopes.com/fact-check/pencil-death/","organization":"Google fact check tools"}},{"id":"19302","type":"feeds","links":{"self":"https://qa-check-api.checkmedia.org/api/v2/feeds/19302"},"attributes":{"claim":"-","claim-context":null,"claim-tags":"","fact-check-title":"FACT CHECK: Poppy Seeds Alter Drug Test Results?","fact-check-summary":"The consumption of poppy seeds used on bagels and muffins can produce positive results on drug screening tests.","fact-check-published-on":1679571142,"fact-check-rating":"undetermined","published-article-url":"https://www.snopes.com/fact-check/poppy-seeds-alter-drug-test-results/","organization":"Google fact check tools"}}],"meta":{"record-count":3}}%       
```

## Deploying the AWS lambda
This internal wiki page gives instructions for deploying a related bot: `How to deploy Check Slack Bot`
General AWS docs on how to deploy lambdas: https://docs.aws.amazon.com/lambda/latest/dg/lambda-deploy-functions.html
* If this is a release, bump the version number in `package.json`
* rename `config.js.example` to `config.js` (config.js is git ignored to avoid secrets)
*  Run `npm install` to install all the required libraries locally so they will get packaged up by the build for deployment.
* `npm run build` this runs toplevel build script in `package.json` and creates a `google-factcheck-explorer-bot-lambda.zip` file with the bot script, and all of the requirements

* For the first deployment create a Lambda via the AWS web console similar to https://eu-west-1.console.aws.amazon.com/lambda/home?region=eu-west-1#/functions/qa-google-factcheck-explorer-bot
* TODO: terraform aws lambda? https://registry.terraform.io/modules/terraform-aws-modules/lambda/aws/latest
* The Lambda needs the API Gateway Trigger setup so that there is an external http endpoint that can be called. 
* The endpoint url from the trigger needs to be set as the '`<webhook>`' when setting the bot configuration as per instructions on internal wiki `How to configure a webhook for a Check Bot`
* Lambda timeout can be increased to 3 minutes on the configuration tab
* Update environment (live/QA) appropriate secrets and config in Lambda's Configuration > Environment Variables section
   * `CHECK_API_GOOGLE_FACT_CHECK_ACCESS_TOKEN`  <-- this needs the key to the GoogleFactCheck feed workspace
   * `CHECK_API_WORKSPACE_ACCESS_TOKEN` <-- this needs to authorize anotations on a team's ProjectMedia
   * `CHECK_API_URL` <-- Usually `qa-check-api.checkmedia.org` or `check-api.checkmedia.org`
* To deploy, start an `aws cli` session and deploy local files to the lambda location (best for quickly redeploys during development)
  * `aws lambda update-function-code --function-name qa-google-factcheck-explorer-bot --zip-file fileb://google-factcheck-explorer-bot-lambda.zip`
* For 'real' deployments, we want to keep an archive of the deployed code, so best to deploy via  https://s3.console.aws.amazon.com/s3/buckets/meedan-check-bot-deployments?region=eu-west-1&tab=objects  and use the 'upload from S3 location' option in AWS Lambda console ui
* The Lambda can be tested in the AWS web console by firing an appropriately formatted  'test' event in the web console (Note that the team slug will need to correspond to the team hosting the project media and data dbid will be project media id)
  * ```
    {
        "body": "{\"event\": \"create_project_media\", \"team\": {\"dbid\": 1506991, \"id\": \"abcdefg\", \"avatar\": \"https://assets.checkmedia.org/uploads/team/6503/Group_89.png\", \"name\": \"Check testing\", \"slug\": \"check-testing\"}, \"data\": {\"type\": \"Claim\", \"dbid\": 19205, \"title\": \"Is it true Pakistan's PTI party is using Amitabh Bachchan and Madhuri Dixit photos on their campaign posters?\", \"description\": \"Charles III come\\u00e7a reinado em busca de monarquia simplificada e papel pol\\u00edtico mais ativo\"}}"
    }
    ```

* The bot needs to be authorized to write to the project media of the target team by being added as TeamBotInstalation.
* The event structure sent by the webhook needs to match what the bot is expecting to parse out of the JSON payload, ie 
  * `bot_user.set_events = [{"event"=>"create_project_media", "graphql"=>"dbid, title, description, type"}]`
* Logs from event hook will appear in CloudWatch, with a few minutes delay


## testing the bot side locally
I NEVER GOT THIS FULLY WORKING, WAS JUST TESTING IN QA
* Copy `config.js.example` to `config.js` and define your local configurations with `checkApiUrl: http://localhost:3000`.
* TODO: can the local point to QA to host the items?
* Start Check web and bots containers locally `docker-compose -f docker-compose.yml up bots web`
    * configure a workspace to *install* the bots for testing by logging into check-web at `localhost:3333`
    *  https://meedan.atlassian.net/wiki/spaces/ENG/pages/1126268929/How+to+configure+a+webhook+for+a+Check+Bot 
* The `check-bots` container should start `server.js` on port `8586`
* On the Check side, the bot request URL should be set to `http://bots:8586/<bot-slug>` ('exif', 'youtube' or 'health-desk').