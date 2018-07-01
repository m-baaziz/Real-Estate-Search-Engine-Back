const config = require('../config/config');
const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient({
	apiVersion: '2012-08-10',
	region: 'eu-west-3'
});

class DynamoDbModel {
	static query(query) {
		return new Promise((resolve, reject) => {
			dynamodb.query(query, (error, data) => {
		  	if (error) {
		  		reject(error);
		  		return;
		  	}
		  	resolve(data);
		  });
		});
	}

	static update(params) {
		return new Promise((resolve, reject) => {
			dynamodb.update(params, (err, data) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(data);
			});
		});
	}

	static create(params) {
		return new Promise((resolve, reject) => {
			dynamodb.put(params, (err, data) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(data);
			});
		});
	}

	constructor({ tableName, indexName }) {
		this.tableName = tableName;
		this.indexName = indexName;
	}

	find(id) {
		return this._findBy('id', id);
	}

	create(data) {
		return new Promise(async(resolve, reject) => {
			try {
				const params = {
					Item: {
						...data,
						createdAt: Date.now(),
						updatedAt: Date.now()
					},
					TableName: this.tableName
				};
				const result = await DynamoDbModel.create(params);
				resolve(result);
			}
			catch(e) {
				reject(e);
			}
		});
	}

	_findBy(key, value) {
		return new Promise(async(resolve, reject) => {
			try {
				let query = {
					TableName: this.tableName,
				  IndexName: this.indexName,
				  KeyConditionExpression: `${key} = :${key}`,
				  ExpressionAttributeValues: {
				      [`:${key}`]: value
				  }
				};
				if (!value) {
					reject(`Invalid ${value}`);
					return;
				}
				const result = await DynamoDbModel.query(query);
				resolve(result);
			}
			catch(e) {
				reject(e);
			}
		});
	}

	_updateBy(idKey, idValue, attributeName, value) {
		return new Promise(async(resolve, reject) => {
			try {
				const dbAttributeName = `#${attributeName.toUpperCase()}`;
				const params = {
					ExpressionAttributeNames: {
						[dbAttributeName]: attributeName
					}, 
					ExpressionAttributeValues: {
						':a': value
					}, 
					Key: {
						[idKey]: idValue
					},
					ReturnValues: 'ALL_NEW',
					TableName: this.tableName, 
					UpdateExpression: `SET ${dbAttributeName} = :a`
				};

				const result = await DynamoDbModel.update(params);
				resolve(result);
			}
			catch(e) {
				reject(e);
			}
		});
	}
}

module.exports =  DynamoDbModel;
