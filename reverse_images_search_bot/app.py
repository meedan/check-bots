from flask import Flask
from flask import request
import requests
from flask import jsonify

app = Flask(__name__)

import os
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = "credentials.json"

def detect_web(path):
  """Detects web annotations given an image."""
  from google.cloud import vision
  import io
  client = vision.ImageAnnotatorClient()

  with io.open(path, 'rb') as image_file:
      content = image_file.read()

  image = vision.Image(content=content)

  response = client.web_detection(image=image)
  annotations = response.web_detection
  best_guess_label = ""
  to_display = ""
  if annotations.best_guess_labels:
      for label in annotations.best_guess_labels:
          to_display = to_display + '\nBest guess label: {}'.format(label.label) + '\n'
          best_guess_label = label.label

  if annotations.pages_with_matching_images:
      to_display = to_display + '\n{} Pages with matching images found:'.format(
          len(annotations.pages_with_matching_images)) + '\n'

      for page in annotations.pages_with_matching_images:
          to_display = to_display + '\n\tPage url   : {}'.format(page.url) + '\n'

          if page.full_matching_images:
              to_display = to_display + '\t{} Full Matches found: '.format(
                      len(page.full_matching_images)) + '\n'

              for image in page.full_matching_images:
                  to_display = to_display + str(image) + '\n'
                  to_display = to_display + '\t\tImage url  : {}'.format(image.url) + '\n'

          if page.partial_matching_images:
              to_display = to_display + '\t{} Partial Matches found: '.format(
                      len(page.partial_matching_images)) + '\n'

              for image in page.partial_matching_images:
                  to_display = to_display + '\t\tImage url  : {}'.format(image.url) + '\n'

  if annotations.web_entities:
      to_display = to_display + '\n{} Web entities found: '.format(
          len(annotations.web_entities)) + '\n'

      for entity in annotations.web_entities:
          to_display = to_display + '\n\tScore      : {}'.format(entity.score) + '\n'
          to_display = to_display + u'\tDescription: {}'.format(entity.description) + '\n'

  if annotations.visually_similar_images:
      to_display = to_display +'\n{} visually similar images found:\n'.format(
          len(annotations.visually_similar_images)) + '\n'

      for image in annotations.visually_similar_images:
          to_display = to_display +'\tImage url    : {}'.format(image.url) + '\n'

  if response.error.message:
      raise Exception(
          '{}\nFor more info on error messages, check: '
          'https://cloud.google.com/apis/design/errors'.format(
              response.error.message))
  return to_display

@app.route("/")
def hello():
    return "Hello! from reverse image search flask"

@app.route('/webdetection')
def my_route():
  image_url = request.args.get('image_url', type = str)
  img_data = requests.get(image_url).content
  with open("test_img.jpeg", 'wb') as handler:
      handler.write(img_data)
  res = detect_web('test_img.jpeg')
  return jsonify({"res": res})
  
if __name__ == "__main__":
  app.run()



#  http://127.0.0.1:3100/webdetection?image_url=https://ca-times.brightspotcdn.com/dims4/default/0a9b158/2147483647/strip/true/crop/840x560+0+0/resize/840x560!/quality/90/?url=https%3A%2F%2Fcalifornia-times-brightspot.s3.amazonaws.com%2F45%2F85%2F4f7d420b48a8a0e10c12c7b06042%2Fkim.jpg
