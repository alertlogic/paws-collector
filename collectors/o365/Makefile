AWS_LAMBDA_FUNCTION_NAME ?= alertlogic-o365-collector
AWS_LAMBDA_PACKAGE_NAME ?= al-o365-collector.zip
AWS_LAMBDA_CONFIG_PATH ?= ./al-o365-collector.json
AWS_CFN_TEMPLATE_PATH ?= ./cfn/o365-collector.template

package.zip: node_modules/ lib/ *.js package.json 
	zip -r $(AWS_LAMBDA_PACKAGE_NAME) $^

-include ../collector.mk
