'use strict';

const AWS = require('aws-sdk');

const AWSESConnection = require('http-aws-es');

const { URL } = require('url');

const UUID = require('uuid/v4');

const elasticsearch = require('elasticsearch');

const ElasticSearchFilters = require('./elasticsearch-filters');
const ElasticSearchError = require('./elasticsearch-error');

const DEFAULT_LIMIT = 500;
const ES_DEFAULT_HOST = 'http://localhost';

function convertToSnakeCase(str) {
	return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * @class ElasticSearch
 * @classdesc Elasticsearch driver module
*/
class ElasticSearch {

	constructor(config = {}) {
		if(typeof config !== 'object' || Array.isArray(config))
			throw new ElasticSearchError('Invalid config', ElasticSearchError.codes.INVALID_CONFIG);

		this.config = {
			protocol: config.protocol || '',
			host: config.host || ES_DEFAULT_HOST,
			port: config.port || '',
			user: config.user || '',
			password: config.password || '',
			limit: config.limit || DEFAULT_LIMIT,
			awsCredentials: config.awsCredentials || false
		};

		try {

			const url = new URL(this.config.host); // throws if the URL doesn't have a protocol
			this.config.protocol = `${url.protocol}//`;
			this.config.host = url.host;

		} catch(err) {
			// do nothing...
		}
	}

	/**
	 * AWS Credentials config for Elasticsearch
	 * @returns {Object} AWS connection config
	 */
	get _awsCredentials() {

		if(!this.config.awsCredentials)
			return {};

		AWS.config.update({
			credentials: new AWS.EnvironmentCredentials('AWS'),
			region: process.env.AWS_DEFAULT_REGION
		});

		return {
			connectionClass: AWSESConnection
		};
	}

	/**
	 * Elasticsearch connection URL prefix
	 * @returns {String} Elasticsearch URL prefix
	*/
	get _userPrefix() {
		return this.config.user ? `${this.config.user}:${this.config.password}@` : '';
	}

	/**
	 * Checks the connection to the Elasticsearch Client
	 * @returns {elasticsearch.Client} Elasticsearch client with the connection
	 * @throws if the connection is not successfull
	*/
	get client() {

		if(!this._client) {
			try {
				this._client = new elasticsearch.Client({
					host: `${this.config.protocol}${this._userPrefix}${this.config.host}${this.config.port ? `:${this.config.port}` : ''}`,
					...this._awsCredentials
				});
			} catch(err) {
				throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
			}
		}

		return this._client;
	}

	/**
	 * Validates the model structure
	 * @param {Model} model Model instance
	 * @throws If the model is invalid
	 */
	_validateModel(model) {

		if(!model)
			throw new ElasticSearchError('Empty model', ElasticSearchError.codes.INVALID_MODEL);

		if(!model.constructor.table)
			throw new ElasticSearchError('Invalid model', ElasticSearchError.codes.INVALID_MODEL);

		if(model.constructor.sortableFields && (typeof model.constructor.sortableFields !== 'object' || Array.isArray(model.constructor.sortableFields))) {
			throw new ElasticSearchError('Invalid sortable fields, it must be an object. See model.constructor.sortableFields',
				ElasticSearchError.codes.INVALID_MODEL);
		}

	}

	_getIndex(model) {
		return convertToSnakeCase(model.constructor.table);
	}

	/**
	 * Build elasticsearch index with mappings for sortings
	 * @param {Model} model Model instance
	 */
	async buildIndex(model) {

		if(!model.constructor.sortableFields)
			return;

		this._validateModel(model);

		try {

			const exists = await this.client.indices.exists({ index: this._getIndex(model) });

			if(!exists)
				await this.client.indices.create({ index: this._getIndex(model) });

			await this.client.indices.putMapping({
				index: this._getIndex(model),
				body: this._getMappingsFromModel(model)
			});

		} catch(err) {
			throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
		}
	}

	/**
	 * Analyses the model fields and build the mappings query for elasticsearch
	 * @param {Model} model Model instance
	 * @returns {Object} elasticsearch mappings query
	 */
	_getMappingsFromModel(model) {

		const properties = {};

		const sortableFields = { ...model.constructor.sortableFields };

		if(!sortableFields.id)
			sortableFields.id = true;

		if(!sortableFields.dateCreated)
			sortableFields.dateCreated = { type: 'date' };

		if(!sortableFields.dateModified)
			sortableFields.dateModified = { type: 'date' };

		const fields = Object.keys(sortableFields);

		for(const field of fields) {

			const fieldType = sortableFields[field].type || 'text';

			properties[field] = {
				type: fieldType,
				fields: {
					raw: {
						type: fieldType === 'text' ? 'keyword' : fieldType
					}
				}
			};
		}

		return { properties };
	}

	/**
	 * Prepare the items for elasticsearch operations
	 * @param {Array} items items
	 * @returns {Array|Object} item/items with prepared fields
	 */
	_prepareFields(items) {

		if(!Array.isArray(items))
			items = [items];

		for(const item of items) {

			if(!item.id)
				item.id = UUID();

		}

		if(items.length === 1)
			return items[0];
		return items;
	}

	/**
	 * Parse the item into elasticsearch script string for updates
	 * @param {Object} item item
	 * @returns {Object} parsed item for updates
	 */
	_parseValuesForUpdate(item) {

		let parsedItem = '';

		Object.entries(item).forEach(([key, value]) => {

			switch(typeof value) {

				case 'string':
					parsedItem += `ctx._source.${key}='${value}';`;
					break;

				case 'object':
					parsedItem += `ctx._source.${key}=${JSON.stringify(value)};`;
					break;

				default:
					parsedItem += `ctx._source.${key}=${value};`;
			}

		});

		parsedItem += `ctx._source.dateModified='${new Date().toISOString()}';`;

		return { script: parsedItem };
	}

	/**
	 * Converts the items array into a multi insert bulk query for elasticsearch
	 * @param {Array} items items
	 * @returns {Array} parsed items
	 */
	_parseItemsForBulkInsert(items) {

		if(!Array.isArray(items))
			items = [items];

		const parsedItems = [];

		for(const item of items) {

			parsedItems.push(
				{ index: { _id: item.id } },
				{
					...item,
					...!item.dateCreated ? { dateCreated: new Date() } : {}
				}
			);

		}

		return parsedItems;
	}

	/**
	 * Converts the items array into a multi upsert bulk query for elasticsearch
	 * @param {Array} items items
	 * @returns {Array} parsed items
	 */
	_parseItemsForBulkUpsert(items) {

		if(!Array.isArray(items))
			items = [items];

		const parsedItems = [];

		for(const item of items) {

			parsedItems.push(
				{ update: { _id: item.id, _type: '_doc' } },
				{
					doc: { ...item, dateModified: new Date() },
					upsert: {
						...item,
						...!item.dateCreated ? { dateCreated: new Date() } : {}
					}
				}
			);

		}

		return parsedItems;
	}

	/**
	 * Parse the order params into a sort query for elasticsearch
	 * @param {Object} order order params
	 * @returns {Object} parsed sort query
	 */
	_parseSortingParams(order) {

		const parsedSorting = Object.entries(order).map(([key, value]) => {

			return {
				[`${key}.raw`]: value
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

		this._validateModel(model);
		item = this._prepareFields(item);


		if(!item.dateCreated)
			item.dateCreated = new Date();

		try {
			const res = await this.client.create({
				index: this._getIndex(model),
				type: '_doc',
				id: item.id,
				refresh: 'wait_for',
				body: item
			});

			return res._id; // eslint-disable-line

		} catch(err) {
			if(err.message === 'version_conflict_engine_exception')
				throw new ElasticSearchError('Duplicated ID field', ElasticSearchError.codes.INVALID_QUERY);

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

		this._validateModel(model);
		items = this._prepareFields(items);

		try {
			const res = await this.client.bulk({
				index: this._getIndex(model),
				type: '_doc',
				refresh: 'wait_for',
				body: this._parseItemsForBulkInsert(items)
			});

			return !res.errors;

		} catch(err) {
			if(err.message === 'version_conflict_engine_exception')
				throw new ElasticSearchError('Duplicated ID field', ElasticSearchError.codes.INVALID_QUERY);

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

		this._validateModel(model);

		const limit = params.limit || this.config.limit;
		const page = params.page || 1;
		const filters = params.filters ? ElasticSearchFilters.getFilters(params.filters) : {};
		const order = params.order ? this._parseSortingParams(params.order) : {};

		try {
			const res = await this.client.search({
				index: this._getIndex(model),
				type: '_doc',
				body: {
					...filters,
					...order
				},
				from: limit * (page - 1),
				size: limit
			});

			model.lastQueryEmpty = !res.hits.total;
			model.totalsParams = params;

			return res.hits.hits.map(item => item._source); // eslint-disable-line

		} catch(err) {
			throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
		}
	}

	/**
	 * Get the paginated totals from latest get query.
	 * @param {Model} model Model instance
	 * @returns {Object} total, page size, pages and page from the results.
	 */
	async getTotals(model) {

		this._validateModel(model);

		if(model.lastQueryEmpty)
			return { total: 0, pages: 0 };

		const params = model.totalsParams || {};

		const filters = params.filters ? params.filters : {};

		try {
			const res = await this.client.count({
				index: this._getIndex(model),
				type: '_doc',
				body: filters
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

	/**
	 * Updates data into the database
	 * @param {Model} model Model instance
	 * @param {Object} values values to apply
	 * @param {Object} filter filters
	 * @returns {Number} modified count
	 */
	async update(model, values, filters) {

		this._validateModel(model);

		try {
			const res = await this.client.updateByQuery({
				index: this._getIndex(model),
				refresh: true,
				type: '_doc',
				body: {
					...ElasticSearchFilters.getFilters(filters),
					...this._parseValuesForUpdate(values)
				}
			});

			return res.updated;

		} catch(err) {
			throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
		}
	}

	/**
	 * Insert/update one element into the database
	 * @param {Model} model Model instance
	 * @param {Object} item item
	 * @returns {Boolean} true/false
	 */
	async save(model, item) {

		this._validateModel(model);
		item = this._prepareFields(item);

		try {
			const res = await this.client.update({
				index: this._getIndex(model),
				type: '_doc',
				id: item.id,
				refresh: 'wait_for',
				body: {
					doc: { ...item, dateModified: new Date() },
					upsert: {
						...item,
						...!item.dateCreated ? { dateCreated: new Date() } : {}
					}
				}

			});

			return res._id; // eslint-disable-line

		} catch(err) {
			throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
		}
	}

	/**
	 * Multi insert/update items into the dabatase
	 * @param {Model} model Model instance
	 * @param {Array} items items
	 * @param {Number} limit specifies the limit of items that can be bulk writed into monogdb at the same time
	 * @returns {Boolean} true/false
	 */
	async multiSave(model, items) {

		this._validateModel(model);
		items = this._prepareFields(items);

		try {
			const res = await this.client.bulk({
				index: this._getIndex(model),
				refresh: 'wait_for',
				body: this._parseItemsForBulkUpsert(items)
			});

			return !res.errors;

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

		this._validateModel(model);

		try {
			const res = await this.client.deleteByQuery({
				index: this._getIndex(model),
				type: '_doc',
				refresh: true,
				body: {
					...ElasticSearchFilters.getFilters(filters)
				}
			});

			return res.deleted;

		} catch(err) {
			throw new ElasticSearchError(err.message, ElasticSearchError.codes.ELASTICSEARCH_ERROR);
		}
	}
}

module.exports = ElasticSearch;
