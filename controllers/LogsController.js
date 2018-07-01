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
			console.log('5555555555');
			const { type, value } = req.body;
			const { id, email } = req.user;
		 	const logId = uuidv4();
		 	console.log('66666666666666');
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
			console.log('ERROOOR ::::: ', e);
			res.status(500).send(e.message);
		}
	}
}

module.exports =  new LogsController();
