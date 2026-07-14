const dgram = require('dgram');
const appConfig = require('../config/app.config');

const statsdConfig = appConfig.statsd || {};
let socket;

function getSocket() {
  if (!socket) {
    socket = dgram.createSocket('udp4');
  }
  return socket;
}

function formatMetric(metric) {
  const prefix = statsdConfig.prefix || '';
  return prefix ? `${prefix}.${metric}` : metric;
}

function send(metric, value, type) {
  if (!statsdConfig.enabled) return;
  try {
    const message = `${formatMetric(metric)}:${value}|${type}`;
    const buffer = Buffer.from(message);
    getSocket().send(buffer, 0, buffer.length, statsdConfig.port, statsdConfig.host);
  } catch (error) {
    console.warn('statsd send failed:', error.message);
  }
}

function increment(metric, value = 1) {
  send(metric, value, 'c');
}

function timing(metric, ms) {
  send(metric, ms, 'ms');
}

module.exports = {
  increment,
  timing,
};
