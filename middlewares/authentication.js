const jwt = require('jsonwebtoken');
const config = require('../config/config');

function jwtAuthentication(req, res, next) {
	const { token } = req.body;
	jwt.verify(token, config.jwt.secret, (err, user) => {
		if (err) {
			res.status(400).send('Action not authorized');
			return;
		}
		req.user = user;
		next();
	});
}

exports.jwtAuthentication = jwtAuthentication;
