'use strict';

const ElasticSearch = require('./index');

class Model {

	static get table() {
		return 'table';
	}

	static get fields() {
		return [
			'value'
		];
	}

}

const model = new Model();

const elastic = new ElasticSearch({});

(async () => {

	/* const inserts = Array(50).fill()
		.map((elem, i) => {
			return {
				id: i + 100 + 1,
				value: `foobar ${i + 100 + 1}`
			};
		});

	inserts.forEach(async item => {
		await elastic.insert(model, item);
	}); */

	/* console.log(
		await elastic.insert(model, {
			id: 50,
			value: 'foobar 50'
		})
	); */

	/* console.log(
		await elastic.get(model, {})
	); */

	console.log(
		await elastic.get(model, {
			filters: {
				// id: 102,
				value: {
					$in: 'foobar'
				}
			}
		})
	);

})();
