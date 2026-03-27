import { exec as rootExec } from 'child_process';

export default function exec(cmd: string) {
	return new Promise((resolve, reject) => {
		rootExec(cmd, (error, stdout, stderr) => {
			if (error) {
				console.warn(error);
				reject(error);
			} else {
				resolve(stdout);
			}
		});
	});
}
