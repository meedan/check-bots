from google.cloud import vision
import os
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = "credentials.json"
def lambda_handler(event, context):
    client = vision.ImageAnnotatorClient()
    print(client)
