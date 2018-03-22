const express = require('express');
const morgan = require('morgan');
const serverless = require('serverless-http');
const elasticsearch = require('elasticsearch');
const request = require('request');

const config = require('./config');

const app = express();
const esClient = new elasticsearch.Client(config.elasticsearch);

const LOCAL_API_PORT = 8080;
const DESCRIPTION_MAX_LENGTH = 1000;
const ZIPCODE_REGEXP = /^[0-9]{5}$/;
const DEFAULT_COUNTRY = 'France';
const SCROLL_TIMEOUT = '30m';

app.use(morgan('dev'))
	.use((req, res, next) => {
	  res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	  next();
	});

app.get('/housing/scroll', (req, res) => {
	console.log("in SCROOOOL route");
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
	const { query } = req.query;

	// use Redis cache to destroy previous scroll memory

	if (typeof query !== 'string' || query.length > DESCRIPTION_MAX_LENGTH) {
		res.status(400).send('Invalid query');
		return;
	}

	// simulate query to aproximate results lenght / refuse if query is not accurate enough

	esClient.search({
		scroll: SCROLL_TIMEOUT,
		body: {
			query: {
				match: {
					description: query
				}
			}
		}
	}, fetchResponse(req, res));
});

app.get('/housing/:id', (req, res) => {
	console.log("in GEEET ROUUUUTE");
	const { id } = req.params;

	if (typeof id !== 'string') {
		res.status(400).send('Invalid Id');
		return;
	}

	esClient.get({
		index: 'listings',
		type: 'listing',
		id
	}, (err, esResponse) => {
		if (err) {
			res.status(err.status || 500).send(err.message || `Error : ${err}`);
			return;
		}
		res.json(Object.assign({}, esResponse._source, {
			id: esResponse._id,
			img: [
				'https://image.ibb.co/eMOJKc/photo2.jpg',
				'https://image.ibb.co/nRtkzc/kitchen2.jpg',
				'https://image.ibb.co/iJCdKc/bedroom2.jpg'
			]
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
		const zipCodes = hits.map(h => h._source.zipcode);
		
		console.log(`received a total of ${total} items, zipCodes : ${zipCodes}`);

		getGeoLocs(zipCodes, (esError, geoLocs) => {
			if (esError) {
				console.log('Error while processing geo localizations : ', esError);
				res.status(500).send(`Error while processing geo localizations : ${esError}`);
				return;
			}
			console.log("geolocs : ", geoLocs);
			const data = hits.map((hit) => {
				console.log("zipcode : ", hit._source.zipcode);
				return Object.assign({}, hit._source, {
					id: hit._id,
					position: geoLocs[hit._source.zipcode],
					img: [
						'https://image.ibb.co/eMOJKc/photo2.jpg',
						'https://image.ibb.co/nRtkzc/kitchen2.jpg',
						'https://image.ibb.co/iJCdKc/bedroom2.jpg'
					]
				});
			});
			res.json({ data, scrollId: esResponse._scroll_id, total });
		});
	}
}

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
			}, (err, esResponse, body) => {
				if (err) {
					return reject(err);
				}
				const { results } = body;
				if (!results || results.length === 0) {
					console.log(`Zip code ${zipCode} was not found`);
					return resolve();
				}
				return resolve({[zipCode]: esResponse.body.results[0].geometry.location});
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
	app.listen(LOCAL_API_PORT);
}

module.exports.handler = serverless(app);