# from flask import Flask
# from flask_ngrok import run_with_ngrok
# from flask import request
import requests
from google.cloud import vision
import io

# app = Flask(__name__)
# run_with_ngrok(app)
import os
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = "credentials.json"

# [START vision_web_detection]
def detect_web(content):
  """Detects web annotations given an image."""
  client = vision.ImageAnnotatorClient()

  image = vision.Image(content=content)

  response = client.web_detection(image=image)
  annotations = response.web_detection
  # full_
  best_guess_label = ""
  to_display = ""
  if annotations.best_guess_labels:
      for label in annotations.best_guess_labels:
          to_display = to_display + '\nBest guess label: {}'.format(label.label) + '\n'
          # print('\nBest guess label: {}'.format(label.label))
          best_guess_label = label.label

  if annotations.pages_with_matching_images:
      to_display = to_display + '\n{} Pages with matching images found:'.format(
          len(annotations.pages_with_matching_images)) + '\n'
      # print('\n{} Pages with matching images found:'.format(
      #     len(annotations.pages_with_matching_images)))

      for page in annotations.pages_with_matching_images:
          to_display = to_display + '\n\tPage url   : {}'.format(page.url) + '\n'
          # print('\n\tPage url   : {}'.format(page.url))

          if page.full_matching_images:
              # print('\t{} Full Matches found: '.format(
              #         len(page.full_matching_images)))
              to_display = to_display + '\t{} Full Matches found: '.format(
                      len(page.full_matching_images)) + '\n'

              for image in page.full_matching_images:
                  # print("IMAAA")
                  # print(image)
                  to_display = to_display + str(image) + '\n'
                  # print('\t\tImage url  : {}'.format(image.url))
                  to_display = to_display + '\t\tImage url  : {}'.format(image.url) + '\n'

          if page.partial_matching_images:
              # print('\t{} Partial Matches found: '.format(
              #         len(page.partial_matching_images)))
              to_display = to_display + '\t{} Partial Matches found: '.format(
                      len(page.partial_matching_images)) + '\n'

              for image in page.partial_matching_images:
                  # print('\t\tImage url  : {}'.format(image.url))
                  to_display = to_display + '\t\tImage url  : {}'.format(image.url) + '\n'

  if annotations.web_entities:
      # print('\n{} Web entities found: '.format(
      #     len(annotations.web_entities)))
      to_display = to_display + '\n{} Web entities found: '.format(
          len(annotations.web_entities)) + '\n'

      for entity in annotations.web_entities:
          # print('\n\tScore      : {}'.format(entity.score))
          to_display = to_display + '\n\tScore      : {}'.format(entity.score) + '\n'
          # print(u'\tDescription: {}'.format(entity.description))
          to_display = to_display + u'\tDescription: {}'.format(entity.description) + '\n'

  if annotations.visually_similar_images:
      # print('\n{} visually similar images found:\n'.format(
      #     len(annotations.visually_similar_images)))
      to_display = to_display +'\n{} visually similar images found:\n'.format(
          len(annotations.visually_similar_images)) + '\n'

      for image in annotations.visually_similar_images:
          # print('\tImage url    : {}'.format(image.url))
          to_display = to_display +'\tImage url    : {}'.format(image.url) + '\n'

  if response.error.message:
      raise Exception(
          '{}\nFor more info on error messages, check: '
          'https://cloud.google.com/apis/design/errors'.format(
              response.error.message))
  # return best_guess_label
  return to_display
    # [END vision_python_migration_web_detection]
# [END vision_web_detection]




# image_url = request.args.get('image_url', type = str)
# filter = request.args.get('filter', default = '*', type = str)
def lambda_handler(event, context):
    print("event")
    print(event)
    print('keys')
    print(event.keys())
    print("event['queryStringParameters']")

    print(event['queryStringParameters'])
    print("queryStringParameters")

    print(event['queryStringParameters']['image_url'])
    image_url = event['queryStringParameters']['image_url']
    print("image_url")
    # image_url = "https://static.politico.com/dims4/default/691c7ff/2147483647/resize/1160x%3E/quality/90/?url=https%3A%2F%2Fstatic.politico.com%2F30%2F36%2F3ba8da0f4a04939dd4e9bab735f2%2F220116-kim-jong-un-ap-773.jpg"
    print(image_url)
    img_data = requests.get(image_url).content
    res = detect_web(img_data)
    print(res)
    return res
