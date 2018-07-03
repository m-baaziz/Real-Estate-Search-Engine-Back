const _ = require('lodash');
const AWS = require('aws-sdk');
const uuidv4 = require('uuid/v4');

const config = require('../config/config');
const utils = require('../lib/utils');
const BasicController = require('./BasicController');
const Log = require('../models/Log');

const dynamodb = new AWS.DynamoDB.DocumentClient({
	apiVersion: '2012-08-10',
	region: 'eu-west-3'
});

class LogsController extends BasicController {
	async create(req, res) {
		try {
			const { type, value } = req.body;
			const { id, email } = req.user;
		 	const logId = uuidv4();
			const result = await Log.create({
				id: logId,
				userId: id,
				type,
				value: utils.deepOmitBy(value, _.isEmpty)
			});
			console.log('Log entry successfully created for user : ', email);
			res.status(200).send(true);
		}
		catch(e) {
			res.status(500).send(e.message);
		}
	}
}

module.exports =  new LogsController();
