This is a repo that contains code for the reverse image search bot. 
The code base consists of two parts:
1) Python: `reverse_images_search` which is an AWS Lambda function that recieves an image URL and returns the results of Google Cloud Web Detection API. 
2) Nodejs: `check_images_webdetection_bot` an AWS Lambda function that recieves connections from the webhook attached to Check. The function detects if there is a new item with an image that was created in some selected folders. When such an item is created, the function recieves the image url and send a request to the python part `reverse_images_search`. Then it changes the item status to Reverse Image Search, creates a report and adds note with the results of the Google Cloud API. 


SOS:
To disable the bot functionality to a folder (project): remove the project_id from the following line
```    if (projectId == 14912 || 14837) {```
