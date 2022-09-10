# Check Bots

A collection of bots that can be connected to [Check API](https://github.com/meedan/check-api). They are implemented as AWS Lambda functions.

## Bots

### 1. YouTube Data Bot

This bot is at `youtube.js`. It listens to the `create_project_media` event and, if it's a YouTube URL, it does the following:

* Extracts thumbnails and runs reverse image search over each of them
* Extracts upload date and creation data
* Extracts geographic information

All those results are sent to Check as annotations.

### 2. EXIF Bot

This bot is at `exif.js`. It does the following:

* Listens to the `create_project_media` event. If it's an uploaded image, it extracts EXIF data and posts it to Check as a comment, with a link for the full report.
* Listens to the `create_annotation_task_geolocation` and `update_annotation_task_geolocation`. If it's an uploaded image, it extracts GPS data, geocodes it and posts the result as a task response to any **unanswered** geolocation task.

## Usage

* Copy `config.js.example` to `config.js` and define your configurations
* Run `npm install` to install the dependencies on your first run or if you change dependencies.
* Run `npm run build`
* Create an AWS Lambda function with an API gateway and upload the ZIP file from the previous step
* Define the correct handler (e.g., `youtube.handler` or `exif.handler`)
* Copy the API gateway URL as the Request URL of the Check API bot

## Local usage

* Copy `config.js.example` to `config.js` and define your local configurations with `checkApiUrl: http://localhost:3000`.
* Run `npm run exif` or `npm run youtube` to spin up a local server for either bot - note the port number.
* Start Check locally
* Find out the local host IP from the Check container as per https://stackoverflow.com/a/33103501
* On the Check side, the bot request URL is the IP above with the port obtained when starting the bot.
