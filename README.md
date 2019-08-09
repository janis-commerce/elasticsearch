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

Config definition:  
- protocol `[String]`: The protocol for the elasticsearch host url, not needed if you use a full url as host.  
- host `[String]`: Elasticsearch host URL.  
- port `[Number]`: The port for the elasticsearch host url, not needed if you use a full url as host.  
- user `[String]`: Elasticsearch user for the host.  
- password `[String]`: Elasticsearch password for the host.  
- limit `[Number]`: Default limit for getting operations.  
- awsCredentials `[Boolean]`: Set to `true` if you need to use AWS credentials ENV variables for the host connection/authentication.  

Config usage:  
```js
{
	protocol: 'https://', // Default empty
	host: 'url-to-my-elasticsearch-host.com', // Default http://localhost
	port: 9200, // Default: empty
	user: 'Username', // Default empty
	password: 'password', // Default empty
	limit: 10, // Default 500
	awsCredentials: true // Default false
}
```

### ***async*** `buildIndex(model)`

Puts the elasticsearch mappings obtained from the model, needed for sorting operations.  
**This method must be used one time, when a new table (elasticsearch index) is created.**  
**Is strongly recommended the usage of this method before any other operation.**

Model example for this method:

```js
class MyModel extends Model{

	static get table() {
		return 'table'; // The elasticsearch index
	}

	static get fields() {
		return [
			{ id: 'integer' }, // If there is no defined ID field, will be mapped as text
			'myfield', // Default will be mapped as text (elasticsearch string)
			{ myOtherField: 'integer' },
			{ someOtherField: 'long' }
		];
	}
}
```

**Important:** If you define the `id` field as non text format may cause errors if you do an insertion operation without specifing the `id` field due the generated `id` will be in text format.

### ***async*** `insert(model, {item})`

Inserts an item into elasticsearch.  
Requires a `model [Model]` and `item [Object]`  
Returns `true` if the operation was successful or `false` if not.

### ***async*** `multiInsert(model, [{items}])`

Inserts multiple items into elasticsearch.  
Requires a `model [Model]` and `items [Object array]`  
Returns `true` if the operation was successful or `false` if not.

### ***async*** `update(model, {values}, {filter})`

Updates one or multiple items from elasticsearch.  
Requires a `model [Model]`, `values [Object]` and `filter [Object]`  
Returns the updated count `[Number]`

### ***async*** `get(model, {params})`

Get items from the database then returns an `[Object array]`
Requires a `model [Model]` and `items [Object array]`  
Returns `true` if the operation was successful or `false` if not.  

Parameters (all are optional):  
* order `[Object]`: Order params for getted items, Example: `{ myField: 'asc', myOtherField: 'desc' }`  
* limit `[Number]`: Max amount of items per page to get. Default 500 or setted on config when constructs.  
* page `[Number]`: Get the items of the specified page.  
* filters `[Object]`: Search filters, leave empty for all items.

**Filters usage**  

```js
{
	filters:{
		name: 'Edward', // Matches exactly the field, get only the items with 'Edward' in name field
		$in: {
			fullname: 'Edward' // Similar to LIKE in SQL, matches the word in the fullname field, gets all items that includes 'Edward' in the fullname field
		}
	}
}
```

$eq	Matches values that are equal to a specified value.
$gt	Matches values that are greater than a specified value.
$gte	Matches values that are greater than or equal to a specified value.
$in	Matches any of the values specified in an array.
$lt	Matches values that are less than a specified value.
$lte	Matches values that are less than or equal to a specified value.
$ne	Matches all values that are not equal to a specified value.
$nin	Matches none of the values specified in an array.

## Usage
```js
const Elasticsearch = require('@janiscommerce/elasticsearch');

```

## Examples
