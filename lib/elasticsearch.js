'use strict';

const elasticsearch = require('elasticsearch');

const ElasticSearchError = require('./elasticsearch-error');

const DEFAULT_LIMIT = 500;

const ES_DEFAULT_PROTOCOL = 'http://';

const ES_DEFAULT_HOST = 'localhost';

const ES_DEFAULT_INDEX = 'default';

/**
 * @class ElasticSearch
 * @classdesc Elasticsearch driver module
*/
class ElasticSearch {

	constructor(config) {
		if(!config || typeof config !== 'object' || Array.isArray(config))
			throw new ElasticSearchError('Invalid config', ElasticSearchError.codes.INVALID_CONFIG);

		this.config = {
			protocol: config.protocol || ES_DEFAULT_PROTOCOL,
			host: config.host || ES_DEFAULT_HOST,
			port: config.port || 9200,
			user: config.user || '',
			password: config.password || '',
			database: config.database || ES_DEFAULT_INDEX
		};

		this.config.host = this.config.host.replace(this.config.protocol, '');
	}

	/**
	 * Elasticsearch connection URL prefix
	 * @returns {String} Elasticsearch URL prefix
	*/
	get userPrefix() {
		return this.config && this.config.user ? `${this.config.user}:${this.config.password}@` : '';
	}

	/**
	 * Checks the connection to the Elasticsearch Client
	 * @returns {elasticsearch.Client} Elasticsearch client with the connection
	 * @throws if the connection is not successfull
	*/
	getClient() {
		if(!this.client) {
			try {
				this.client = new elasticsearch.Client({
					host: `${this.config.protocol}${this.userPrefix}${this.config.host}:${this.config.port}`
				});
			} catch(err) {
				throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
			}
		}
		return this.client;
	}

	validateFields(item) {
		if(!item.id)
			throw new ElasticSearchError('ID field is required', ElasticSearchError.codes.INVALID_QUERY);
	}

	/**
	 * Mini Query Builder :3
	 * @param {Object} filters pseudo mongodb filters
	 * @returns {Object} elasticsearch filters
	 */
	parseFilters(filters) {

		if(!filters)
			return {};

		const parsedFilters = Object.entries(filters).map(([key, value]) => {

			const result = { term: {} };

			if(key !== 'id') {
				if(!value.$in)
					key = `${key}.keyword`;
				else
					value = value.$in;
			}

			result.term[key] = value;

			return result;

		});

		return {
			query: {	bool: { must: parsedFilters } }
		};
	}

	/**
	 * Inserts data into elasticsearch
	 * @param {Model} model Model instance
	 * @param {Object} item item
	 * @returns {Boolean} true/false
	 */
	async insert(model, item) {

		if(!model)
			throw new ElasticSearchError('Invalid or empty model', ElasticSearchError.codes.INVALID_MODEL);

		this.validateFields(item);

		try {
			const client = this.getClient();
			const res = await client.create({
				index: model.constructor.table,
				id: item.id,
				body: item
			});

			return res.result === 'created';

		} catch(err) {
			throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
		}
	}

	/**
	 * Get data from elasticsearch
	 * @param {Model} model Model instance
	 * @param {Object} params parameters (limit, page, filters...)
	 * @returns {Array} elasticsearch result
	 */
	async get(model, params = {}) {

		if(!model)
			throw new ElasticSearchError('Invalid or empty model', ElasticSearchError.codes.INVALID_MODEL);

		const limit = params.limit || DEFAULT_LIMIT;
		const page = params.page || 1;
		const filters = params.filters ? this.parseFilters(params.filters) : {};

		try {
			const client = this.getClient();
			const res = await client.search({
				index: model.constructor.table,
				body: filters,
				from: (limit * page) - limit,
				size: limit
			});

			return res.hits.hits.map(item => item._source); // eslint-disable-line

		} catch(err) {
			throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
		}
	}
}

module.exports = ElasticSearch;
