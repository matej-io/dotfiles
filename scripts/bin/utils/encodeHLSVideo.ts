import path from 'path';
import fs from 'fs';
import encodeHLSStream from './encodeHLSStream.ts';

export default async function encodeHLSVideo(
	videoFile: string,
	gallerySlug: string,
	outputHeights: number[]
) {
	const fileParsed = path.parse(videoFile);

	const folderName = fileParsed.name;

	let mainM3U8contents = '#EXTM3U\n';
	for (const height of outputHeights) {
		console.log(`encoding video ${folderName} @${height}p`);
		const { bitrate } = await encodeHLSStream(videoFile, gallerySlug, height);
		console.log('bitrate', bitrate);
		mainM3U8contents += `#EXT-X-STREAM-INF:PROGRAM-ID=1, BANDWIDTH=${bitrate}\n`;
		mainM3U8contents += `${height}_out.m3u8\n`;
	}
	const mainFilePath = path.join(
		gallerySlug,
		folderName,
		`${folderName}.m3u8`
	);
	fs.writeFileSync(mainFilePath, mainM3U8contents);
	console.log(mainFilePath);
	return { videoFile: mainFilePath };
}
