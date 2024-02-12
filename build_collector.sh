#!/bin/sh
COLLECTOR_NAME=$1

cd collectors/"$COLLECTOR_NAME"
npm install
make package

mkdir -p "${COLLECTOR_NAME}"-collector
cp -r cfn al-"${COLLECTOR_NAME}"-collector.zip al-"${COLLECTOR_NAME}"-collector.json "${COLLECTOR_NAME}"-collector
if [ -d "./themis-template" ]; then \
	cp -r themis-template "${COLLECTOR_NAME}"-collector; \
fi; \
zip -r ../../"${COLLECTOR_NAME}"-collector.zip "${COLLECTOR_NAME}"-collector
