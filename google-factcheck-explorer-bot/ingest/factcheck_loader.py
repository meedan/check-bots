

"""
Script to process factcheck document objects downloaded in bulk from Google Fact Check explorer 
https://storage.googleapis.com/datacommons-feeds/factcheck/latest/data.json

Docs with json structure definitions:
https://developers.google.com/search/docs/appearance/structured-data/factcheck

TODO: process logging and alerting?
TODO: local/qa/live
"""


class GoogleFactcheckLoader:

    GOOGLE_FACT_CHECK_URL = 'https://storage.googleapis.com/datacommons-feeds/factcheck/latest/data.json'
    ALEGRE_CONTEXT = {"bot":"google-factcheck-explorer"}
    ALEGRE_MODELS = ['elasticsearch','xlm-r-bert-base-nli-stsb-mean-tokens']

    def download_latest_factchecks():
        """
        Downloads the latest fact check data dump json (80+MB) and saves locally with today's date
        TODO: cache in AWS S3 instead of local file system
        TODO: retry in case of connection flakyness
        """

    def read_factchecks_since(file_path, start_date):
        """
        Scan through file looking for items with newer creation date and return them 
        """
        return []

    def insert_into_alegre(fact_checks):
        """
        Loop over the list of fact checks and try to load them into Alegre via the API
        TODO: how do we auth to the API?
        """
        print('Attempting to load fact checks to alegre')


    def processes_batch(file_path, start_date):
        """
        Extract the fact check documents more recent than start date and insert them into Alegre for matching

        - If file_path is not included, a fresh copy will be downloaded
        - returns datestamp of most recent item 
        TODO: where do we maintain state? (date of most recent item to use as input for next run)
        TODO: what to do with errors?
        """


if __name__ == '__main__':
    """
    TODO: handle CLI args
    """