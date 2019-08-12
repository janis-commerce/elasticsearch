'use strict';

const assert = require('assert');

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

		it('should return the elasticsearch query (mixed)', () => {

			const mixedFilters = {
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

			assert.deepStrictEqual(ElasticSearchFilters.getFilters(mixedFilters), {
				query: {
					bool: {
						must: [
							{ term: { 'field.raw': 'value' } },	{ term: { field: 'value' } },
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
							{ term: { 'field.raw': 'value' } }, { term: { field: 'value' } }
						]
					}
				}
			});
		});

		it('should ignore the $in and $nin terms when the values is not an array', async () => {

			const badFilters = {
				$in: 'not-array',
				$nin: 'not-array'
			};

			assert.deepStrictEqual(ElasticSearchFilters.getFilters(badFilters), {
				query: {
					bool: {
						must: [],
						must_not: []
					}
				}
			});

		});

		context('when the recieved filters are invalid', () => {

			it('should return an empty object when whe filters not exists', async () => {
				assert.deepStrictEqual(ElasticSearchFilters.getFilters(), {});
			});

			it('should return an empty object when whe filters is not an object', async () => {
				assert.deepStrictEqual(ElasticSearchFilters.getFilters('filters'), {});
			});

			it('should return an empty object when whe filters is an array', async () => {
				assert.deepStrictEqual(ElasticSearchFilters.getFilters(['filters']), {});
			});
		});
	});
});
