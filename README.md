# elasticsearch

[![Build Status](https://travis-ci.org/janis-commerce/elasticsearch.svg?branch=master)](https://travis-ci.org/janis-commerce/elasticsearch)
[![Coverage Status](https://coveralls.io/repos/github/janis-commerce/elasticsearch/badge.svg?branch=master)](https://coveralls.io/github/janis-commerce/elasticsearch?branch=master)

## Installation
```sh
npm install --save @janiscommerce/elasticsearch
```

## API

### `new ElasticSearch({config})`

Constructs the Elasticsearch driver instance, connected with the `config [Object]`.  

**Config definition (all settings are optional):**  
- protocol `[String]`: The protocol for the elasticsearch host url, not needed if you use a full url as host.  
- host `[String]`: Elasticsearch host URL. **In case of the host url includes a protocol, it will replace the actual protocol value in the config**.  
- port `[Number]`: The port for the elasticsearch host url, not needed if you use a full url as host.  
- user `[String]`: Elasticsearch user for the host.  
- password `[String]`: Elasticsearch password for the host.  
- limit `[Number]`: Default limit for getting operations.  
- prefix `[String]`: Prefix for table name, if it's setted, any operation will use the model table name with the prefix. Ex: `table.prefix`.  
- awsCredentials `[Boolean]`: Set to `true` if you need to use AWS credentials ENV variables for the host connection/authentication.  

**Config usage:**  
```js
{
	protocol: 'https://', // Default empty
	host: 'url-to-my-elasticsearch-host.com', // Default http://localhost
	port: 9200, // Default: empty
	user: 'Username', // Default empty
	password: 'password', // Default empty
	limit: 10, // Default 500
	prefix: 'products', // Default empty
	awsCredentials: true // Default false
}
```

### ***async*** `buildIndex(model)`

Puts the elasticsearch mappings obtained from the model, needed for sorting operations.  
**This method must be used once, only when a new table (elasticsearch index) is created.**  
**Is strongly recommended the usage of this method before any other operation.**

**Model example for this method:**

```js
class MyModel extends Model{

	static get table() {
		return 'table'; // The elasticsearch index
	}

	static get sortableFields() {
		return {
			id: { type: 'integer' }, // If there is no defined ID field, it will be mapped as text
			myfield: true, // Default will be mapped as text (elasticsearch string)
			myOtherField: { type: 'integer' },
			someOtherField: { type: 'long' }
		};
	}
}
```

**Elasticsearch basic field datatypes:**  

- **String:** text, keyword  
- **Numeric:** long, integer, short, byte, double, float, half_float, scaled_float  
- **Date:** date  
- **Date nanoseconds:** date_nanos  
- **Boolean:** boolean  
- **Binary:** binary  
- **Range:** integer_range, float_range, long_range, double_range, date_range  

**Important:**  
- If you define the `id` field as non text format may cause errors if you do an insertion operation without specifing the `id` field due the generated `id` will be in text format.  
- The table name from the model will be converted into snake_case due elasticsearch doesn't support camelCase in the index names. 
- The sortable fields are optional, same as this method, is only required for sorting items in get operations.

### ***async*** `insert(model, {item})`

Inserts an item into elasticsearch.  
Requires a `model [Model]` and `item [Object]`  
Returns the ID of the inserted item

**Important:**  

* If your item doesn't have an `id` field, it will be inserted with an auto-generated `id`, using `UUID`.  
* The `id` field is unique, it cannot be duplicated.  

### ***async*** `multiInsert(model, [{items}])`

Inserts multiple items into elasticsearch.  
Requires a `model [Model]` and `items [Object array]`  
Returns `true` if the operation was successful or `false` if not.

**Important:**  

* Every item that doesn't have an `id` field, will be inserted with an auto-generated `id` using `UUID`.  
* The `id` field is unique, it cannot be duplicated.  

### ***async*** `update(model, {values}, {filter})`

Updates one or multiple items from elasticsearch.  
Requires a `model [Model]`, `values [Object]` and `filter [Object]`  
Returns the updated count `[Number]`

### ***async*** `get(model, {params})`

Get items from the database then returns an `[Object array]` with the getted items.  
Requires a `model [Model]` and `params [Object]`  
Returns all items if you use without parameters  

Parameters (all are optional):  
* order `[Object]`: Order params for getted items, Example: `{ myField: 'asc', myOtherField: 'desc' }`  
* limit `[Number]`: Max amount of items per page to get. Default 500 or setted on config when constructs.  
* page `[Number]`: Get the items of the specified page.  
* filters `[Object]`: Search filters, leave empty for all items.  

**Filter operators**
- **$eq**: Matches values that are equal to a specified value.  
- **$gt**: Matches values that are greater than a specified value.  
- **$gte**: Matches values that are greater than or equal to a specified value.  
- **$in**: Matches any of the values specified in an array.  
- **$lt**: Matches values that are less than a specified value.  
- **$lte**: Matches values that are less than or equal to a specified value.  
- **$ne**: Matches all values that are not equal to a specified value.  
- **$nin**: Matches none of the values specified in an array.  

**Filters example**  

```js
{
	filters:{
		name: 'Edward', // Matches exactly the field, get only the items with 'Edward' in name field
		$in: {
			fullname: ['Edward', 'Sanchez'] // Similar as MongoDB, matches any of the words in the fullname field and, in this case, then gets all items that includes 'Edward' or 'Sanchez' in that field
		},
		$gt: {
			id: 10 // Similar as MongoDB, get all items which id field is greater than 10
		}
	}
}
```

### ***async*** `getTotals(model)`

Get the totals from the latest get operation with pagination.  
Requires a `model [Model]`  
Returns an `[Object]` with the total count, page size, total pages and current page.  

**getTotals return example**  

```js
{
	total: 1000,
	pageSize: 100, // Limit from the last get operation or default value (500)
	pages: 10,
	page: 5
}
```

### ***async*** `save(model, {item})`

Insert/update an item into the elasticsearch.  
Requires a `model [Model]` and `item [Object]`  
Returns the ID of the upserted item  

### ***async*** `multiSave(model, [{items}])`

Insert/update multiple items into the elasticsearch.  
Requires a `model [Model]` and `items [Object array]`  
Returns `true` if the operation was successful or `false` if not.  

### ***async*** `remove(model, {filters})`

Removes the item or items that matches the filters from the elasticsearch.  
Requires a `model [Model]` and `filters [Object]`  
Returns the deleted count `[Number]`  

## Errors

The errors are informed with a `ElasticSearchError`.
This object has a code that can be useful for a correct error handling.  
The codes are the following:  

| Code | Description                    |
|------|--------------------------------|
| 1    | Invalid model                  |
| 2    | Invalid query                  |
| 3    | Internal elasticsearch error   |
| 4    | Invalid filters                |
| 5    | Invalid filter operator        |
| 6    | Index not found                |
| 7    | Index not built                |

The config validation errors are informed with a `ElasticSearchConfigError`.
This object has a code that can be useful for a correct error handling.  
The codes are the following:  

| Code | Description                    |
|------|--------------------------------|
| 1    | Invalid config                 |
| 2    | Invalid setting                |

## Usage
```js
const ElasticSearch = require('@janiscommerce/elasticsearch');
const Model = require('myModel');

const elastic = new ElasticSearch({
	host: 'https://myelastichost.com',
	user: 'root',
	password: 'foobar'
});

const model = new Model();

(async () => {

	await elastic.buildIndex(model);

	let result;

	// insert
	result = await elastic.insert(model, { id: 1, value 'sarasa' }); // expected return: 1

	// multiInsert
	result = await elastic.multiInsert(model, [
		{ id: 1, value: 'sarasa 1' },
		{ id: 2, value: 'sarasa 2' },
		{ id: 3, value: 'sarasa 3' }
	]); // expected return: true

	// update
	result = await elastic.update(model, { value: 'foobar 1' }, { id: 1 }); // expected return: 1

	// get
	result = await elastic.get(model, {}); // expected return: all entries array [{item}, {item}...]
	result = await elastic.get(model, { filters: { id: 1 } }); // expected return: an array with the item with id 1
	result = await elastic.get(model, { limit: 10, page: 2, filters: { value: 'foo' } }); // expected return: the page 2 of the elements with value "foo" with a page size of 10.
	result = await elastic.get(model, { order: { id: 'asc' } }); // expected return: all entries array ordered ascendently by id

	// getTotals
	result = await elastic.getTotals(model);

	/* expected return:
	{
		page: 2,
		limit: 10,
		pages: 5,
		total: 50
	}
	*/

	// save
	result = await elastic.save(model, { id: 1, value: 'foobar 1' }); // example return: 1

	// multiSave
	result = await elastic.multiSave(model, [
		{ id: 1, value: 'foobar 1' },
		{ id: 2, value: 'foobar 2' },
		{ id: 3, value: 'foobar 3' }
	]); // expected return: true

	// remove
	result = await elastic.remove(model, { 
		$in: {
			value: ['foobar']
		} 
	}); // expected return: 3
})

```
