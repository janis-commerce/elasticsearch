'use strict';

const ElasticSearchError = require('./elasticsearch-error');

/**
 * @class ElasticSearchFilters
 * @classdesc An elasticsearch filters builder
 */
class ElasticSearchFilters {

	/**
	 * Get the elasticsearch filters query from the received filters
	 * @param {Object} filters filters
	 * @returns {Object} elasticsearch filters
	 */
	static getFilters(filters) {

		if(!filters || typeof filters !== 'object' || Array.isArray(filters))
			throw new ElasticSearchError('Invalid filters', ElasticSearchError.codes.INVALID_FILTERS);

		filters = this._prepareFilters(filters);

		const parsedFilters = {};

		for(const [operator, fields] of Object.entries(filters))
			this._formatByOperator(parsedFilters, operator, fields);

		if(parsedFilters.bool && parsedFilters.range) { // The range filters must be inside the term filters when both exists

			parsedFilters.bool.must = parsedFilters.bool.must || [];
			parsedFilters.bool.must.push({ range: parsedFilters.range });

			delete parsedFilters.range; // If bool and range keys coexist, ElasticSearch will throw.
		}

		return { query: parsedFilters };
	}

	/**
	 * Prepare the filters by comparing it with the received operators
	 * @param {Object} filters filters
	 * @param {Array} operators the operators array for preparing the filters contexts
	 * @returns {Object} prepared filters
	 */
	static _prepareFilters(filters) {

		const preparedFilters = {};

		for(let [key, value] of Object.entries(filters)) {

			if(!key.includes('$')) { // Convert "field: 'value'" into "$eq: { field: 'value' }"
				value = { [key]: value };
				key = '$eq';
			}

			const operator = key.replace('$', '');

			preparedFilters[operator] = { ...preparedFilters[operator], ...value };
		}

		return preparedFilters;
	}

	/**
	 * Build the filters query for each received item
	 * @param {Object} parsedFilters The object where the filters will be built
	 * @param {String} operator The received filter operator
	 * @param {Object} fields The received fields
	 */
	static _formatByOperator(parsedFilters, operator, fields) {

		const operators = {
			eq: this._formatEq,
			ne: this._formatNe,
			in: this._formatIn,
			nin: this._formatNin,
			gt: this._formatGt,
			gte: this._formatGte,
			lt: this._formatLt,
			lte: this._formatLte
		};

		const formatter = operators[operator];

		if(typeof formatter !== 'function')
			throw new ElasticSearchError(`'${operator}' is not a valid filter operator.`, ElasticSearchError.codes.INVALID_FILTER_OPERATOR);

		for(const [field, value] of Object.entries(fields))
			formatter(parsedFilters, field, value);
	}

	/**
	 * Build the filter query for the received item
	 * @param {Object} parsedFilters The object where the filters will be built
	 * @param {String} field The received field name
	 * @param {String} value The received field value
	 */
	static _formatEq(parsedFilters, field, value) {

		parsedFilters.bool = parsedFilters.bool || {};
		parsedFilters.bool.must = parsedFilters.bool.must || [];
		parsedFilters.bool.must.push({ term: { [`${field}.raw`]: value } });
	}

	/**
	 * Build the filter query for the received item
	 * @param {Object} parsedFilters The object where the filters will be built
	 * @param {String} field The received field name
	 * @param {String} value The received field value
	 */
	static _formatNe(parsedFilters, field, value) {

		parsedFilters.bool = parsedFilters.bool || {};
		parsedFilters.bool.must_not = parsedFilters.bool.must_not || [];
		parsedFilters.bool.must_not.push({ term: { [`${field}.raw`]: value } });
	}

	/**
	 * Build the filter query for the received item
	 * @param {Object} parsedFilters The object where the filters will be built
	 * @param {String} field The received field name
	 * @param {Array} value The received field value
	 */
	static _formatIn(parsedFilters, field, value) {

		if(!Array.isArray(value)) {
			throw new ElasticSearchError(`Invalid filter: $in operator expects an array but received '${typeof value}'.`,
				ElasticSearchError.codes.INVALID_FILTERS);
		}

		parsedFilters.bool = parsedFilters.bool || {};
		parsedFilters.bool.must = parsedFilters.bool.must || [];
		parsedFilters.bool.must.push({ terms: { [field]: value.map(keyword => keyword.toLowerCase()) } });
	}

	/**
	 * Build the filter query for the received item
	 * @param {Object} parsedFilters The object where the filters will be built
	 * @param {String} field The received field name
	 * @param {Array} value The received field value
	 */
	static _formatNin(parsedFilters, field, value) {

		if(!Array.isArray(value)) {
			throw new ElasticSearchError(`Invalid filter: $nin operator expects an array but received '${typeof value}'.`,
				ElasticSearchError.codes.INVALID_FILTERS);
		}

		parsedFilters.bool = parsedFilters.bool || {};
		parsedFilters.bool.must_not = parsedFilters.bool.must_not || [];
		parsedFilters.bool.must_not.push({ terms: { [field]: value.map(keyword => keyword.toLowerCase()) } });
	}

	/**
	 * Build the filter query for the received item
	 * @param {Object} parsedFilters The object where the filters will be built
	 * @param {String} field The received field name
	 * @param {String|Number} value The received field value
	 */
	static _formatGt(parsedFilters, field, value) {

		parsedFilters.range = parsedFilters.range || {};
		parsedFilters.range[field] = parsedFilters.range[field] || {};
		parsedFilters.range[field].gt = value;
	}

	/**
	 * Build the filter query for the received item
	 * @param {Object} parsedFilters The object where the filters will be built
	 * @param {String} field The received field name
	 * @param {String|Number} value The received field value
	 */
	static _formatGte(parsedFilters, field, value) {

		parsedFilters.range = parsedFilters.range || {};
		parsedFilters.range[field] = parsedFilters.range[field] || {};
		parsedFilters.range[field].gte = value;
	}

	/**
	 * Build the filter query for the received item
	 * @param {Object} parsedFilters The object where the filters will be built
	 * @param {String} field The received field name
	 * @param {String|Number} value The received field value
	 */
	static _formatLt(parsedFilters, field, value) {

		parsedFilters.range = parsedFilters.range || {};
		parsedFilters.range[field] = parsedFilters.range[field] || {};
		parsedFilters.range[field].lt = value;
	}

	/**
	 * Build the filter query for the received item
	 * @param {Object} parsedFilters The object where the filters will be built
	 * @param {String} field The received field name
	 * @param {String|Number} value The received field value
	 */
	static _formatLte(parsedFilters, field, value) {

		parsedFilters.range = parsedFilters.range || {};
		parsedFilters.range[field] = parsedFilters.range[field] || {};
		parsedFilters.range[field].lte = value;
	}

}

module.exports = ElasticSearchFilters;
