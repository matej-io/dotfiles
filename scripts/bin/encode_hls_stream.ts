#!/usr/bin/env node --experimental-strip-types --no-warnings

import encodeHLSStream from './utils/encodeHLSStream.ts';

async function encode_hls_stream() {
	try {
		const videoFile = process.argv[2];
		if (!videoFile) {
			throw '[param 1] video file not specified';
		}
		const gallerySlug = process.argv[3];
		if (!gallerySlug) {
			throw '[param 2] gallery slug not specified';
		}
		const outputHeight = parseInt(process.argv[4]);
		if (!outputHeight) {
			throw '[param 3] output height not specified';
		}
		await encodeHLSStream(videoFile, gallerySlug, outputHeight);
	} catch (error) {
		console.error('error:', error);
	}
}

encode_hls_stream();
