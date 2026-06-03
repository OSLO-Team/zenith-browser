const os = require('os');

const TELEMETRY_MAX_EVENTS = 100;
const TELEMETRY_MAX_CRASHES = 50;
const TELEMETRY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const TELEMETRY_MAX_DATA_BYTES = 8192;
const TELEMETRY_MAX_STRING_LENGTH = 600;
const TELEMETRY_MAX_STACK_LENGTH = 8000;

function normalizeTelemetryAction(action) {
  return String(action || 'unknown-event')
    .replace(/[^\w:.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown-event';
}

function sanitizeTelemetryUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.origin;
    if (parsed.protocol === 'file:') return '[local-file]';
    return parsed.protocol ? `[${parsed.protocol.replace(':', '')}-url]` : '[redacted-url]';
  } catch (error) {
    return '[redacted-url]';
  }
}

function scrubSensitiveText(value, maxLength = TELEMETRY_MAX_STRING_LENGTH) {
  return String(value || '')
    .replace(/\bhttps?:\/\/[^\s"'<>]+/gi, match => sanitizeTelemetryUrl(match))
    .replace(/file:\/\/\/[^\s"'<>]+/gi, '[local-file]')
    .replace(/[A-Za-z]:\\[^\s)"'<>]+/g, '[local-path]')
    .replace(/[?&](token|access_token|refresh_token|auth|key|password|secret|code|session|sid)=([^&\s]+)/gi, '$1=[redacted]')
    .slice(0, maxLength);
}

function limitTelemetryData(value) {
  try {
    const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
    if (bytes <= TELEMETRY_MAX_DATA_BYTES) return value;
    return {
      truncated: true,
      originalBytes: bytes,
      reason: 'Telemetry data exceeded local size limit.'
    };
  } catch (error) {
    return { truncated: true, reason: 'Telemetry data could not be serialized.' };
  }
}

function sanitizeTelemetryValue(value, key = '', depth = 0) {
  const normalizedKey = String(key || '').toLowerCase();
  if (value === null || value === undefined) return value;
  if (typeof value === 'boolean' || typeof value === 'number') return value;

  if (/url|uri|href|link/.test(normalizedKey)) return sanitizeTelemetryUrl(value);
  if (/title|query|search|token|password|secret|authorization|cookie|email|username|space/.test(normalizedKey)) return '[redacted]';
  if (typeof value === 'string') return scrubSensitiveText(value);
  if (Array.isArray(value)) {
    if (depth >= 4) return '[truncated]';
    return value.slice(0, 20).map(item => sanitizeTelemetryValue(item, key, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth >= 4) return '[truncated]';
    const sanitized = {};
    Object.entries(value).slice(0, 40).forEach(([entryKey, entryValue]) => {
      sanitized[entryKey] = sanitizeTelemetryValue(entryValue, entryKey, depth + 1);
    });
    return limitTelemetryData(sanitized);
  }
  return scrubSensitiveText(value);
}

function pruneTelemetryEntries(entries, maxEntries) {
  const cutoff = Date.now() - TELEMETRY_MAX_AGE_MS;
  return (Array.isArray(entries) ? entries : [])
    .filter(entry => {
      const timestamp = Number(entry?.timestamp);
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    })
    .slice(-maxEntries);
}

function safeRound(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function createTelemetryService({ telemetryStore, settingsStore, app, getRuntimeSnapshot = () => ({}) }) {
  function getPerformanceSnapshot() {
    const memory = process.memoryUsage();
    const cpu = typeof process.getCPUUsage === 'function' ? process.getCPUUsage() : null;
    const runtime = getRuntimeSnapshot() || {};
    return sanitizeTelemetryValue({
      capturedAt: new Date().toISOString(),
      process: {
        rssMb: safeRound(memory.rss / 1024 / 1024),
        heapUsedMb: safeRound(memory.heapUsed / 1024 / 1024),
        heapTotalMb: safeRound(memory.heapTotal / 1024 / 1024),
        externalMb: safeRound(memory.external / 1024 / 1024),
        cpuPercent: cpu ? safeRound(cpu.percentCPUUsage) : 0,
        idleWakeupsPerSecond: cpu ? safeRound(cpu.idleWakeupsPerSecond) : 0
      },
      system: {
        freeMemMb: Math.round(os.freemem() / 1024 / 1024),
        totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
        loadAverage: os.loadavg().map(value => safeRound(value)),
        uptimeSeconds: Math.round(os.uptime())
      },
      app: {
        version: typeof app?.getVersion === 'function' ? app.getVersion() : '',
        windows: runtime.windows || 0,
        tabs: runtime.tabs || 0,
        sleepingTabs: runtime.sleepingTabs || 0,
        performanceMode: settingsStore.get('performanceMode') || 'balanced'
      }
    });
  }

  function getTelemetryLogsSnapshot({ writeBack = false, includePerformance = true } = {}) {
    const events = pruneTelemetryEntries(telemetryStore.get('events') || [], TELEMETRY_MAX_EVENTS);
    const crashes = pruneTelemetryEntries(telemetryStore.get('crashes') || [], TELEMETRY_MAX_CRASHES);
    if (writeBack) {
      telemetryStore.set('events', events);
      telemetryStore.set('crashes', crashes);
    }
    const snapshot = { events, crashes };
    if (includePerformance) snapshot.performanceSnapshot = getPerformanceSnapshot();
    return snapshot;
  }

  function clearTelemetryLogs() {
    telemetryStore.replace({ events: [], crashes: [] });
  }

  function storeTelemetryEvent(action, data) {
    if (!settingsStore.get('telemetryEnabled')) return;
    const logs = getTelemetryLogsSnapshot({ includePerformance: false });
    logs.events.push({
      timestamp: Date.now(),
      action: normalizeTelemetryAction(action),
      data: {
        ...sanitizeTelemetryValue(data || {}),
        performanceSnapshot: getPerformanceSnapshot()
      }
    });
    telemetryStore.set('events', pruneTelemetryEntries(logs.events, TELEMETRY_MAX_EVENTS));
  }

  function storeTelemetryCrash(processName, message, stack = '', details = undefined) {
    if (!settingsStore.get('telemetryEnabled')) return;
    const logs = getTelemetryLogsSnapshot({ includePerformance: false });
    logs.crashes.push({
      timestamp: Date.now(),
      message: scrubSensitiveText(message || 'Unknown error', TELEMETRY_MAX_STRING_LENGTH),
      stack: scrubSensitiveText(stack || '', TELEMETRY_MAX_STACK_LENGTH),
      process: String(processName || 'unknown').slice(0, 40),
      details: details === undefined ? undefined : sanitizeTelemetryValue(details),
      performanceSnapshot: getPerformanceSnapshot()
    });
    telemetryStore.set('crashes', pruneTelemetryEntries(logs.crashes, TELEMETRY_MAX_CRASHES));
  }

  return {
    clearTelemetryLogs,
    getPerformanceSnapshot,
    getTelemetryLogsSnapshot,
    storeTelemetryCrash,
    storeTelemetryEvent
  };
}

module.exports = {
  createTelemetryService
};
