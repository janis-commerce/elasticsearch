'use strict';

const assert = require('assert');

const ConfigValidator = require('../lib/config-validator');

const ElasticSearchConfigError = require('../lib/elasticsearch-config-error');

describe('ConfigValidator', () => {

	describe('validate()', () => {

		it('should throw invalid config when the config is empty', () => {

			assert.throws(() => ConfigValidator.validate(), {
				name: 'ElasticSearchConfigError',
				code: ElasticSearchConfigError.codes.INVALID_CONFIG
			});

		});


		it('should throw invalid config when the config is not an object', () => {

			assert.throws(() => ConfigValidator.validate('string'), {
				name: 'ElasticSearchConfigError',
				code: ElasticSearchConfigError.codes.INVALID_CONFIG
			});

		});


		it('should throw invalid config when the config is an array', () => {

			assert.throws(() => ConfigValidator.validate([]), {
				name: 'ElasticSearchConfigError',
				code: ElasticSearchConfigError.codes.INVALID_CONFIG
			});

		});


		['string', ['array']].forEach(type => {

			it('should throw invalid setting when a setting has an unexpected type', () => {

				assert.throws(() => ConfigValidator.validate({
					prefix: 'myPrefix',
					port: type
				}), {
					name: 'ElasticSearchConfigError',
					code: ElasticSearchConfigError.codes.INVALID_SETTING
				});
			});

		});

		it('should not throw when the settings are correct', () => {

			assert.doesNotThrow(() => ConfigValidator.validate({
				prefix: 'myPrefix',
				port: 9200
			}));
		});
	});
});
