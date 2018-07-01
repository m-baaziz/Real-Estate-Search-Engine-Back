const express = require('express');
const morgan = require('morgan');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');

const HousingController = require('./controllers/HousingController');
const UsersController = require('./controllers/UsersController');
const LogsController = require('./controllers/LogsController');

const authenticationMiddlewares = require('./middlewares/authentication');

const app = express();

const LOCAL_API_PORT = 8080;

app.use(morgan('dev'))
	.use(bodyParser.urlencoded({extended: true}))
  .use(bodyParser.json())
	.use((req, res, next) => {
	  res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	  next();
	});


app.post('/logs', authenticationMiddlewares.jwtAuthentication, (req, res) => LogsController.create(req, res));


app.post('/users/signin', (req, res) => UsersController.signin(req, res));


app.post('/users/signup', (req, res) => UsersController.signup(req, res));





app.get('/housing/scroll', (req, res) => HousingController.scroll(req, res));

app.get('/housing', (req, res) => HousingController.index(req, res));

app.get('/housing/:id', (req, res) => HousingController.get(req, res));


if (process.env['ENV'] === 'local') {
	app.listen(LOCAL_API_PORT);
}

module.exports.handler = serverless(app);
