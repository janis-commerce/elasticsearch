'use strict';

const assert = require('assert');

const ElasticSearchFilters = require('../lib/elasticsearch-filters');

const ElasticSearchError = require('../lib/elasticsearch-error');

class Model {

	static get table() {
		return 'myTable';
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

describe('ElasticSearchFilters', () => {

	describe('getFilters()', () => {

		it('should return the elasticsearch query (term only)', () => {

			const termFilters = {
				id: 'value',
				$eq: {
					id: 'value'
				},
				$ne: {
					field: 'value'
				},
				$in: {
					field: ['value']
				},
				$nin: {
					field: ['value']
				}
			};

			assert.deepStrictEqual(ElasticSearchFilters.getFilters(model, termFilters), {
				query: {
					bool: {
						must: [
							{ term: { 'id.raw': 'value' } },	{ terms: { field: ['value'] } }
						],
						must_not: [
							{ term: { 'field.keyword': 'value' } }, { terms: { field: ['value'] } }
						]
					}
				}
			});
		});

		it('should return the elasticsearch query (range only)', () => {

			const rangeFilters = {
				$gt: {
					id: 1
				},
				$gte: {
					id: 1
				},
				$lt: {
					id: 1
				},
				$lte: {
					id: 1
				}
			};

			assert.deepStrictEqual(ElasticSearchFilters.getFilters(model, rangeFilters), {
				query: {
					range: {
						id: {
							gt: 1,
							gte: 1,
							lt: 1,
							lte: 1
						}
					}
				}
			});
		});

		it('should return the elasticsearch query (mixed)', () => {

			const mixedFilters = {
				$ne: {
					field: 'value'
				},
				$nin: {
					field: ['value']
				},
				$gt: {
					id: 1
				},
				$gte: {
					id: 1
				},
				$lt: {
					id: 1
				},
				$lte: {
					id: 1
				}
			};

			assert.deepStrictEqual(ElasticSearchFilters.getFilters(model, mixedFilters), {
				query: {
					bool: {
						must: [
							{
								range: {
									id: {
										gt: 1,
										gte: 1,
										lt: 1,
										lte: 1
									}
								}
							}
						],
						must_not: [
							{ term: { 'field.keyword': 'value' } }, { terms: { field: ['value'] } }
						]
					}
				}
			});
		});

		it('should throw \'Invalid filters\' when the $in terms values aren\'t an array', async () => {

			assert.throws(() => ElasticSearchFilters.getFilters(model, {
				$in: 'not-array'
			}), {
				name: 'ElasticSearchError',
				code: ElasticSearchError.codes.INVALID_FILTERS
			});

		});

		it('should throw \'Invalid filters\' when the $nin terms values aren\'t an array', async () => {

			assert.throws(() => ElasticSearchFilters.getFilters(model, {
				$nin: 'not-array'
			}), {
				name: 'ElasticSearchError',
				code: ElasticSearchError.codes.INVALID_FILTERS
			});

		});

		context('when the recieved filters are invalid', () => {

			it('should throw \'Invalid filter operator\' when any of the received operator not exists', async () => {

				assert.throws(() => ElasticSearchFilters.getFilters(model, {
					$eq: { field: 'value' },
					$eqq: { field: 'value' }
				}), {
					name: 'ElasticSearchError',
					code: ElasticSearchError.codes.INVALID_FILTER_OPERATOR
				});

			});

			it('should throw \'Invalid filters\' when the filters not exists', async () => {
				assert.throws(() => ElasticSearchFilters.getFilters(model), {
					name: 'ElasticSearchError',
					code: ElasticSearchError.codes.INVALID_FILTERS
				});
			});

			it('should throw \'Invalid filters\' when the filters is not an object', async () => {
				assert.throws(() => ElasticSearchFilters.getFilters(model, 'filters'), {
					name: 'ElasticSearchError',
					code: ElasticSearchError.codes.INVALID_FILTERS
				});
			});

			it('should throw \'Invalid filters\' when the filters is an array', async () => {
				assert.throws(() => ElasticSearchFilters.getFilters(model, ['filters']), {
					name: 'ElasticSearchError',
					code: ElasticSearchError.codes.INVALID_FILTERS
				});
			});
		});

		context('when the parent properties of the parsed filters not exists', () => {

			/* eslint-disable no-underscore-dangle */

			[
				ElasticSearchFilters._formatEq.bind(ElasticSearchFilters),
				ElasticSearchFilters._formatIn

			].forEach(formatter => {

				it('should create the bool property when not exists', () => {

					const parsedFilters = {};

					formatter(parsedFilters, 'field', ['value']);

					assert.strictEqual(typeof parsedFilters.bool, 'object');
				});

				it('should create the bool.must property when not exists', () => {

					const parsedFilters = {};

					formatter(parsedFilters, 'field', ['value']);

					assert.strictEqual(Array.isArray(parsedFilters.bool.must), true);
				});
			});

			[
				ElasticSearchFilters._formatNe.bind(ElasticSearchFilters),
				ElasticSearchFilters._formatNin

			].forEach(formatter => {

				it('should create the bool property when not exists', () => {

					const parsedFilters = {};

					formatter(parsedFilters, 'field', ['value']);

					assert.strictEqual(typeof parsedFilters.bool, 'object');
				});

				it('should create the bool.must_not property when not exists', () => {

					const parsedFilters = {};

					formatter(parsedFilters, 'field', ['value']);

					assert.strictEqual(Array.isArray(parsedFilters.bool.must_not), true);
				});
			});

			[
				ElasticSearchFilters._formatGt,
				ElasticSearchFilters._formatGte,
				ElasticSearchFilters._formatLt,
				ElasticSearchFilters._formatLte

			].forEach(formatter => {

				it('should create the range property when not exists', () => {

					const parsedFilters = {};

					formatter(parsedFilters, 'field', 'value');

					assert(typeof parsedFilters.range === 'object');
				});

				it('should create the range[field] property when not exists', async () => {

					const parsedFilters = {};

					formatter(parsedFilters, 'field', 'value');

					assert(typeof parsedFilters.range.field === 'object');

				});

			});

			/* eslint-enable no-underscore-dangle */

		});
	});
});
