/* -----------------------------------------------------------------------------
 * @copyright (C) 2017, Alert Logic, Inc
 * @doc
 * 
 * Base class for communication to Alertlogic services.
 * 
 * @end
 * -----------------------------------------------------------------------------
 */
 
const fs = require('fs');
const path = require('path');

const m_alUtil = require('../al_util');


/**
 * @class
 * Helper class for Alertlogic API requests authentication.
 * 
 * @constructor
 * @param {string} apiEndpoint - Alertlogic API hostname
 * @param {Object} aisCreds - Alertlogic API credentials.
 * @param {string} [aisCreds.access_key_id] - Aertlogic API access key id.
 * @param {string} [aisCreds.secret_key] - Alertlogic API secret key.
 * @param {string} cacheDir - directory for caching Alertlogic API tokens.
 * 
 */
class AimsC extends m_alUtil.RestServiceClient {
    constructor(apiEndpoint, aimsCreds, cacheDir) {
        super(apiEndpoint);
        this._cid = null;
        this._aimsAuth = {
            user: aimsCreds.access_key_id,
            password: aimsCreds.secret_key
        };
        this._tokenCacheFile = path.join(cacheDir,
                aimsCreds.access_key_id + '-token.tmp');
    }
    
    _makeAuthRequest() {
        if (this._isTokenMemCached()) {
            return Promise.race([this._aimsResponse]);
        }
        if (this._isTokenFileCached()) {
            return Promise.race([this._aimsResponse]);
        }
        return super.post('/aims/v1/authenticate', {auth: this._aimsAuth})
            .then(resp => {
                this._cid = resp.authentication.account.id;
                this._aimsResponse = resp;
                fs.writeFileSync(this._tokenCacheFile, JSON.stringify(resp));
                return resp;
            });
    }
    
    _isTokenExpired(aimsToken) {
        aimsToken.authentication.token_expiration > (Date.now()/1000 + 600);
    }
    
    _isTokenMemCached() {
        this._aimsResponse && this._isTokenExpired(this._aimsResponse);
    }
    
    _isTokenFileCached() {
        var filename = this._tokenCacheFile;
        fs.readFile(filename, (readError, fileContent) => {
            if (readError) {
                if ( readError.code != 'ENOENT' ) {
                    fs.unlinkSync(filename);
                }
                return false;
            }
            try {
                var tokenJson = JSON.parse(fileContent);
                if (this._isTokenExpired(tokenJson)) {
                    return false;
                } else {
                    this._aimsResponse = tokenJson;
                    return true;
                }
            } catch (exception) {
                // Delete the cache file with malformed data.
                fs.unlinkSync(filename);
                return false;
            }
        });
            
    }
    
    get cid() {
        return this._cid;
    }
    
    authenticate() {
        return this._makeAuthRequest();
    }
    
}

/**
 * @class
 * Base class for all Alertlogic service clients which always uses
 * Alerlogic API request authentication headers and constructs AL services'
 * base paths.
 *
 * @constructor
 * @param {string} apiEndpoint - Alertlogic API hostname.
 * @param {string} name - Alertlogic service name.
 * @param {string} version - Alertlogic service HTTP API version.
 * @param {Object} aisCreds - Alertlogic API credentials.
 * @param {string} [aisCreds.access_key_id] - Aertlogic API access key id.
 * @param {string} [aisCreds.secret_key] - Alertlogic API secret key.
 * @param {string} cacheDir - directory for caching Alertlogic API tokens.
 *
 */
class AlServiceC extends m_alUtil.RestServiceClient {
    constructor(apiEndpoint, name, version, aimsCreds, cacheDir) {
        super(apiEndpoint);
        this._url = this._url + '/' + name + '/' + version;
        this._aimsc = new AimsC(apiEndpoint, aimsCreds, cacheDir);
    }
    
    request(method, path, extraOptions) {
        return this._aimsc.authenticate()
            .then(resp => {
                const newOptions = Object.assign({}, extraOptions);
                newOptions.headers = newOptions.headers ?
                                     newOptions.headers : 
                                     {};
                newOptions.headers['x-aims-auth-token'] = resp.authentication.token;
                var url = '/' + this._aimsc.cid + path;
                return super.request(method, url, newOptions);
            });
    }
}

exports.AlServiceC = AlServiceC;
exports.Aimsc = AimsC;

