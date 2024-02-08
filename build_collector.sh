#!/bin/sh
COLLECTOR_NAME=$1

cd collectors/"$COLLECTOR_NAME" || exit 1
npm install || exit 1
make package || exit 1

mkdir -p "${COLLECTOR_NAME}"-collector
cp -r cfn al-"${COLLECTOR_NAME}"-collector.zip al-"${COLLECTOR_NAME}"-collector.json themis-template "${COLLECTOR_NAME}"-collector
zip -r ../../"${COLLECTOR_NAME}"-collector.zip "${COLLECTOR_NAME}"-collector
