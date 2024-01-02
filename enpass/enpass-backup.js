#!/usr/bin/env node

const fs = require('fs')

const destinations = {
	diskMatej: {
		type: 'offline'
	},
	diskMiranda: {
		type: 'offline'
	},
	diskMatejOld: {
		type: 'offline'
	},
	preview: {
		type: 'ssh'
	},
	zenplus: {
		type: 'ssh'
	},
	googleDrive: {
		type: 'remote'
	}
}


const text = fs.readFileSync('test.txt', { encoding: 'utf8'})
const lines = text.split('\n')
const passwords = {}
for (const line in lines) {
	const keyval = line.split('=')
	if (keyval.length === 2) {
		passwords[keyval[0]] = keyval[1]
	}
}
console.log('text', text)


// master password decrypts passwords file
// passwords file contains 2 of 3 passwords, the two passwords unlock the enpass backup on other computers than this one
// encrypt enpass backup


// download/copy 2 distinct passwords files to get all 3 encryption passwords (one from zen+ one from matej's disk)
// read passwords
// encrypt backup with all 3 passeords
// produce files for different destinations
// yey



