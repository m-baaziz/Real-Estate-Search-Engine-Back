const _ = require('lodash');

function deepOmitBy(obj, condition) {
	const newObj = _.omitBy(obj, condition);
	let omitAgain = false;
	_.forEach(newObj, (value, key) => {
		if (typeof value === 'object') {
			omitAgain = true;
			newObj[key] = deepOmitBy(value, condition);
		}
	});
	return omitAgain ? _.omitBy(newObj, condition) : newObj;
}

exports.deepOmitBy = deepOmitBy;
