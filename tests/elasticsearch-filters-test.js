'use strict';

const assert = require('assert');

const sandbox = require('sinon').createSandbox();

const ElasticSearchFilters = require('./../lib/elasticsearch-filters');

describe('ElasticSearchFilters', () => {

	describe('getFilters()', () => {

		it('should return the elasticsearch query (term only)', () => {

			const termFilters = {
				field: 'value',
				$eq: {
					field: 'value'
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

			assert.deepStrictEqual(ElasticSearchFilters.getFilters(termFilters), {
				query: {
					bool: {
						must: [
							{ term: { 'field.raw': 'value' } },	{ term: { field: 'value' } }
						],
						must_not: [
							{ term: { 'field.raw': 'value' } }, { term: { field: 'value' } }
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

			assert.deepStrictEqual(ElasticSearchFilters.getFilters(rangeFilters), {
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


	});

});
