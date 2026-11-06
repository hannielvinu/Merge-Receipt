import {readFileSync} from 'node:fs';
import {diagnose, formatDiagnosis} from './diagnose.mjs';

const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));
const id = process.argv[2]?.toUpperCase();
const result = diagnose(cases.find(entry => entry.id === id));
console.log(process.argv.includes('--json') ? JSON.stringify(result, null, 2) : formatDiagnosis(result));
if (result.status === 'INSUFFICIENT_EVIDENCE') process.exitCode = 2;
