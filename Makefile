AWS_LAMBDA_PAWS_FUNCTION_NAME ?= alertlogic-paws-collector
AWS_LAMBDA_PAWS_PACKAGE_NAME ?= al-paws-collector.zip

.PHONY: test

all: test package package.zip

deps:
	npm install

compile: deps
	npm run lint

test: compile
	npm run test
	
package: test package.zip

package.zip: node_modules/ *.js package.json
	zip -r $(AWS_LAMBDA_PAWS_PACKAGE_NAME) $^

publish:
	npm run rel

deploy:
	aws lambda update-function-code --function-name $(AWS_LAMBDA_PAWS_FUNCTION_NAME) --zip-file fileb://$(AWS_LAMBDA_PAWS_PACKAGE_NAME)

sam-local:
	@echo "Invoking ${AWS_LAMBDA_PAWS_FUNCTION_NAME} locally."
	@./local/run-sam.sh 

clean:
	rm -rf node_modules
	rm -f $(AWS_LAMBDA_PAWS_PACKAGE_NAME)
	rm -f package-lock.json
	rm -f test/report.xml
	rm -rf ./coverage/
