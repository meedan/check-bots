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

### 3. Health Desk Bot

* Listens to event `create_project_media` events and looks up similar content in Health Desk articles indexed in Alegre.

See details in `./health-desk-bot/README.md`

## Usage (Deploying to AWS)

* Copy `config.js.example` to `config.js` and define your configurations
* Run `npm install` to install the dependencies on your first run or if you change dependencies.
* Run `npm run build`
* Create an AWS Lambda function with an API gateway and upload the ZIP file from the previous step
* Define the correct handler (e.g., `youtube.handler` or `exif.handler`)
* Copy the API gateway URL as the Request URL of the Check API bot

## Local usage

* Copy `config.js.example` to `config.js` and define your local configurations with `checkApiUrl: http://localhost:3000`.
* Start Check locally `docker-compose -f docker-compose.yml up bots`
* The `check-bots` container should start `server.js` on port `8586`
* On the Check side, the bot request URL should be set to `http://bots:8586/<bot-slug>` ('exif', 'youtube' or 'health-desk').
