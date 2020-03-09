AWS_LAMBDA_S3_BUCKET ?= alertlogic-collectors
AWS_LAMBDA_PAWS_FUNCTION_NAME ?= alertlogic-paws-collector
AWS_LAMBDA_PAWS_PACKAGE_NAME ?= al-paws-collector.zip
AWS_CFN_TEMPLATE_PATH ?= ./cfn/paws-collector.template

.PHONY: test

all: test package package.zip

deps:
	npm install

compile: deps
	npm run lint

test: compile
	npm run test
	
test-all: compile
	npm run test
	./run-all-tests.sh
	
package: test package.zip

package.zip: node_modules/ *.js package.json
	zip -r $(AWS_LAMBDA_PAWS_PACKAGE_NAME) $^

publish:
	npm run rel

deploy:
	aws lambda update-function-code --function-name $(AWS_LAMBDA_PAWS_FUNCTION_NAME) --zip-file fileb://$(AWS_LAMBDA_PAWS_PACKAGE_NAME)

upload:
	aws s3 cp $(AWS_CFN_TEMPLATE_PATH) s3://$(AWS_LAMBDA_S3_BUCKET)/cfn/

sam-local:
	@echo "Invoking ${AWS_LAMBDA_PAWS_FUNCTION_NAME} locally."
	@./local/run-sam.sh 

clean:
	rm -rf node_modules
	rm -f $(AWS_LAMBDA_PAWS_PACKAGE_NAME)
	rm -f package-lock.json
	rm -f test/report.xml
	rm -rf ./coverage/
