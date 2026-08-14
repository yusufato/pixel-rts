'use strict';

function isDiscreteGpuDeviceName(value) {
    const name = String(value || '').trim();
    return /\bNVIDIA\b|\bGeForce\b|\bRTX\b|\bQuadro\b|\bRadeon\s+(?:RX|PRO\s+W)|\bIntel\(R\)?\s+Arc\b/i
        .test(name);
}

function hasDiscreteGpuDevice(devices) {
    return Array.isArray(devices) && devices.some(isDiscreteGpuDeviceName);
}

module.exports = { isDiscreteGpuDeviceName, hasDiscreteGpuDevice };
