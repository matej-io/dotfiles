import Ffmpeg from 'fluent-ffmpeg';

export default function generateVideoThumbnail(
	videoPath: string,
	outPath: string
) {
	return new Promise((resolve, reject) => {
		const ffmpeg = Ffmpeg();
		ffmpeg.addInput(videoPath);
		ffmpeg.addOutputOption(`-vf select='eq(n,0)',scale=-1:720`);
		ffmpeg.addOutputOption(`-vframes 1`);
		ffmpeg.addOutput(outPath);
		// ffmpeg.on('start', () => {
		// 	console.log('thumb rendering start');
		// });
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
}
