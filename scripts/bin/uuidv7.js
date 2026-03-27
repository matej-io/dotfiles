#!/usr/bin/env node

import { uuidv7obj } from 'uuidv7';
import { Uuid25 } from 'uuid25';

const times = process.argv[2] ? parseInt(process.argv[2], 10) : 1;

for (let i = 0; i < times; i++) {
	console.log(Uuid25.fromBytes(uuidv7obj().bytes).value);
}
