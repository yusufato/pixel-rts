'use strict';

const assert = require('node:assert/strict');
const { isDiscreteGpuDeviceName, hasDiscreteGpuDevice } = require('../electron/llm-gpu-policy');

assert.equal(isDiscreteGpuDeviceName('Intel(R) UHD Graphics'), false);
assert.equal(isDiscreteGpuDeviceName('Intel(R) Iris(R) Xe Graphics'), false);
assert.equal(isDiscreteGpuDeviceName('AMD Radeon Graphics'), false);
assert.equal(isDiscreteGpuDeviceName('NVIDIA GeForce RTX 4060 Laptop GPU'), true);
assert.equal(isDiscreteGpuDeviceName('AMD Radeon RX 7800 XT'), true);
assert.equal(isDiscreteGpuDeviceName('Intel(R) Arc(TM) A770 Graphics'), true);
assert.equal(hasDiscreteGpuDevice(['Intel(R) UHD Graphics']), false);
assert.equal(hasDiscreteGpuDevice(['Intel(R) UHD Graphics', 'NVIDIA GeForce RTX 4060 Laptop GPU']), true);
assert.equal(hasDiscreteGpuDevice([]), false);

process.stdout.write(`${JSON.stringify({ ok: true, gpuPolicyAssertions: 9 })}\n`);
