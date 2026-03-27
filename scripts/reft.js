const test = '200 x 153 cms\n78 3/4 x 60 1/4 inches';
console.log('fcuk', toSizeJson(test));

function toSizeJson(sizeStr) {
	const match3 = sizeStr.match(
		/^([0-9\.]+) x ([0-9\.]+) x ([0-9\.]+) cms?(.*\n[\s\S]*|)$/
	);
	if (match3 && match3.length > 3) {
		const height = parseFloat(match3[1]);
		const width = parseFloat(match3[2]);
		const depth = parseFloat(match3[3]);
		return { height, width, depth };
	} else {
		const match2 = sizeStr.match(
			/^([0-9\.]+) x ([0-9\.]+) cms?(.*\n[\s\S]*|)$/
		);
		if (match2 && match2.length > 2) {
			const height = parseFloat(match2[1]);
			const width = parseFloat(match2[2]);
			return { height, width };
		} else {
			return {
				note: sizeStr,
			};
		}
	}
}
