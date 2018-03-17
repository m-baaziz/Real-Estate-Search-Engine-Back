const express = require('express');
const morgan = require('morgan');
const serverless = require('serverless-http');
const elasticsearch = require('elasticsearch');
const request = require('request');

const config = require('./config');

const app = express();
const esClient = new elasticsearch.Client(config.elasticsearch);

const DESCRIPTION_MAX_LENGTH = 1000;
const ZIPCODE_REGEXP = /^[0-9]{5}$/;
const DEFAULT_COUNTRY = 'France';

app.use(morgan('dev'))
	.use((req, res, next) => {
	  res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	  next();
	});

app.get('/housing', (req, res) => {
	const { query } = req.query;

	if (typeof query !== 'string' || query.length > DESCRIPTION_MAX_LENGTH) {
		res.status(400).send('Invalid query');
		return;
	}

	esClient.search({
		body: {
			query: {
				match: {
					description: query
				}
			}
		}
	}, (err, response) => {
		const { hits, total } = response.hits;
		const zipCodes = hits.map(h => h._source.zipcode);
		
		console.log(`received a total of ${total} items, zipCodes : ${zipCodes}`);

		getGeoLocs(zipCodes, (err, geoLocs) => {
			if (err) {
				console.log('Error while processing geo localizations : ', err);
				res.status(500).send(`Error while processing geo localizations : ${err}`);
				return;
			}
			console.log("geolocs : ", geoLocs);
			const data = hits.map((hit) => {
				console.log("zipcode : ", hit._source.zipcode);
				return Object.assign({}, hit._source, {
					id: hit.id,
					position: geoLocs[hit._source.zipcode]
				});
			});
			res.json({ data });
		});
	});
});


function getGeoLocs(zipCodes, cb) {
	const promises = zipCodes.map((zipCode) => {
		return new Promise((resolve, reject) => {
			if (!zipCode.match(ZIPCODE_REGEXP)) {
				return reject(`Invalid zip code : ${zipCode}`);
			}
			request.get({
				url: `http://maps.googleapis.com/maps/api/geocode/json?address=${zipCode} France`,
				qs: { address: `${zipCode} ${DEFAULT_COUNTRY}` },
				json: true
			}, (err, response, body) => {
				if (err) {
					return reject(err);
				}
				const { results } = body;
				if (!results || results.length === 0) {
					console.log(`Zip code ${zipCode} was not found`);
					return resolve();
				}
				return resolve({[zipCode]: response.body.results[0].geometry.location});
			})
		});
	})

	Promise.all(promises).then((locations) => {
		const uniqLocs = locations.reduce((acc, loc) => {
			return Object.assign({}, acc, loc);
		}, {});
		cb(null, uniqLocs);
	}).catch((error) => {
		cb(error);
	});
}


if (process.env['ENV'] === 'local') {
	app.listen(8080);
}

module.exports.handler = serverless(app);