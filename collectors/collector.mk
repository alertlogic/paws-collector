AWS_LAMBDA_S3_BUCKET ?= alertlogic-collectors
AWS_LAMBDA_FUNCTION_NAME ?= alertlogic-collector
AWS_LAMBDA_PACKAGE_NAME ?= al-collector.zip
AWS_LAMBDA_CONFIG_PATH ?= ./al-collector.json
AWS_CFN_TEMPLATE_PATH ?= ./cfn/collector.template
PROFILE_NAME ?= 


.PHONY: test node_modules

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
	npm prune --production
	zip -r $(AWS_LAMBDA_PACKAGE_NAME) $^ > /dev/null

deploy:
	aws lambda update-function-code --function-name $(AWS_LAMBDA_FUNCTION_NAME) --zip-file fileb://$(AWS_LAMBDA_PACKAGE_NAME) --profile ${PROFILE_NAME}

upload:
	aws s3 cp ./$(AWS_LAMBDA_PACKAGE_NAME) s3://$(AWS_LAMBDA_S3_BUCKET)/packages/lambda/ --profile ${PROFILE_NAME}
	aws s3 cp $(AWS_LAMBDA_CONFIG_PATH) s3://$(AWS_LAMBDA_S3_BUCKET)/configs/lambda/ --profile ${PROFILE_NAME}
	aws s3 cp $(AWS_CFN_TEMPLATE_PATH) s3://$(AWS_LAMBDA_S3_BUCKET)/cfn/ --profile ${PROFILE_NAME}

sam-local:
	@echo "Invoking ${AWS_LAMBDA_FUNCTION_NAME} locally."
	@./local/run-sam.sh 

clean:
	rm -rf node_modules
	rm -f $(AWS_LAMBDA_PACKAGE_NAME)
	rm -f package-lock.json
	rm -f test/report.xml
	rm -rf ./coverage/

