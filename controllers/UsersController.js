const _ = require('lodash');
const uuidv4 = require('uuid/v4');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const config = require('../config/config');
const BasicController = require('./BasicController');
const User = require('../models/User');

class UsersController extends BasicController {
	async signin(req, res) {
		const { email, password } = req.body;

		if (!validator.isEmail(email)) {
			res.status(400).send('Invalid email');
			return;
		}
		try {
			const data = await User.findByEmail(email);
			if (data.Count === 0) {
	  		res.status(400).send("Email and password don't match");
	  		return;
	  	}
	  	const u = data.Items[0];
			bcrypt.compare(password, u.password, function(err, isValid) {
				if (err) {
					res.status(500).send(error);
					return;
				}
				if (!isValid) {
					res.status(403).send("Email and password don't match");
					return;
				}
				const user = { email: u.email, id: u.id };
				const token = jwt.sign(user, config.jwt.secret, {
					expiresIn: config.jwt.duration
				});

				res.json({ user, token });
			});
		}
		catch(e) {
			res.status(400).send(e);
		}
	}

	async signup(req, res) {
		try {
			const { email, password } = req.body;

			const data = await User.findByEmail(email);
			if (data.Count > 0) {
				res.status(403).send(`Email ${email} not available`);
				return;
			}
			const id = uuidv4();
			bcrypt.hash(password, config.bcrypt.saltRounds, async(err, hash) => {
				if (err) {
					res.status(500).send(err);
					return;
				}
				try {
					const result = await User.create({
						id,
						email,
						password: hash
					});

					console.log('User successfully signed up, generating jwt ... ::: ', data);
					const user = { email, id };
					const token = jwt.sign(user, config.jwt.secret, {
						expiresIn: config.jwt.duration
					});
					res.json({ user, token });
				}
				catch(e) {
					res.status(500).send(e);
				}
			});
		}
		catch(e) {
			res.status(400).send(e);
		}
	}
}

module.exports = new UsersController();
