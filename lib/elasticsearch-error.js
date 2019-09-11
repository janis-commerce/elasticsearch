'use strict';

class ElasticSearchError extends Error {

	static get codes() {

		return {
			INVALID_MODEL: 1,
			INVALID_QUERY: 2,
			ELASTICSEARCH_ERROR: 3,
			INVALID_FILTERS: 4,
			INVALID_FILTER_OPERATOR: 5,
			INDEX_NOT_FOUND: 6,
			INDEX_NOT_BUILT: 7
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
