#!/bin/bash
SCRIPT_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
SAM_TEMPLATE_NAME="sam-template.yaml"
ENV_FILE_NAME="env.json"
EVENT_FILE_NAME="event_poll.json"
SRC_SAM_TEMPLATE="${SCRIPT_DIR}/sam-template.yaml"
SRC_ENV_FILE="${SCRIPT_DIR}/${ENV_FILE_NAME}"
SRC_EVENT_FILE="${SCRIPT_DIR}/events/${EVENT_FILE_NAME}"
RUN_DIR=${SCRIPT_DIR}/../


command -v sam > /dev/null
if [ $? -ne 0 ]; then
    echo "sam not found.
Please follow the installation instructions https://docs.aws.amazon.com/lambda/latest/dg/sam-cli-requirements.html"
    exit 0
fi

if [ ! -f ${SRC_ENV_FILE} ]; then
    echo "${SRC_ENV_FILE} doesn't exist. Please copy and fill in ${SRC_ENV_FILE}.tmpl"
    exit 0
fi

ln -sf ${SRC_SAM_TEMPLATE} ${RUN_DIR}/${SAM_TEMPLATE_NAME}
ln -sf ${SRC_ENV_FILE} ${RUN_DIR}/${ENV_FILE_NAME}
ln -sf ${SRC_EVENT_FILE} ${RUN_DIR}/${EVENT_FILE_NAME}
cd ${RUN_DIR} && \
sam local invoke \
    --env-vars ${ENV_FILE_NAME} \
    -t ${SAM_TEMPLATE_NAME} \
    -e ${EVENT_FILE_NAME} \
    "LocalLambda"

unlink ${RUN_DIR}/${SAM_TEMPLATE_NAME}
unlink ${RUN_DIR}/${ENV_FILE_NAME}
unlink ${RUN_DIR}/${EVENT_FILE_NAME}
