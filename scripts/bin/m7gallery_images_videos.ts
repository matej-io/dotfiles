#!/usr/bin/env node --experimental-strip-types --no-warnings

import fs from 'fs';
import path from 'path';
import kebabCase from 'kebab-case';
import sharp from 'sharp';
import generateVideoThumbnail from './utils/generateVideoThumbnail.ts';
import encodeHLSVideo from './utils/encodeHLSVideo.ts';
import toSource from 'tosource';
import getVideoTrackProps from './utils/getVideoProps.ts';

async function prepareGallery() {
	try {
		const gallerySlug = process.argv[2];
		const galleryCamel = kebabCase.reverse(gallerySlug);
		const galleryTitle = process.argv[3];
		const thumbIndex = parseInt(process.argv[4]) || 0;
		if (!gallerySlug) {
			throw 'gallery slug not specified';
		}
		if (!galleryTitle) {
			throw 'gallery slug not specified';
		}

		const data = {
			id: gallerySlug,
			title: galleryTitle,
			caption: 'Installation or exhibition, Place, City, Country, Year',
			info: 'Longer description of the event',
			thumbnail: `https://media.zenplus.uk/miranda/projects/${gallerySlug}/thumb.jpg`,
			pageHref: `art/${gallerySlug}`,
			bgColor: '#44608C',
			slides: [] as any[],
		};

		if (
			!fs.existsSync(gallerySlug) ||
			!fs.lstatSync(gallerySlug).isDirectory
		) {
			fs.mkdirSync(gallerySlug);
		}

		const files = fs.readdirSync('.');
		let i = 0;
		for (const file of files) {
			const ext = path.extname(file).toLowerCase();
			const parsed = path.parse(file);
			if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
				const outFile = path.join(gallerySlug, `${parsed.name}.jpg`);
				await sharp(file)
					.resize(1280, 1280, { fit: 'inside' })
					.jpeg({ quality: 80 })
					.toFile(outFile);

				const image = sharp(outFile);
				const meta = await image.metadata();
				data.slides.push({
					image: `https://media.zenplus.uk/miranda/projects/${outFile}`,
					width: meta.width,
					height: meta.height,
					caption: '',
				});
				if (i === thumbIndex) {
					const thumbOutFile = path.join(gallerySlug, 'thumb.jpg');
					await sharp(outFile)
						.resize(512, 512, { fit: 'cover' })
						.jpeg({ quality: 80 })
						.toFile(thumbOutFile);
					console.log(thumbOutFile);
				}
				i += 1;
				console.log(outFile);
			} else if (ext === '.mp4' || ext === '.m4v' || ext === '.mov') {
				const videoTrackProps = await getVideoTrackProps(file);
				const w = videoTrackProps.width;
				const h = videoTrackProps.height;
				if (!w || !h) {
					throw 'missing video dimensions';
				}
				const resolutions = [240, 360, 576];
				if (h > 576) {
					resolutions.push(720);
				}
				if (h > 720) {
					resolutions.push(1080);
				}
				console.log('encoding video', file, '...');
				const { videoFile } = await encodeHLSVideo(
					file,
					gallerySlug,
					resolutions
				);
				const thumbPath = path.join(gallerySlug, parsed.name, 'thumb.jpg');
				await generateVideoThumbnail(file, thumbPath);

				data.slides.push({
					video: `https://media.zenplus.uk/miranda/projects/${videoFile}`,
					width: w,
					height: h,
					thumb: `https://media.zenplus.uk/miranda/projects/${thumbPath}`,
					caption: '',
				});
				i += 1;
			}
		}
		const tsSource = toSource(data, undefined, '\t');
		let outStr = `import { ArtProject } from '.';

const ${galleryCamel}: ArtProject = ${tsSource};

export default ${galleryCamel};
`;
		fs.writeFileSync(`${galleryCamel}.ts`, outStr);
		console.log(`${galleryCamel}.ts`);
	} catch (error) {
		console.error('error:', error);
	}
}

prepareGallery();
