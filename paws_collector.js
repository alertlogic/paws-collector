/* -----------------------------------------------------------------------------
 * @copyright (C) 2019, Alert Logic, Inc
 * @doc
 *
 * Lambda function for polling 3rd party service log API and ingest retrieved data
 * into Alert Logic backend.
 *
 * @end
 * -----------------------------------------------------------------------------
 */

const debug = require('debug') ('index');

const AlAwsCollector = require('al-aws-collector-js').AlAwsCollector;
const m_packageJson = require('./package.json');

var formatMessagesFun = function formatMessages(event, context, callback) {
    return callback(null, '');
}

class PawsCollector extends AlAwsCollector {
    constructor(context, creds) {
        super(context, 'paws',
              AlAwsCollector.IngestTypes.LOGMSGS,
              m_packageJson.version,
              creds,
              formatMessagesFun, [], []);
    }
    
    register(event) {
        let custom = {
                stackName : event.ResourceProperties.StackName
        };
        super.register(event, custom);
    }
    
    deregister(event) {
        let custom = {
                stackName : event.ResourceProperties.StackName
        };
        super.deregister(event, custom);
    }
    
    handleEvent(event) {
        switch (event.RequestType) {
        case 'ScheduledEvent':
            switch (event.Type) {
                case 'PollRequest':
                    let context = super._invokeContext;
                    debug('Processing Poll request: ', event);
                    return super.done();
                    break;
                default:
                    break;
            }
            default:
                break;
        }
        super.handleEvent(event);
    }
}

module.exports = {
    PawsCollector: PawsCollector
}

