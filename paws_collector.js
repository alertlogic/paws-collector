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

const debug = require('debug')('index');

const AlAwsCollector = require('al-aws-collector-js').AlAwsCollector;
const m_packageJson = require('./package.json');

class PawsCollector extends AlAwsCollector {
    constructor(context, creds, extensionName) {
        super(context, 'paws',
              AlAwsCollector.IngestTypes.LOGMSGS,
              m_packageJson.version,
              creds,
              null, [], []);
        console.info('PAWS000001 Loading extension', extensionName);
        this._extensionName = extensionName;
    };
    
    register(event) {
        let collector = this;
        let stack = {
            stackName : event.ResourceProperties.StackName,
            extensionName : collector._extensionName
        };
        let custom = collector.extensionGetRegisterParameters(event);
        registerProps = Object.assign(stack, custom);
        return super.register(event, registerProps);
    };
    
    deregister(event) {
        let collector = this;
        let stack = {
            stackName : event.ResourceProperties.StackName,
            extensionName : collector._extensionName
        };
        let custom = collector.extensionGetRegisterParameters(event);
        registerProps = Object.assign(stack, custom);
        return super.deregister(event, registerProps);
    };
    
    handleEvent(event) {
        let collector = this;
        switch (event.RequestType) {
        case 'ScheduledEvent':
            switch (event.Type) {
                case 'PollRequest':
                    return collector.handlePollRequest(event);
                    break;
                default:
                    break;
            }
            default:
                break;
        }
        return super.handleEvent(event);
    };
    
    handlePollRequest(event) {
        let collector = this;
        const logs = collector.extensionGetLogs(event, "", function(err, logs, newState){
            console.log('!!!Received logs', logs.length);
            collector.processLog(logs, collector.extensionFormatLog, null, function(error){
                console.log('!!!Logs processed', error);
                collector.done(error);
            });
        });
    };
    
    extensionGetLogs(event, state, callback) {
        throw Error("not implemented extensionGetLogs()");
    };
    
    extensionGetRegisterParameters(event) {
        throw Error("not implemented extensionGetRegisterParameters()");
    };
    
    extensionFormatLog() {
        throw Error("not implemented extensionFormatLog()");
    };
}

module.exports = {
    PawsCollector: PawsCollector
}

