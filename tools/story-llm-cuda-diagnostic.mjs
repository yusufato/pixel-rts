import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { testBindingBinary } from '../node_modules/node-llama-cpp/dist/bindings/utils/testBindingBinary.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binding = path.join(root, 'node_modules', '@node-llama-cpp', 'win-x64-cuda',
    'bins', 'win-x64-cuda', 'llama-addon.node');
const extensions = path.join(root, 'node_modules', '@node-llama-cpp', 'win-x64-cuda-ext',
    'bins', 'win-x64-cuda');

const compatible = await testBindingBinary(binding, extensions, 'cuda', 30000, true);
process.stdout.write(`${JSON.stringify({ compatible, runtime: process.version,
    execPath: process.execPath, binding, extensions })}\n`);
process.exitCode = compatible ? 0 : 2;
