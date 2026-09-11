import { writeFile } from 'node:fs/promises';

const apiBaseUrl = process.env.APPINGPONG_API_URL?.trim().replace(/\/+$/, '');
if (!apiBaseUrl) throw new Error('APPINGPONG_API_URL is required');
if (!apiBaseUrl.startsWith('https://')) throw new Error('APPINGPONG_API_URL must use https://');

await writeFile('public/runtime-config.json', `${JSON.stringify({ apiBaseUrl }, null, 2)}\n`, 'utf8');
