'use strict';

class ElasticSearchError extends Error {

	static get codes() {

		return {
			INVALID_CONFIG: 1,
			INVALID_MODEL: 2,
			ELASTICSEARCH_ERROR: 3
		};

	}

	constructor(err, code) {
		super(err);
		this.message = err.message || err;
		this.code = code;
		this.name = 'ElasticSearchError';
	}
}

module.exports = ElasticSearchError;
