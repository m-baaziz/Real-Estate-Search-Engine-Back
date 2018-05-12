const express = require('express');
const AWS = require('aws-sdk');
const uuidv4 = require('uuid/v4');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const serverless = require('serverless-http');
const elasticsearch = require('elasticsearch');
const request = require('request');
const _ = require('lodash');
const validator = require('validator');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');

const config = require('./config/config');

const app = express();
const esClient = new elasticsearch.Client(config.elasticsearch);

const dynamodb = new AWS.DynamoDB({
	apiVersion: '2012-08-10',
	region: 'eu-west-3'
});

const LOCAL_API_PORT = 8080;
const DESCRIPTION_MAX_LENGTH = 1000;
const ZIPCODE_REGEXP = /^[0-9]{5}$/;
const SCROLL_TIMEOUT = '30m';

app.use(morgan('dev'))
	.use(bodyParser.urlencoded({extended: true}))
  .use(bodyParser.json())
	.use((req, res, next) => {
	  res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	  next();
	});


function findUsersByEmail(email, cb) {
	const query = {
		TableName: process.env['USERS_DYNAMODB_TABLE'],
	  IndexName: process.env['USERS_EMAIL_INDEX'],
	  KeyConditionExpression: 'email = :email',
	  ExpressionAttributeValues: {
	      ':email': { S: email }
	  }
	};
  dynamodb.query(query, (error, data) => {
  	if (error) {
  		cb(error);
  		return;
  	}
  	console.log('DATA : ', JSON.stringify(data));
  	cb(null, data);
  });
}


app.post('/users/:id/log', (req, res) => {
	 // check token.id === req.params.id
});


app.post('/users/signin', (req, res) => {
	console.log('body : ', req.body);
	const { email, password } = req.body;

	console.log("params : ", email, password);

	if (!validator.isEmail(email)) {
		res.status(400).send('Invalid email');
		return;
	}

	findUsersByEmail(email, (error, data) => {
		if (error) {
			res.status(400).send(error);
			return;
		}
		if (data.Count === 0) {
  		res.status(400).send("Email and password don't match");
  		return;
  	}
  	const u = data.Items[0];
		bcrypt.compare(password, u.password.S, function(err, isValid) {
			if (err) {
				res.status(500).send(error);
				return;
			}
			if (!isValid) {
				res.status(403).send("Email and password don't match");
				return;
			}
			const user = { email: u.email.S, id: u.id.S };
			const token = jwt.sign(user, config.jwt.secret, {
				expiresIn: config.jwt.duration
			});
			res.json({ user, token });
		});
	});
});


app.post('/users/signup', (req, res) => {
	console.log('body : ', req.body);
	const { email, password } = req.body;

	console.log("params : ", email, password);

	findUsersByEmail(email, (error, data) => {
		if (error) {
			res.status(400).send(error);
			return;
		}
		if (data.Count > 0) {
			res.status(403).send(`Email ${email} not available`);
			return;
		}
		const id = uuidv4();
		bcrypt.hash(password, config.bcrypt.saltRounds, function(err, hash) {
			if (err) {
				res.status(500).send(err);
				return;
			}
		  const params = {
				Item: {
					id: { S: id },
					email: { S: email },
					password: { S: hash }
				},
				TableName: process.env['USERS_DYNAMODB_TABLE']
			};

			dynamodb.putItem(params, (error, data) => {
				if (error) {
		  		res.status(500).send(error);
		  		return;
		  	}
				console.log('User successfully signed up, generating jwt ... ::: ', data);
				const user = { email, id };
				const token = jwt.sign(user, config.jwt.secret, {
					expiresIn: config.jwt.duration
				});
				res.json({ user, token });
			});
		});
	});
});





app.get('/housing/scroll', (req, res) => {
	const { scrollId } = req.query;

	if (typeof  scrollId !== 'string') {
		res.status(400).send('Invalid scroll Id');
		return;
	}

	esClient.scroll({
    scrollId,
    scroll: SCROLL_TIMEOUT
  }, fetchResponse(req, res));
});

app.get('/housing', (req, res) => {
	const { city, zipcode, price, superficy, rooms, custom, lat, lon } = req.query;
	const priceMin = parseInt(price.min);
	const priceMax = parseInt(price.max);
	const superficyMin = parseInt(superficy.min);
	const superficyMax = parseInt(superficy.max);
	const roomsMin = parseInt(rooms.min);
	const roomsMax = parseInt(rooms.max);
	const latMin = parseFloat(lat.min);
	const latMax = parseFloat(lat.max);
	const lonMin = parseFloat(lon.min);
	const lonMax = parseFloat(lon.max);
	// use Redis cache to destroy previous scroll memory

	if (
		(priceMin !== NaN && priceMax !== NaN && priceMin > priceMax) ||
		(superficyMin !== NaN && superficyMax !== NaN && superficyMin > superficyMax) ||
		(roomsMin !== NaN && roomsMax !== NaN && roomsMin > roomsMax) ||
		(latMin !== NaN && latMax !== NaN && latMin > latMax) ||
		(lonMin !== NaN && lonMax !== NaN && lonMin > lonMax) ||
		(typeof zipcode !== 'string' || (zipcode.lenght > 0 && !zipcode.match(ZIPCODE_REGEXP))) ||
		(typeof custom !== 'string' || custom.length > DESCRIPTION_MAX_LENGTH) ||
		(typeof city !== 'string' || city.length > DESCRIPTION_MAX_LENGTH)
	) {
		res.status(400).send('Invalid query');
		return;
	}

	const matches = {};
	const ranges = { price: {}, square: {}, rooms: {}, 'coordinates.lat': {}, 'coordinates.lon': {} };

	if (city.length > 0)
		matches.city = city;
	if (zipcode.length > 0)
		matches.zipcode = zipcode;
	if (custom.length > 0)
		matches.description = custom;

	if (priceMin || priceMin === 0)
		ranges.price.gte = priceMin;
	if (priceMax || priceMax === 0)
		ranges.price.lte = priceMax;

	if (superficyMin || superficyMin === 0)
		ranges.square.gte = superficyMin;
	if (superficyMax || superficyMax === 0)
		ranges.square.lte = superficyMax;

	if (roomsMin || roomsMin === 0)
		ranges.rooms.gte = roomsMin;
	if (roomsMax || roomsMax === 0)
		ranges.rooms.lte = roomsMax;

	if (latMin || latMin === 0)
		ranges['coordinates.lat'].gte = latMin;
	if (latMax || latMax === 0)
		ranges['coordinates.lat'].lte = latMax;

	if (lonMin || lonMin === 0)
		ranges['coordinates.lon'].gte = lonMin;
	if (lonMax || lonMax === 0)
		ranges['coordinates.lon'].lte = lonMax;

	// simulate query to aproximate results lenght / refuse if query is not accurate enough

	esClient.search({
		index: config.elasticsearch.index,
		type: config.elasticsearch.hitsType,
		scroll: SCROLL_TIMEOUT,
		body: {
			query: {
				bool: {
					must: _.map(matches, (value, key) => {
						return { match: { [key]: value } };
					}).concat(_.map(_.filter(ranges, (value, key) => !_.isEmpty(value)), (value, key) => {
						return { range: { [key]: value } };
					}))
				}
			}
		}
	}, fetchResponse(req, res));
});

app.get('/housing/:id', (req, res) => {
	const { id } = req.params;

	if (typeof id !== 'string') {
		res.status(400).send('Invalid Id');
		return;
	}

	esClient.get({
		index: config.elasticsearch.index,
		type: config.elasticsearch.hitsType,
		id
	}, (err, esResponse) => {
		if (err) {
			res.status(err.status || 500).send(err.message || `Error : ${err}`);
			return;
		}
		res.json(Object.assign({}, esResponse._source, {
			id: esResponse._id
		}));
	})
});

function fetchResponse(req, res) {
	return (esError, esResponse) => {
		if (esError) {
			res.status(500).send(`Error : ${esError}`);
			return;
		}
		const { hits, total } = esResponse.hits;
		const data = hits.map((hit) => {
			return Object.assign({}, hit._source, {
				id: hit._id
			});
		});
		res.json({ data, scrollId: esResponse._scroll_id, total });
	}
}

if (process.env['ENV'] === 'local') {
	app.listen(LOCAL_API_PORT);
}

module.exports.handler = serverless(app);