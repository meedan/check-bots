import requests
from google.cloud import vision
import io
import urllib
import os

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = "credentials.json"

def detect_web(content):
    """Detects web annotations given an image."""
    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=content)
    response = client.web_detection(image=image)
    annotations = response.web_detection
    best_guess_label = ""
    to_display = ""

    if annotations.best_guess_labels:
       for label in annotations.best_guess_labels:
           to_display = to_display + '\\\\nBest guess label {}'.format(label.label) + '\\\\n'
           best_guess_label = label.label

    if annotations.pages_with_matching_images:
       to_display = to_display + '\\\\n{} Pages with matching images found'.format(
           len(annotations.pages_with_matching_images)) + '\\\\n'

       for page in annotations.pages_with_matching_images:
           to_display = to_display + '\\\\n\\\\tPage url    {}'.format(page.url) + '\\\\n'

           if page.full_matching_images:
               to_display = to_display + '\\\\t{} Full Matches found '.format(
                       len(page.full_matching_images)) + '\\\\n'

               for image in page.full_matching_images:
                   to_display = to_display + '\\\\t\\\\tImage url   {}'.format(image.url) + '\\\\n'

           if page.partial_matching_images:
               to_display = to_display + '\\\\t{} Partial Matches found '.format(
                       len(page.partial_matching_images)) + '\\\\n'

               for image in page.partial_matching_images:
                   to_display = to_display + '\\\\t\\\\tImage url   {}'.format(image.url) + '\\\\n'

    if annotations.web_entities:
       to_display = to_display + '\\\\n{} Web entities found '.format(
           len(annotations.web_entities)) + '\\\\n'

       for entity in annotations.web_entities:
           to_display = to_display + '\\\\n\\\\tScore       {}'.format(entity.score) + '\\\\n'
           to_display = to_display + u'\\\\tDescription {}'.format(entity.description) + '\\\\n'

    if annotations.visually_similar_images:
       to_display = to_display +'\\\\n{} visually similar images found\\\\n'.format(
           len(annotations.visually_similar_images)) + '\\\\n'

       for image in annotations.visually_similar_images:
           to_display = to_display +'\\\\tImage url     {}'.format(image.url) + '\\\\n'

    if response.error.message:
      raise Exception(
          '{}\\\\\\\\nFor more info on error messages, check: '
          'https://cloud.google.com/apis/design/errors'.format(
              response.error.message))
    return to_display


def lambda_handler(event, context):
    image_url = event['queryStringParameters']['image_url']
    print("image_url")
    print(image_url)
    img_data = requests.get(image_url).content
    res = detect_web(img_data)
    print(res)
    return res
