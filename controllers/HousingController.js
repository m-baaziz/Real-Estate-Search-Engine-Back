import BasicController from './BasicController';

class HousingController extends BasicController {
	index(req, res) {
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
			(typeof zipcode !== 'string' || (zipcode.lenght > 0 && !zipcode.match(/^[0-9]{5}$/))) ||
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
			index: config.index,
			type: config.hitsType,
			scroll: SCROLL_TIMEOUT,
			body: {
				query: {
					bool: {
						must: _.map(matches, (value, key) => {
							return { match: { [key]: value } };
						}).concat(_.map(ranges, (value, key) => {
							return { range: { [key]: value } };
						}))
					}
				}
			}
		}, fetchResponse(req, res));
	}
}

export default new HousingController();
