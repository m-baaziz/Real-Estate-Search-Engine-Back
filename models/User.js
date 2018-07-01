const DynamoDbModel = require('./DynamoDbModel');

class User extends DynamoDbModel {
	constructor() {
		super({
			tableName: process.env['USERS_DYNAMODB_TABLE'],
			indexName: process.env['USERS_EMAIL_INDEX']
		});
	}

	findByEmail(email) {
		return this._findBy('email', email);
	}
}

module.exports = new User();
