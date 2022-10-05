# Health Desk Bot

This bot listens for new item creation events and it looks up similar content in Health Desk articles indexed in Alegre.
The functionality is split across two different lambda functions.

`health-desk-bot-lambda`, receives the events from Check-API and starts the lookup jobs by the second lambda `health-desk-bot-lambda-bg` which will respond with a note to the Check item if the content matches a Health Desk article.

## Usage

The Health Desk Bot depends on having the Health Desk articles indexed in Alegre.
This first step ensures this prerequisite.

### 1. Indexing Health Desk content from CSV file in Alegre

* Copy `config.js.example` to `config.js` and define your configurations
* Run `node ingest-csv.js <csv-file>`

### 2. Usage (Deploying to AWS)

For the first lambda `health-desk-bot-lambda`:

* Copy `config.js.example` to `config.js` and define your configurations
* Run `npm run build`
* Create an AWS Lambda function with an API gateway and upload the ZIP file from the previous step
* Copy the API gateway URL as the Request URL of the Check API bot

For the second lambda `health-desk-bot-lambda-bg`:

* Copy `config.js.example` to `config.js` and define your configurations
* Run `npm run build`
* Create an AWS Lambda function - no API gateway required - and upload the ZIP file from the previous step
* It's important to add this lambda to the right VPC in AWS so it can access Alegre

## Local usage

* Copy `config.js.example` to `config.js` and define your local configurations with `checkApiUrl: http://localhost:3000`.
* Start Check locally
* The `check-bots` container should start `server.js` on port `8586`
* On the Check side, the bot request URL should be set to `http://bots:8586/health-desk`
