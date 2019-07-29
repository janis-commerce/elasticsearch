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
			database: config.database || ES_DEFAULT_INDEX,
			limit: config.limit || DEFAULT_LIMIT
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

	validateFields(items) {

		if(!Array.isArray(items))
			items = [items];

		for(const item of items) {

			if(!item.id)
				throw new ElasticSearchError('ID field is required', ElasticSearchError.codes.INVALID_QUERY);

		}
	}

	/**
	 * Parse the filters into elasticsearch filters
	 * @param {Object} filters filters
	 * @returns {Object} elasticsearch filters
	 */
	parseFilters(filters) {

		if(!filters)
			return {};

		const parsedFilters = Object.entries(filters).map(([key, value]) => {

			const result = { term: {} };

			if(key !== 'id') {
				if(!value.search)
					key = `${key}.keyword`;
				else
					value = value.search;
			}

			result.term[key] = value;

			return result;

		});

		return {
			query: {	bool: { must: parsedFilters } }
		};
	}

	/**
	 * Parse the item into elasticsearch script string for updates
	 * @param {Object} item item
	 * @returns {Object} parsed item for updates
	 */
	parseItemForUpdate(item) {

		if(!item)
			return {};

		let parsedItem = '';

		Object.entries(item).forEach(([key, value]) => {
			parsedItem += `ctx._source.${key} = '${value}';`;
		});

		return { script: parsedItem };
	}

	/**
	 * Converts the items array into a multi insert bulk query for elasticsearch
	 * @param {Array} items items
	 * @returns {Array} parsed items
	 */
	parseItemsForBulkInsert(items) {

		if(!Array.isArray(items))
			items = [items];

		const parsedItems = [];

		for(const item of items) {

			parsedItems.push({
				index: {
					_id: item.id
				}
			},
			{ ...item });

		}

		return parsedItems;
	}

	/**
	 * Converts the items array into a multi upsert bulk query for elasticsearch
	 * @param {Array} items items
	 * @returns {Array} parsed items
	 */
	parseItemsForBulkUpsert(items) {

		if(!Array.isArray(items))
			items = [items];

		const parsedItems = [];

		for(const item of items) {

			parsedItems.push({
				update: {
					_id: item.id
				}
			},
			{ doc: item, doc_as_upsert: true });

		}

		return parsedItems;
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
	 * Inserts multiple items into elasticsearch
	 * @param {Model} model Model instance
	 * @param {Array} items items
	 * @returns {Boolean} true/false
	 */
	async multiInsert(model, items) {

		if(!model)
			throw new ElasticSearchError('Invalid or empty model', ElasticSearchError.codes.INVALID_MODEL);

		this.validateFields(items);

		try {
			const client = this.getClient();
			const res = await client.bulk({
				index: model.constructor.table,
				body: this.parseItemsForBulkInsert(items)
			});

			return !res.errors;

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

		const limit = params.limit || this.config.limit;
		const page = params.page || 1;
		const filters = params.filters ? this.parseFilters(params.filters) : {};
		const order = params.order ? this.parseSortingParams(params.order) : {};

		try {
			const client = this.getClient();
			const res = await client.search({
				index: model.constructor.table,
				body: filters,
				from: (limit * page) - limit,
				size: limit
			});

			model.lastQueryEmpty = !res.hits.total.value;
			model.totalsParams = { ...params };

			return res.hits.hits.map(item => item._source); // eslint-disable-line

		} catch(err) {
			throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
		}
	}

	async update(model, values, filters) {

		if(!model)
			throw new ElasticSearchError('Invalid or empty model', ElasticSearchError.codes.INVALID_MODEL);

		try {
			const client = this.getClient();
			const res = await client.updateByQuery({
				index: model.constructor.table,
				body: {
					...this.parseFilters(filters),
					...this.parseItemForUpdate(values)
				}
			});

			return res.updated;

		} catch(err) {
			throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
		}
	}

	async save(model, item) {

		if(!model)
			throw new ElasticSearchError('Invalid or empty model', ElasticSearchError.codes.INVALID_MODEL);

		this.validateFields(item);

		try {
			const client = this.getClient();
			const res = await client.update({
				index: model.constructor.table,
				id: item.id,
				body: {
					doc: item,
					doc_as_upsert: true
				}

			});

			return res.result === 'created' || res.result === 'updated';

		} catch(err) {
			throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
		}
	}

	async multiSave(model, items) {

		if(!model)
			throw new ElasticSearchError('Invalid or empty model', ElasticSearchError.codes.INVALID_MODEL);

		this.validateFields(items);

		try {
			const client = this.getClient();
			const res = await client.bulk({
				index: model.constructor.table,
				body: this.parseItemsForBulkUpsert(items)
			});

			return !res.errors;

		} catch(err) {
			throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
		}
	}

	async remove(model, filters) {

		if(!model)
			throw new ElasticSearchError('Invalid or empty model', ElasticSearchError.codes.INVALID_MODEL);

		try {
			const client = this.getClient();
			const res = await client.deleteByQuery({
				index: model.constructor.table,
				body: {
					...this.parseFilters(filters)
				}
			});

			return res.deleted;

		} catch(err) {
			throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
		}
	}

	async getTotals(model) {

		if(!model)
			throw new ElasticSearchError('Invalid or empty model', ElasticSearchError.codes.INVALID_MODEL);

		if(model.lastQueryEmpty)
			return { total: 0, pages: 0 };

		const params = model.totalsParams || { filters: {} };

		const filters = params.filters ? this.parseFilters(params.filters) : {};

		try {
			const client = this.getClient();
			const res = await client.count({
				index: model.constructor.table,
				body: {
					...filters
				}
			});

			const result = {
				total: res.count,
				pageSize: params.limit || this.config.limit,
				pages: params.limit ? Math.ceil(res.count / params.limit) : 1,
				page: params.page || 1
			};

			if(result.page > result.pages)
				result.page = result.pages;

			return result;

		} catch(err) {
			throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
		}
	}
}

module.exports = ElasticSearch;
