'use strict';

class ElasticSearchError extends Error {

	static get codes() {

		return {
			INVALID_CONFIG: 1,
			INVALID_MODEL: 2,
			INVALID_QUERY: 3,
			ELASTICSEARCH_ERROR: 4,
			INVALID_FILTERS: 5,
			INVALID_FILTER_OPERATOR: 6
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
