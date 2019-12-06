AWS_LAMBDA_FUNCTION_NAME ?= alertlogic-o365-collector
AWS_LAMBDA_PACKAGE_NAME ?= al-o365-collector.zip
AWS_LAMBDA_S3_BUCKET ?= alertlogic-collectors

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
	aws s3 cp ./$(AWS_LAMBDA_PACKAGE_NAME) s3://$(AWS_LAMBDA_S3_BUCKET)
	
sam-local:
	@echo "Invoking ${AWS_LAMBDA_FUNCTION_NAME} locally."
	@./local/run-sam.sh 

clean:
	rm -rf node_modules
	rm -f $(AWS_LAMBDA_PACKAGE_NAME)
	rm -f package-lock.json
	rm -f test/report.xml
	rm -rf ./coverage/
