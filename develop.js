/* eslint-disable no-console */

'use strict';

const ElasticSearch = require('./index');

class Model {

	static get table() {
		return 'table';
	}

	static get fields() {
		return [
			'name',
			{ patent: 'integer' },
			'country'
		];
	}

}

const model = new Model();

const elastic = new ElasticSearch({
	port: 9200
});

(async () => {

	console.log(
		'buildIndex',
		await elastic.buildIndex(model)
	);

	console.log(
		'insert',
		await elastic.insert(model, {
			id: 1, name: 'Edward Sanchez', patent: 112421, country: 'USA'
		}),
		await elastic.get(model)
	);

	console.log(
		'multiInsert',
		await elastic.multiInsert(model, [
			{
				id: 2, name: 'Mario Bustamante', patent: 112725, country: 'ESP'
			},
			{
				id: 3, name: 'Mario Simonelli', patent: 1744587, country: 'ITA'
			}
		]),
		await elastic.get(model)
	);

	console.log(
		'get all',
		await elastic.get(model)
	);

	console.log(
		'get with sort',
		await elastic.get(model, { order: { name: 'asc' } })
	);

	console.log(
		'get with filters',
		await elastic.get(model, { filters: { name: 'Mario Simonelli' } })
	);

	console.log(
		'get with /filters/',
		await elastic.get(model, { filters: { name: { $in: 'Mario' } } })
	);

	console.log(
		'get with paging',
		await elastic.get(model, { limit: 1, page: 2 })
	);

	console.log(
		'get totals',
		await elastic.getTotals(model)
	);

	console.log(
		'save',
		await elastic.save(model, { id: 1, country: 'ARG' }),
		await elastic.get(model)
	);

	console.log(
		'multiSave',
		await elastic.multiSave(model, [
			{ id: 2, country: 'JPN' },
			{ id: 3, country: 'JPN' }
		]),
		await elastic.get(model)
	);

	console.log(
		'remove',
		await elastic.remove(model, { id: 1 }),
		await elastic.get(model)
	);

})();
