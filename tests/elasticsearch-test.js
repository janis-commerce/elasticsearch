/* eslint-disable no-underscore-dangle */

'use strict';

const assert = require('assert');

const sandbox = require('sinon').createSandbox();

const elasticsearch = require('@elastic/elasticsearch');

const ElasticSearch = require('./../index');

const ElasticSearchError = require('./../lib/elasticsearch-error');

class Model {

	static get table() {
		return 'table';
	}

	static get sortableFields() {
		return {
			id: true,
			value: true,
			othervalue: { type: 'integer' }
		};
	}
}

const model = new Model();

const elastic = new ElasticSearch();

const expectedParamsBase = {
	index: model.constructor.table,
	type: '_doc',
	body: {}
};

const elasticStub = sandbox.stub();

const ElasticClientMock = function() {
	this.indices = elasticStub;
	this.create = elasticStub;
	this.bulk = elasticStub;
	this.search = elasticStub;
	this.count = elasticStub;
	this.updateByQuery = elasticStub;
	this.update = elasticStub;
	this.deleteByQuery = elasticStub;
};

describe('ElasticSearch', () => {

	beforeEach(() => {
		elasticsearch.Client = ElasticClientMock;
	});

	afterEach(() => {
		sandbox.reset();
	});

	after(() => {
		sandbox.restore();
	});

	describe('Constructor', () => {

		it('should throw when the config is not valid (not an object or array)', async () => {

			assert.throws(() => new ElasticSearch('config'), {
				name: 'ElasticSearchError',
				code: ElasticSearchError.codes.INVALID_CONFIG
			});

			assert.throws(() => new ElasticSearch(['config']), {
				name: 'ElasticSearchError',
				code: ElasticSearchError.codes.INVALID_CONFIG
			});
		});

		it('should get the protocol from the host url and set into the config when it exists', () => {

			const newElastic = new ElasticSearch({
				protocol: 'myprotocol://',
				host: 'urlprotocol://host.com'
			});

			assert(newElastic.config.protocol === 'urlprotocol://');
		});

		it('should use the specified protocol when the host url does not include it', () => {

			const newElastic = new ElasticSearch({
				protocol: 'protocol://',
				host: 'my-host.com'
			});

			assert(newElastic.config.protocol === 'protocol://');
		});
	});

	describe('_userPrefix', () => {

		it('should generate the user prefix for the elasticsearch URL path', async () => {

			elastic.config.user = 'user';
			elastic.config.password = 'password';

			assert.deepStrictEqual(elastic._userPrefix, 'user:password@');

		});

		it('should generate an empty user prefix when the user config is empty', async () => {

			elastic.config.user = '';
			assert.deepStrictEqual(elastic._userPrefix, '');
		});

	});

	describe('client', () => {

		it('should create the elasticsearch client using AWS', async () => {

			delete elastic._client;

			elastic.config.awsCredentials = true;

			const stub = sandbox.stub(elasticsearch, 'Client').returns({});

			assert.doesNotThrow(() => elastic.client);

			sandbox.assert.calledOnce(stub);
			sandbox.assert.calledWithMatch(stub, {
				amazonES: {
					credentials: {}
				},
				connectionClass: {}
			});
		});

		it('should create the elasticsearch client with specified port if exists', async () => {

			delete elastic._client;

			elastic.config.awsCredentials = false;
			elastic.config.port = 9300;

			const stub = sandbox.stub(elasticsearch, 'Client').returns({});

			assert.doesNotThrow(() => elastic.client);

			sandbox.assert.calledOnce(stub);
			sandbox.assert.calledWithMatch(stub, { node: 'http://localhost:9300' });
		});

		it('should throw when elasticsearch client fails', async () => {

			delete elastic._client;

			sandbox.stub(elasticsearch, 'Client').throws();

			assert.throws(() => elastic.client, {
				name: 'ElasticSearchError',
				code: ElasticSearchError.codes.ELASTICSEARCH_ERROR
			});
		});
	});

	describe('_validateModel()', () => {

		it('should throw an invalid model error with \'empty model\' message when the model not exists', async () => {

			assert.throws(() => elastic._validateModel(), {
				name: 'ElasticSearchError',
				message: 'Empty model',
				code: ElasticSearchError.codes.INVALID_MODEL
			});
		});

		it('should throw an invalid model error with \'invalid model\' message when the model is incomplete or bad formatted', async () => {

			assert.throws(() => elastic._validateModel({}), {
				name: 'ElasticSearchError',
				message: 'Invalid model',
				code: ElasticSearchError.codes.INVALID_MODEL
			});
		});

		it('should throw an invalid model error when the fields getter in the model is not valid', async () => {

			class OtherModel extends Model {
				static get sortableFields() {
					return ['field'];
				}
			}

			assert.throws(() => elastic._validateModel(new OtherModel()), {
				name: 'ElasticSearchError',
				code: ElasticSearchError.codes.INVALID_MODEL
			});
		});
	});

	describe('buildIndex()', () => {

		it('should create an index (if not exists) and put the mappings parsed from the model into it', async () => {

			elasticStub.exists = sandbox.stub().returns({ body: false });
			elasticStub.create = sandbox.stub();
			elasticStub.putMapping = sandbox.stub();

			await assert.doesNotReject(elastic.buildIndex(model));

			[elasticStub.exists, elasticStub.create].forEach(stub => {
				sandbox.assert.calledWithExactly(stub, { index: model.constructor.table });
				sandbox.assert.calledOnce(stub);
			});

			sandbox.assert.calledWithMatch(elasticStub.putMapping, { index: model.constructor.table, body: { properties: {} } });
		});

		it('should put the mappings parsed from the model into the specified index when it already exists', async () => {

			elasticStub.exists = sandbox.stub().returns({ body: true });
			elasticStub.putMapping = sandbox.stub();

			await assert.doesNotReject(elastic.buildIndex(model));

			sandbox.assert.calledWithExactly(elasticStub.exists, { index: model.constructor.table });
			sandbox.assert.calledOnce(elasticStub.exists);

			sandbox.assert.calledWithMatch(elasticStub.putMapping, { index: model.constructor.table, body: { properties: {} } });
		});

		it('should do nothing when the model doesn\'t have sortable fields', async () => {

			elasticStub.exists = sandbox.stub().returns({ body: false });
			elasticStub.create = sandbox.stub();
			elasticStub.putMapping = sandbox.stub();

			class OtherModel {
				static get table() {
					return 'table';
				}
			}

			await elastic.buildIndex(new OtherModel());

			[elasticStub.exists, elasticStub.create, elasticStub.putMapping].forEach(stub => {

				sandbox.assert.notCalled(stub);

			});

		});

		it('should throw elasticsearch error when any of the operations rejects', async () => {

			elasticStub.exists = sandbox.stub().rejects();

			await assert.rejects(elastic.buildIndex(model), {
				name: 'ElasticSearchError',
				code: ElasticSearchError.codes.ELASTICSEARCH_ERROR
			});
		});
	});

	describe('insert()', () => {

		it('should return the inserted item ID when the insert process item is successful', async () => {

			elasticStub.callsFake(params => {
				return {
					body: {
						_id: params.id
					}
				};
			});

			assert(await elastic.insert(model, { id: 1, item: 'value' }) === 1);

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should leave untouched the field dateCreated of the item when it already exists', async () => {

			elasticStub.callsFake(params => {
				return {
					body: {
						_id: params.id
					}
				};
			});

			assert(await elastic.insert(model, { id: 1, item: 'value', dateCreated: 'myDate' }));

			sandbox.assert.calledWithMatch(elasticStub, {
				...expectedParamsBase,
				body: {
					id: 1,
					item: 'value',
					dateCreated: 'myDate'
				}
			});
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should return false when the insert process fails', async () => {

			elasticStub.returns({
				body: {
					result: 'error'
				}
			});

			assert(!await elastic.insert(model, { item: 'value' }));

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should return false when the insert process rejects', async () => {

			elasticStub.rejects();

			await assert(elastic.insert(model, { item: 'value' }), false);

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should throw when the insert process rejects due a duplicated ID field', async () => {

			elasticStub.rejects(new Error('version_conflict_engine_exception'));

			await assert.rejects(elastic.insert(model, { item: 'value' }), {
				name: 'ElasticSearchError',
				code: ElasticSearchError.codes.INVALID_QUERY
			});

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});
	});

	describe('multiInsert', () => {

		it('should return true when bulk insert process is successful', async () => {

			elasticStub.returns({
				errors: false
			});

			assert(await elastic.multiInsert(model, [{ id: 1, value: 'something' }, { id: 2, value: 'something' }]));

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should leave untouched the field dateCreated of the item when it already exists', async () => {

			elasticStub.returns({
				body: {
					errors: false
				}
			});

			assert(await elastic.multiInsert(model, { value: 'foobar', dateCreated: 'myDate' }));

			sandbox.assert.calledWithMatch(elasticStub, {
				...expectedParamsBase,
				refresh: 'wait_for',
				body: [
					{ index: sandbox.match.object },
					{
						dateCreated: 'myDate',
						id: sandbox.match.string,
						value: 'foobar'
					}
				]
			});
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should return false when bulk insert process fails', async () => {

			elasticStub.returns({
				errors: true
			});

			assert(!await elastic.multiInsert(model, [{ id: 1, value: 'something' }]));

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should return false when bulk insert process rejects', async () => {

			elasticStub.rejects();

			assert(!await elastic.multiInsert(model, [{ id: 1, value: 'something' }]));

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should throw elasticsearch error when bulk insert process rejects due a duplicated ID field', async () => {

			elasticStub.rejects(new Error('version_conflict_engine_exception'));

			await assert.rejects(elastic.multiInsert(model, [{ id: 1, value: 'something' }]), {
				name: 'ElasticSearchError',
				code: ElasticSearchError.codes.INVALID_QUERY
			});

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});
	});

	describe('get()', () => {

		it('should return the items array when search process is successful without params', async () => {

			elasticStub.returns({
				body: {
					hits: {
						hits: [
							{ _source: { id: 1, value: 'somevalue', othervalue: 2 } },
							{ _source: { id: 2, value: 'someothervalue', othervalue: 4 } }
						]
					}
				}
			});

			const result = await elastic.get(model);

			assert(Array.isArray(result) && result.length === 2);

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should return the items array when search process is successful with params and filters', async () => {

			elasticStub.returns({
				body: {
					hits: {
						hits: [
							{ _source: { id: 3, value: 'foobar 3', othervalue: 1 } },
							{ _source: { id: 4, value: 'foobar 4', othervalue: 1 } }
						]
					}
				}
			});

			const result = await elastic.get(model, {
				limit: 2,
				page: 2,
				order: {
					value: 'asc'
				},
				filters: {
					value: { $in: ['foobar'] },
					othervalue: { $in: 1 }
				}
			});

			assert(
				Array.isArray(result)
				&& result.length === 2
				&& result[0].id === 3
			);

			sandbox.assert.calledWithMatch(elasticStub, {
				...expectedParamsBase,
				from: 2,
				size: 2
			});
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should throw elasticsearch error when the search process rejects', async () => {

			elasticStub.rejects();

			await assert.rejects(elastic.get(model), {
				name: 'ElasticSearchError',
				code: ElasticSearchError.codes.ELASTICSEARCH_ERROR
			});

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});
	});

	describe('getTotals()', () => {

		it('should return the totals object with paging info', async () => {

			model.lastQueryEmpty = false;
			delete model.totalsParams;

			elasticStub.returns({
				body: {
					count: 1
				}
			});

			assert.deepEqual(await elastic.getTotals(model), {
				total: 1,
				pageSize: 500,
				pages: 1,
				page: 1
			});

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should return the totals using the last available page if the specified page not exists', async () => {

			model.lastQueryEmpty = false;
			model.totalsParams = {
				limit: 1,
				page: 3,
				filters: {
					field: 'value'
				}
			};

			elasticStub.returns({
				body: {
					count: 2
				}
			});

			assert.deepStrictEqual(await elastic.getTotals(model), {
				total: 2,
				pageSize: 1,
				pages: 2,
				page: 2
			});

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should return default totals without calling count method if the latest get was empty', async () => {

			model.lastQueryEmpty = true;

			assert.deepStrictEqual(await elastic.getTotals(model), { total: 0, pages: 0 });

			sandbox.assert.notCalled(elasticStub);
		});

		it('should throw elasticsearch error when the count process rejects', async () => {

			model.lastQueryEmpty = false;

			elasticStub.rejects();

			await assert.rejects(elastic.getTotals(model));

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});
	});

	describe('update()', () => {

		it('should return updated count when the update process is successful', async () => {

			elasticStub.returns({
				body: {
					updated: 5
				}
			});

			assert(await elastic.update(model, {
				value: 'mynewvalue',
				othervalue: 5,
				anothervalue: ['some', 'array']
			}, { id: 1 }) === 5);

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should throw elasticsearch error when the update process fails', async () => {

			elasticStub.rejects();

			await assert.rejects(elastic.update(model, { value: 'mynewvalue' }, { value: 'myoldvalue' }), {
				name: 'ElasticSearchError',
				code: ElasticSearchError.codes.ELASTICSEARCH_ERROR
			});

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});
	});

	describe('save()', () => {

		it('should return true when the upsert process is sucessful', async () => {

			elasticStub.callsFake(params => {
				return {
					body: {
						_id: params.id
					}
				};
			});

			assert(await elastic.save(model, { value: 'foobar' }));

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should leave untouched the field dateCreated of the item when it already exists', async () => {

			elasticStub.callsFake(params => {
				return {
					body: {
						_id: params.id
					}
				};
			});

			assert(await elastic.save(model, { value: 'foobar', dateCreated: 'myDate' }));

			sandbox.assert.calledWithMatch(elasticStub, {
				...expectedParamsBase,
				body: {
					upsert: {
						value: 'foobar',
						dateCreated: 'myDate'
					}
				}
			});
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should return false when the upsert process fails', async () => {

			elasticStub.returns({
				body: {
					result: ''
				}
			});

			assert(!await elastic.save(model, { value: 'foobar' }));

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should return false when the upsert process rejects', async () => {

			elasticStub.rejects();

			assert(!await elastic.save(model, { value: 'foobar' }));

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});
	});

	describe('multiSave()', () => {

		it('should return true when the bulk upsert process is sucessful', async () => {

			elasticStub.returns({
				body: {
					errors: false
				}
			});

			assert(await elastic.multiSave(model, [{ value: 'foobar' }, { value: 'sarasa' }]));

			sandbox.assert.calledWithMatch(elasticStub, { index: model.constructor.table, refresh: 'wait_for' });
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should leave untouched the field dateCreated of the item when it already exists', async () => {

			elasticStub.returns({
				body: {
					errors: false
				}
			});

			assert(await elastic.multiSave(model, { value: 'foobar', dateCreated: 'myDate' }));

			sandbox.assert.calledWithMatch(elasticStub, {
				index: model.constructor.table,
				refresh: 'wait_for',
				body: [
					{ update: sandbox.match.object },
					{
						doc: sandbox.match.object,
						upsert: {
							dateCreated: 'myDate',
							id: sandbox.match.string,
							value: 'foobar'
						}
					}
				]
			});
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should return false when the bulk upsert process fails', async () => {

			elasticStub.returns({
				body: {
					errors: true
				}
			});

			assert(!await elastic.multiSave(model, [{ value: 'foobar' }]));

			sandbox.assert.calledWithMatch(elasticStub, { index: model.constructor.table, refresh: 'wait_for' });
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should return false when the bulk upsert process rejects', async () => {

			elasticStub.rejects();

			assert(!await elastic.multiSave(model, [{ value: 'foobar' }]));

			sandbox.assert.calledWithMatch(elasticStub, { index: model.constructor.table, refresh: 'wait_for' });
			sandbox.assert.calledOnce(elasticStub);
		});
	});

	describe('remove()', () => {

		it('should return deleted count when the remove process is successful', async () => {

			elasticStub.returns({
				body: {
					deleted: 5
				}
			});

			assert(await elastic.remove(model, { value: 'foobar' }) === 5);

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});

		it('should throw elasticsearch error when the remove process rejects', async () => {

			elasticStub.rejects();

			await assert.rejects(elastic.remove(model, {}), {
				name: 'ElasticSearchError',
				code: ElasticSearchError.codes.ELASTICSEARCH_ERROR
			});

			sandbox.assert.calledWithMatch(elasticStub, expectedParamsBase);
			sandbox.assert.calledOnce(elasticStub);
		});
	});

	describe('_prepareFields()', () => {

		it('should generate the id field of an item when it not exists', () => {

			sandbox.assert.match(
				elastic._prepareFields({ field: 'value' }),
				{
					id: sandbox.match.string,
					field: 'value'
				}
			);

		});

		it('should return an array when recieves multiple items', async () => {

			sandbox.assert.match(
				elastic._prepareFields([
					{ id: 1, field: 'value' },
					{ field: 'value' }
				]),
				[
					{ id: 1, field: 'value' },
					{ id: sandbox.match.string, field: 'value' }
				]
			);

		});

	});

	describe('_getMappingsFromModel()', () => {

		it('should get the fields from the model and convert it into an elasticsearch mapping query', async () => {

			class OtherModel extends Model {
				static get sortableFields() {
					return {
						value: { type: 'text' },
						dateCreated: true
					};
				}
			}

			sandbox.assert.match(elastic._getMappingsFromModel(new OtherModel()), {
				properties: {
					value: {
						type: 'text',
						fields: {
							raw: {
								type: 'keyword'
							}
						}
					},
					dateCreated: {
						type: 'text'
					}
				}
			});
		});
	});

});
