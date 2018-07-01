const DynamoDbModel = require('./DynamoDbModel');

class Log extends DynamoDbModel {
	constructor() {
		super({
			tableName: process.env['LOGS_DYNAMODB_TABLE'],
			indexName: process.env['LOGS_USERID_INDEX']
		});
	}
}

module.exports = new Log();
