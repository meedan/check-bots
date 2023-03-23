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

