import Ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import getVideoTrackProps from './getVideoProps.ts';

export default async function encodeHLSStream(
	videoFile: string,
	gallerySlug: string,
	outputHeight: number
) {
	const fileParsed = path.parse(videoFile);

	const folderName = fileParsed.name;

	const videoTrackProps = await getVideoTrackProps(videoFile);
	const inputWidth = videoTrackProps.width;
	const inputHeight = videoTrackProps.height;
	if (!inputWidth || !inputHeight) {
		throw 'missing video dimensions';
	}

	const outputWidth =
		Math.floor((inputWidth * outputHeight) / inputHeight / 2) * 2;

	const pixelArea = outputWidth * outputHeight;
	// 3500000 is bitrate for 1080p 16:9 video
	const videoBitrate = Math.floor((pixelArea * 3500000) / (1920 * 1080));
	const audioBitrate =
		videoBitrate > 1000000 ? 128000 : videoBitrate > 500000 ? 96000 : 64000;

	const outputFolder = path.join(gallerySlug, folderName);
	if (
		!fs.existsSync(outputFolder) ||
		!fs.statSync(outputFolder).isDirectory()
	) {
		fs.mkdirSync(outputFolder, { recursive: true });
	}
	const outputPath = path.join(outputFolder, `${outputHeight}_out.m3u8`);

	await new Promise((resolve, reject) => {
		const ffmpeg = Ffmpeg();
		ffmpeg.addInput(videoFile);
		ffmpeg.addOutputOption('-c:a aac');
		ffmpeg.addOutputOption('-c:v libx264');
		ffmpeg.addOutputOption(`-b:v ${videoBitrate}`);
		ffmpeg.addOutputOption(`-b:a ${audioBitrate}`);
		ffmpeg.addOutputOption(`-s ${outputWidth}x${outputHeight}`);
		ffmpeg.addOutputOption('-f hls');
		ffmpeg.addOutputOption('-hls_list_size 1000000');
		ffmpeg.addOutputOption('-hls_time 2');

		ffmpeg.addOutput(outputPath);
		ffmpeg.on('start', () => {
			console.log('video render start');
		});
		ffmpeg.on('progress', (progress) => {
			console.log('render progress', JSON.stringify(progress));
		});
		ffmpeg.on('error', (error, stdout, stderr) => {
			console.log('error', error);
			console.log('stdout', stdout);
			console.log('stderr', stderr);
			reject(error);
		});
		ffmpeg.on('end', () => {
			resolve(true);
		});
		ffmpeg.run();
	});
	console.log('render complete:', outputPath);
	return {
		outputFolder,
		outputPath,
		videoBitrate,
		audioBitrate,
		bitrate: videoBitrate + audioBitrate,
	};
}
