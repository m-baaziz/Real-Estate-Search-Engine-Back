module.exports = {
	elasticsearch: {
		host: '51.255.48.11:9200',
		log: process.env['ENV'] === 'local' ? 'trace' : 'error'
	}
};