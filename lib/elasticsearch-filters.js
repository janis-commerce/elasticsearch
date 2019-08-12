'use strict';

const RANGE_OPERATORS = ['gt', 'gte', 'lt', 'lte'];
const TERM_MUST_OPERATORS = ['eq', 'in'];
const TERM_MUST_NOT_OPERATORS = ['ne', 'nin'];

/**
 * @class ElasticSearchFilters
 * @classdesc An elasticsearch filters builder
 */
class ElasticSearchFilters {

	/**
	 * Get the elasticsearch filters query from the recieved filters
	 * @param {Object} filters filters
	 * @returns {Object} elasticsearch filters
	 */
	static getFilters(filters) {

		if(!filters || typeof filters !== 'object' || Array.isArray(filters))
			return {};

		const queries = {
			range: this._parseRangeQueries(filters),
			term: this._parseTermQueries(filters)
		};

		if(Object.keys(queries.range).length && Object.keys(queries.term).length) {
			queries.term.bool.must.push(queries.range);
			delete queries.range;
		}

		return {
			query: { ...queries.term, ...queries.range }
		};
	}

	/**
	 * Prepare the filters by comparing it with the recieved operators
	 * @param {Object} filters filters
	 * @param {Array} operators the operators array for preparing the filters contexts
	 * @returns {Object} prepared filters
	 */
	static _prepareFilters(filters, operators) {

		const preparedFilters = {};

		for(let [key, value] of Object.entries(filters)) {

			if(!key.includes('$')) {
				value = { [key]: value };
				key = '$eq';
			}

			const operator = key.replace('$', '');

			if(operators && operators.includes(operator))
				preparedFilters[operator] = value;
		}

		return preparedFilters;
	}

	/**
	 * Parses the range filters into elasticsearch range queries
	 * @param {Object} filters filters
	 * @returns {Object} elasticsearch range queries
	 */
	static _parseRangeQueries(filters) {

		const parsedQueries = {};

		filters = this._prepareFilters(filters, RANGE_OPERATORS);

		for(const [operator, fields] of Object.entries(filters)) {

			for(const [field, value] of Object.entries(fields)) {

				if(!parsedQueries[field])
					parsedQueries[field] = {};

				parsedQueries[field][operator] = value;

			}
		}

		return Object.keys(parsedQueries).length ? { range: parsedQueries } : {};
	}

	/**
	 * Parses the term filters into elasticsearch term queries
	 * @param {Object} filters filters
	 * @returns {Object} elasticsearch term queries
	 */
	static _parseTermQueries(filters) {

		const parsedQueries = {};

		filters = {
			must: this._prepareFilters(filters, TERM_MUST_OPERATORS),
			must_not: this._prepareFilters(filters, TERM_MUST_NOT_OPERATORS)
		};

		if(Object.keys(filters.must).length) {

			parsedQueries.must = [];

			for(const [operator, fields] of Object.entries(filters.must)) {

				for(const [field, value] of Object.entries(fields)) {

					if(operator === 'eq') {
						parsedQueries.must.push({ term: { [`${field}.raw`]: value } });
						continue;
					}

					if(!Array.isArray(value))
						continue;

					value.forEach(keyword => {
						parsedQueries.must.push({ term: { [field]: keyword.toLowerCase() } });
					});
				}
			}
		}

		if(Object.keys(filters.must_not).length) {

			parsedQueries.must_not = [];

			for(const [operator, fields] of Object.entries(filters.must_not)) {

				for(const [field, value] of Object.entries(fields)) {

					if(operator === 'ne') {
						parsedQueries.must_not.push({ term: { [`${field}.raw`]: value } });
						continue;
					}

					if(!Array.isArray(value))
						continue;

					value.forEach(keyword => {
						parsedQueries.must_not.push({ term: { [field]: keyword.toLowerCase() } });
					});
				}
			}
		}

		return Object.keys(parsedQueries).length ? { bool: parsedQueries } : {};

	}

}

module.exports = ElasticSearchFilters;
