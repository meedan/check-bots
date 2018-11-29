# Check API Bots

A collection of bots that can be connected to [Check API](https://github.com/meedan/check-api). They were implemented to work as AWS Lambda functions.

## Bots

We currently have three bots here.

### 1. YouTube Data Bot

This bot is at `youtube.js`. It listens to the `create_project_media` event and, if it's a YouTube URL, it does the following:

* Extracts thumbnails and runs reverse image search over each of them
* Extracts upload date and creation data
* Extracts geographic information

All those results are sent to Check as annotations.

### 2. EXIF Bot

This bot is at `exif.js`. It listens to the `create_project_media` event and, if it's an uploaded media, it extracts EXIF data and
posts to Check as an annotation, with a link for the full report.

### 3. Similarity Bot

This bot is at `claim-similarity.js`. It listens to the the `create_project_media` event and, if it's a claim, it stores in Alegre's similarity index and related to another existing claim on Check if they are similar.

## Usage

* Copy `config.js.example` to `config.js` and define your configurations
* Run `npm run build`
* Create an AWS Lambda function with an API gateway and upload the ZIP file from the previous step
* Define the correct handler (e.g., `youtube.handler` or `exif.handler`)
* Copy the API gateway URL as the Request URL of the Check API bot
