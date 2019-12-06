'use strict';

const ElasticSearchConfigError = require('./elasticsearch-config-error');

const ELASTICSEARCH_CONFIG_STRUCT = {
	protocol: 'string',
	host: 'string',
	port: 'number',
	user: 'string',
	password: 'string',
	limit: 'number',
	prefix: 'string',
	awsCredentials: 'boolean',
	requestTimeout: 'number',
	maxRetries: 'number'
};

/**
 * @class ConfigValidator
 * @classdesc Validates config struct
 */
class ConfigValidator {

	/**
   * Validate the received config struct
   * @throws if the struct is invalid
   */
	static validate(config) {

		if(!config || typeof config !== 'object' || Array.isArray(config))
			throw new ElasticSearchConfigError('Invalid config: Should be an object.', ElasticSearchConfigError.codes.INVALID_CONFIG);

		for(const [setting, type] of Object.entries(ELASTICSEARCH_CONFIG_STRUCT)) {

			if(config[setting] && typeof config[setting] !== type) { // eslint-disable-line
				throw new ElasticSearchConfigError(`Invalid setting '${setting}': Expected ${type} but received ${typeof config[setting]}.`,
					ElasticSearchConfigError.codes.INVALID_SETTING);
			}
		}
	}
}

module.exports = ConfigValidator;
