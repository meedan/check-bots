# -*- coding: utf-8 -*-

import argparse
import json
import logging
import requests
from datetime import datetime, timezone
import tempfile

logging.basicConfig(level=logging.INFO)

class GoogleFactcheckLoader(object):

    def __init__(self, env) -> None:
        # TODO: need to toggle Alegre config based local/qa/live
        # TODO: just pull config from environment variables?
        assert env == 'localdev'

    GOOGLE_FACT_CHECK_FEED_URL = 'https://storage.googleapis.com/datacommons-feeds/factcheck/latest/data.json'
    ALEGRE_CONTEXT = {"bot":"google-factcheck-explorer"}
    ALEGRE_MODELS = ['elasticsearch','xlm-r-bert-base-nli-stsb-mean-tokens']
    ALEGRE_ENDPOINT = 'http://localhost:3100/text/similarity/' # localdev

    def download_latest_factchecks(self):
        """
        Downloads the latest fact check data dump json (80+MB) and saves locally with today's date
        TODO: cache in AWS S3 instead of local file system
        TODO: retry in case of connection flakyness
        """
        logging.info('Downloading latest factcheck file from {}'.format(self.GOOGLE_FACT_CHECK_FEED_URL))
        date_suffix = datetime.now().strftime("%Y%m%d")
        file_path = tempfile.gettempdir()+'factcheck_data_'+date_suffix+'.json'
        with requests.get(self.GOOGLE_FACT_CHECK_FEED_URL, stream=True) as r:
            r.raise_for_status()
            with open(file_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192): # default chunk size from stack overflow
                    f.write(chunk)
        return file_path

    def read_factchecks_since(self, file_path, start_date: datetime):
        """
        Scan through file looking for items with newer creation date and return them 
        "dateCreated" : "2023-01-26T06:12:47.988977+00:00",
        """
        logging.info("Reading factcheck feed json from {} into memory".format(file_path))
        # TODO: this won't work when the file gets too big for memory, may need to restructure to json lines first
        data_feed = []
        with open(file=file_path) as json_file:
            raw_json = json.load(fp=json_file)
            dateModified = raw_json['dateModified']
            data_feed = raw_json['dataFeedElement']
            logging.info('Feed modification date:'+dateModified)
            logging.info('Number of feed items:{}'.format(len(data_feed)))

        if len(data_feed) <1:
            logging.warning("No items were found in feed file")
            return data_feed

        filtered_feed = self.filter_feed_items(data_feed, start_date)
        logging.info("Found {} claim reviews that meet filter time range".format(len(filtered_feed)))
        return filtered_feed

    def filter_feed_items(self, feed_items, start_date: datetime):
        """
        Loop over the the feed items
        https://schema.org/ClaimReview
        Example:
        ```
         {
            "@type" : "DataFeedItem",
            "dateCreated" : "2023-01-26T06:12:47.988977+00:00",
            "item" : 
            [
                {
                "@context" : "http://schema.org",
                "@type" : "ClaimReview",
                "author" : 
                {
                    "@type" : "Organization",
                    "name" : "FACTLY",
                    "url" : "https://factly.in/"
                },
                "claimReviewed" : "జమ్మూ కాశ్మీర్‌లో తిరిగి ఆర్టికల్ 370ని పునరుద్ధరిస్తాం – జమ్మూ సభలో రాహుల్ గాంధీ",
                "datePublished" : "2023-01-25",
                "itemReviewed" : 
                {
                    "@type" : "Claim",
                    "appearance" : 
                    [
                    {
                        "@type" : "CreativeWork",
                        "url" : "https://www.facebook.com/photo?fbid=2720358358094191&set=a.279021575561227"
                    }
                    ],
                    "author" : 
                    {
                    "@type" : "Person",
                    "name" : "SOCIAL MEDIA POST"
                    },
                    "datePublished" : "2023-01-25"
                },
                "reviewRating" : 
                {
                    "@type" : "Rating",
                    "alternateName" : "MISLEADING",
                    "bestRating" : "5",
                    "image" : "https://factly.in/wp-content/uploads//2018/12/Misleading.png",
                    "ratingExplanation" : "భారత్ జోడో యాత్రలో భాగంగా జమ్మూలో జరిగిన బహిరంగ సభలో రాహుల్ గాంధీ మాట్లాడుతూ ‘జమ్మూకాశ్మీర్‌కు తిరిగి రాష్ట్ర హోదా కల్పిస్తామని, కాంగ్రెస్ పార్టీ ఇందుకు పూర్తి మద్దతిస్తుందని’ మాత్రమే అన్నాడు. రాహుల్ గాంధీ చేసిన వ్యాఖ్యలను తప్పుగా అర్ధం చేసుకొని ‘జమ్మూకాశ్మీర్‌లో తిరిగి ఆర్టికల్ 370ని పునరుద్దరిస్తాం’ అని రాహుల్ అన్నట్టు షేర్ చేస్తున్నారు. కాంగ్రెస్ వర్కింగ్ కమిటీ కూడా ఆర్టికల్ 370 రద్దుపై చేసిన తీర్మానంలో కూడా రద్దు చేసిన విధానాన్ని తప్పుబట్టిందే కాని, ఆర్టికల్ 370ను పునరుద్దరించాలని అనలేదు",
                    "ratingValue" : "2",
                    "worstRating" : "1"
                },
                "sdPublisher" : 
                {
                    "@type" : "Organization",
                    "name" : "Google Fact Check Tools",
                    "url" : "https://g.co/factchecktools"
                },
                "url" : "https://factly.in/telugu-rahul-gandhi-did-not-promise-to-revoke-article-370/"
                }
            ],
            "url" : "https://factly.in/telugu-rahul-gandhi-did-not-promise-to-revoke-article-370/"
            },
    ```
        """
        filtered_feed = []
        skipped = 0
        filtered_out = 0
        for item in feed_items:
            if item['@type'] != 'DataFeedItem' :
                logging.warning('skipped item that was not DataFeedItem')
                skipped += 1
                continue
            
            if 'dateModified' in item:
                use_date = item['dateModified']
            else:
                use_date = item['dateCreated']
            # parse datetime '2021-06-02T07:28:00.992872+00:00'
            claim_date = datetime.strptime(use_date,'%Y-%m-%dT%H:%M:%S.%f%z')

            # compare dates to filter
            # NOTE precision of times are assumed to be different
            if claim_date > start_date:
                if item['item'] is None:
                    logging.warning('skipped item that had no review:{}'.format(item))
                    skipped += 1
                    continue
                for claimReview in item['item']:
                    # NOTE we see more than one type of revew structure
                    assert claimReview['@type'] in ['ClaimReview', 'MediaReview']
                    # NOTE WE ARE UNNESTING IF THERE WERE MULTIPLE
                    filtered_feed.append(claimReview)
            else:
                filtered_out += 1
        if skipped > 0:
            logging.warning('Skipped {} malformed claims'.format(skipped))
        return filtered_feed


    def insert_into_alegre(self, claim_reviews):
        """
        Loop over the list of fact checks and try to load them into Alegre via the API
        TODO: which content should be included  (decided by Fetch API)
        TODO: do we need to normalize urls etc ala Pender
        TODO: any items that error should be returned to be logged
        TODO: log out ids of sucessfull inserts?
        """
        logging.info('Attempting to load fact checks to alegre')
        # pull credentials?
        # login to api? NOPE, running on same network 
            # check status

        for claim in claim_reviews:
            logging.info(claim)
            # extract relevant fields from claim
            # format paylod
            """ TODO: use similarity_request document model?
            similarity_request = api.model('similarity_request', {
                'text': fields.String(required=False, description='text to be stored or queried for similarity'),
                'doc_id': fields.String(required=False, description='text ID to constrain uniqueness'),
                'model': fields.String(required=False, description='similarity model to use: "elasticsearch" (pure Elasticsearch, default) or the key name of an active model'),
                'models': fields.List(required=False, description='similarity models to use: ["elasticsearch"] (pure Elasticsearch, default) or the key name of an active model', cls_or_instance=fields.String),
                'language': fields.String(required=False, description='language code for the analyzer to use during the similarity query (defaults to standard analyzer)'),
                'threshold': fields.Float(required=False, description='minimum score to consider, between 0.0 and 1.0 (defaults to 0.9)'),
                'context': JsonObject(required=False, description='context'),
                'fuzzy': fields.Boolean(required=False, description='whether or not to use fuzzy search on GET queries (only used when model is set to \'elasticsearch\')'),
            })
            """
            context = self.ALEGRE_CONTEXT
            model = self.ALEGRE_MODELS
            text = '' # TODO: url and all the content from claim concatenated as text
                      # look at check-api/app/models/bot/fetch.rb 
            doc_id = '' #MD5 hash of text?
            language = '' # do we have text language detection endpoint?  leave blank, eventually we want auto https://meedan.atlassian.net/browse/CV2-848
                          # meanwhile, make a seperate call to allegre to guess
            threshold = ''  # this should be very high, since we don't want other content to link to it?
            fuzzy = True

            # submit request to endpoint
            # createProjectMedia? createComment?

            # handle errors

        # logout of API



    def processes_batch(self, file_path, start_date: datetime.date):
        """
        Extract the fact check documents more recent than start date and insert them into Alegre for matching
        - If file_path is not included, a fresh copy will be downloaded
        - returns datestamp of most recent item 
        TODO: where do we maintain state? (date of most recent item to use as input for next run)
        TODO: what to do with errors?
        TODO: confirm what happens with duplicate insert (in case script run twice, or content actually came from ClaimReviews from one of our partners)
        """
        if file_path is None:
            file_path = self.download_latest_factchecks()
        claims_to_load = self.read_factchecks_since(file_path, start_date)
        if len(claims_to_load) < 1:
            logging.warning('No claims found matching filter time range')
            return
        results = self.insert_into_alegre(claims_to_load)
        logging.info('completed')
        

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="""
        Script to process factcheck document objects downloaded in bulk from Google Fact Check explorer 
        https://storage.googleapis.com/datacommons-feeds/factcheck/latest/data.json

        Docs with json structure definitions:
        https://developers.google.com/search/docs/appearance/structured-data/factcheck

        TODO: process logging and alerting?
        """
    )
    parser.add_argument(
        '-d',
        '--start_date',
        required=False,
        dest='start_date',
        help='required date threshold (YYYYMMDD) UTC before which items will be ignored ',
    )
    parser.add_argument(
        '-f',
        '--file',
        required=False,
        dest='file_path',
        help='Optional path to previously downloaded json file containing factchecks (if omitted will download from url)',
    )
    # TODO: add --dry-run
    args = parser.parse_args()
    logging.debug("Starting factcheck loading with args: {}".format(args))
    loader = GoogleFactcheckLoader(env='localdev')
    file_path = args.file_path
    # TODO: parse date
    start_date = args.start_date
    filter_date = datetime.strptime(start_date,'%Y%m%d').replace(tzinfo=timezone.utc)
    loader.processes_batch(file_path, start_date=filter_date)
    

