#!/bin/bash
rm -f package.zip
rm -rf package
pip install --target ./package requests
pip install --target ./package google-cloud-vision
cd package
zip -r ../package.zip .
cd ..
zip -g package.zip lambda_function.py
zip -g package.zip credentials.json
echo 'Now upload package.zip to AWS Lambda (please make sure that the Lambda function timeout configuration is enough)'
