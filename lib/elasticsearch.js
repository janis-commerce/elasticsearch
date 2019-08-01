'use strict';

const AWS = require('aws-sdk');
const AWSESConnection = require('http-aws-es');

const elasticsearch = require('@elastic/elasticsearch');
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
			port: config.port || '',
			user: config.user || '',
			password: config.password || '',
			database: config.database || ES_DEFAULT_INDEX,
			limit: config.limit || DEFAULT_LIMIT,
			aws: config.aws || false
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
					node: `${this.config.protocol}${this.userPrefix}${this.config.host}${this.config.port ? `:${this.config.port}` : ''}`,
					...this.config.aws ? { connectionClass: AWSESConnection, amazonES: { credentials: new AWS.EnvironmentCredentials('AWS') } } : {}
				});
			} catch(err) {
				throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
			}
		}
		return this.client;
	}

	async buildIndex(model) {

		if(!model)
			throw new ElasticSearchError('Invalid or empty model', ElasticSearchError.codes.INVALID_MODEL);

		try {

			const client = this.getClient();
			const exists = await client.indices.exists({ index: model.constructor.table });

			if(!exists.body)
				await client.indices.create({ index: model.constructor.table });

			await client.indices.close({ index: model.constructor.table });

			await client.indices.putMapping({
				index: model.constructor.table,
				type: '_doc',
				body: this.getMappingsFromModel(model)
			});

			await client.indices.open({ index: model.constructor.table });

		} catch(err) {
			throw err;
		}

	}

	getMappingsFromModel(model) {

		if(!model)
			throw new ElasticSearchError('Invalid or empty model', ElasticSearchError.codes.INVALID_MODEL);

		const parsedMappings = { properties: {} };

		if(Array.isArray(model.constructor.fields)) {

			for(const field of model.constructor.fields) {

				if(typeof field === 'object' && !Array.isArray(field)) {
					Object.entries(field).forEach(([key, value]) => {
						parsedMappings.properties[key] = {
							type: value,
							fields: {
								sort: {
									type: value
								}
							}
						};
					});
					continue;
				}

				parsedMappings.properties[field] = {
					type: 'text',
					fields: {
						sort: {
							type: 'text'
						}
					}
				};
			}

			return parsedMappings;
		}
	}

	/**
	 * Validate the items for elasticsearch operations
	 * @param {Array} items items
	 * @throws if any of the items is invalid
	 */
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
				if(!value.$in)
					key = `${key}.keyword`;
				else
					value = value.$in;
			}

			result.term[key] = value;

			return result;
		});

		return {
			query: { bool: { must: parsedFilters } }
		};
	}

	/**
	 * Parse the item into elasticsearch script string for updates
	 * @param {Object} item item
	 * @returns {Object} parsed item for updates
	 */
	parseValuesForUpdate(item) {

		if(!item)
			return {};

		let parsedItem = '';

		Object.entries(item).forEach(([key, value]) => {
			parsedItem += `ctx._source.${key}='${value}';`;
		});

		parsedItem += `ctx._source.lastModified='${new Date().toISOString()}';`;

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

			parsedItems.push(
				{ index: {	_id: item.id }	},
				{ ...item,	dateCreated: new Date()	}
			);

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

			parsedItems.push(
				{ update: { _id: item.id, _type: '_doc' } },
				{
					doc: { ...item, lastModified: new Date() },
					upsert: { ...item, dateCreated: new Date() }
				}
			);

		}

		return parsedItems;
	}

	parseSortingParams(order) {

		const parsedSorting = Object.entries(order).map(([key, value]) => {

			return {
				[`${key}.sort`]: value
			};

		});

		return { sort: parsedSorting };
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

		item.dateCreated = new Date();

		try {
			const client = this.getClient();
			const res = await client.index({
				index: model.constructor.table,
				type: '_doc',
				id: item.id,
				refresh: 'wait_for',
				body: item
			});

			return res.body.result === 'created';

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
				type: '_doc',
				refresh: 'wait_for',
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
				type: '_doc',
				body: {
					...filters,
					...order
				},
				from: (limit * page) - limit,
				size: limit
			});

			model.lastQueryEmpty = !res.body.hits.total;
			model.totalsParams = { ...params };

			return res.body.hits.hits.map(item => item._source); // eslint-disable-line

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
				type: '_doc',
				body: filters
			});

			const result = {
				total: res.body.count,
				pageSize: params.limit || this.config.limit,
				pages: params.limit ? Math.ceil(res.body.count / params.limit) : 1,
				page: params.page || 1
			};

			if(result.page > result.pages)
				result.page = result.pages;

			return result;

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
				refresh: true,
				type: '_doc',
				body: {
					...this.parseFilters(filters),
					...this.parseValuesForUpdate(values)
				}
			});

			return res.body.updated;

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
				type: '_doc',
				id: item.id,
				refresh: 'wait_for',
				body: {
					doc: { ...item,	lastModified: new Date() },
					upsert: { ...item,	dateCreated: new Date() }
				}

			});

			return res.body.result === 'created' || res.body.result === 'updated';

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
				refresh: 'wait_for',
				body: this.parseItemsForBulkUpsert(items)
			});

			return !res.body.errors;

		} catch(err) {
			throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
		}
	}

	/**
	 * Removes the item/items that match the filters
	 * @param {Model} model Model instance
	 * @param {Object} filters filters
	 * @returns {Number} deleted count
	 */
	async remove(model, filters) {

		if(!model)
			throw new ElasticSearchError('Invalid or empty model', ElasticSearchError.codes.INVALID_MODEL);

		try {
			const client = this.getClient();
			const res = await client.deleteByQuery({
				index: model.constructor.table,
				type: '_doc',
				refresh: true,
				body: {
					...this.parseFilters(filters)
				}
			});

			return res.body.deleted;

		} catch(err) {
			throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
		}
	}
}

module.exports = ElasticSearch;
