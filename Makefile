AWS_LAMBDA_S3_BUCKET ?= alertlogic-collectors
AWS_LAMBDA_PAWS_FUNCTION_NAME ?= alertlogic-paws-collector
AWS_LAMBDA_PAWS_PACKAGE_NAME ?= al-paws-collector.zip
AWS_CFN_TEMPLATE_PATH ?= ./cfn/paws-collector.template
AWS_CFN_TEMPLATE_SHARED_PATH ?= ./cfn/paws-collector-shared.template
COLLECTOR_DIRS ?= $(shell find collectors/ -type d -maxdepth 1 -mindepth 1)
COLLECTOR_NAMES ?= $(shell find collectors/ -type d -maxdepth 1 -mindepth 1 -exec basename {} \; | grep -v "template")


.PHONY: test

all: test package package.zip

deps:
	npm install

compile: deps
	npm run lint

test: compile
	npm run test
	@echo "Running Code Coverage for $(AWS_LAMBDA_PAWS_FUNCTION_NAME)."	
	mkdir ".ps_outputs"
	cp coverage/cobertura-coverage.xml ./coverage/coverage.cobertura.xml
	cp coverage/cobertura-coverage.xml ./.ps_outputs/$(AWS_LAMBDA_PAWS_FUNCTION_NAME).covertool.xml
	
test-all: test
	for d in $(COLLECTOR_NAMES); do \
	    echo "\n************\n\nrunning tests for $$d\n\n************\n\n"; \
	    make -C collectors/$$d test || exit 1; \
	    if [ -d "./collectors/$$d/coverage" ]; then \
	      echo "\n************ Copying Code Coverage files $$d ************\n\n"; \
              cp ./collectors/$$d/coverage/cobertura-coverage.xml ./.ps_outputs/$$d.covertool.xml; \
	    fi; \
	done;

package-all:
	mkdir -p artifact_folder
	for d in $(COLLECTOR_NAMES); do \
	    echo -e "\n************\n\n creaating package for $$d\n\n************\n\n"; \
	    make -C collectors/$$d package || exit 1; \
		mkdir -p artifact_folder/$$d-collector; \
		cp -r collectors/$$d/cfn collectors/$$d/al-$$d-collector.zip collectors/$$d/al-$$d-collector.json artifact_folder/$$d-collector/; \
		if [ -d "./collectors/$$d/themis-template" ]; then \
			cp -r collectors/$$d/themis-template artifact_folder/$$d-collector/; \
		fi; \
	done;
	cp -r cfn artifact_folder;

package: test package.zip

package.zip: node_modules/ *.js package.json
	zip -r $(AWS_LAMBDA_PAWS_PACKAGE_NAME) $^

publish:
	npm run rel

update-collector-versions:
	npm run bump-collector-versions $(VERSION)

deploy:
	aws lambda update-function-code --function-name $(AWS_LAMBDA_PAWS_FUNCTION_NAME) --zip-file fileb://$(AWS_LAMBDA_PAWS_PACKAGE_NAME)

upload:
	aws s3 cp $(AWS_CFN_TEMPLATE_PATH) s3://$(AWS_LAMBDA_S3_BUCKET)/cfn/
	aws s3 cp $(AWS_CFN_TEMPLATE_SHARED_PATH) s3://$(AWS_LAMBDA_S3_BUCKET)/cfn/

sam-local:
	@echo "Invoking ${AWS_LAMBDA_PAWS_FUNCTION_NAME} locally."
	@./local/run-sam.sh 

clean:
	rm -rf node_modules
	rm -f $(AWS_LAMBDA_PAWS_PACKAGE_NAME)
	rm -f package-lock.json
	rm -f test/report.xml
	rm -rf ./coverage/
	rm -rf .ps_outputs/
	rm -rf .nyc_output/
	rm -rf *.coverage.xml
	rm -rf *.covertool.xml
	for d in $(COLLECTOR_DIRS); do \
        echo "\n************\n\ncleaning for $$d\n\n************\n\n"; \
        if [ "$$d" != "collectors/template" ]; then \
                make -C $$d clean || exit 1; \
        fi; \
    done
