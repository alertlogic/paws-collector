AWS_LAMBDA_S3_BUCKET ?= alertlogic-collectors
AWS_LAMBDA_FUNCTION_NAME ?= alertlogic-auth0-collector
AWS_LAMBDA_PACKAGE_NAME ?= al-auth0-collector.zip
AWS_LAMBDA_CONFIG_PATH ?= ./al-auth0-collector.json
AWS_CFN_TEMPLATE_PATH ?= ./cfn/auth0-collector.template
.PHONY: test

all: test package package.zip

deps: node_modules

node_modules:
	npm install

compile: deps
	npm run lint

test: compile
	npm run test

package: test package.zip

package.zip: node_modules/ *.js package.json
	zip -r $(AWS_LAMBDA_PACKAGE_NAME) $^

deploy:
	aws lambda update-function-code --function-name $(AWS_LAMBDA_FUNCTION_NAME) --zip-file fileb://$(AWS_LAMBDA_PACKAGE_NAME)

upload:
	aws s3 cp ./$(AWS_LAMBDA_PACKAGE_NAME) s3://$(AWS_LAMBDA_S3_BUCKET)/packages/lambda/
	aws s3 cp $(AWS_LAMBDA_CONFIG_PATH) s3://$(AWS_LAMBDA_S3_BUCKET)/configs/lambda/
	aws s3 cp $(AWS_CFN_TEMPLATE_PATH) s3://$(AWS_LAMBDA_S3_BUCKET)/cfn/

sam-local:
	@echo "Invoking ${AWS_LAMBDA_FUNCTION_NAME} locally."
	@./local/run-sam.sh 

clean:
	rm -rf node_modules
	rm -f $(AWS_LAMBDA_PACKAGE_NAME)
	rm -f package-lock.json
	rm -f test/report.xml
	rm -rf ./coverage/
