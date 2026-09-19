/**
 * ============================================================================
 * Traceroute Visualizer - Server
 * ============================================================================
 * Computer Networks Mini Project
 * 
 * Express backend that executes real Windows 'tracert' networking commands
 * safely using Node.js child_process.spawn (preventing command injection)
 * and streams parsed real-time hop data to the client using Server-Sent Events (SSE).
 * ============================================================================
 */

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Track running processes by session ID for safe cancellation
const activeProcesses = new Map();

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

/**
 * Validates user-provided destination string.
 * Strictly checks for valid IPv4, IPv6, or Domain Name / Hostname.
 * Rejects any special characters, spaces, or injection attempts.
 */
function isValidDestination(input) {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 253) return false;

  // IPv4 regex (0.0.0.0 to 255.255.255.255)
  const ipv4Regex = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  if (ipv4Regex.test(trimmed)) return true;

  // IPv6 regex
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(([0-9a-fA-F]{1,4}:){1,7}|:):((:[0-9a-fA-F]{1,4}){1,7}|:)$/;
  if (ipv6Regex.test(trimmed)) return true;

  // Domain / Hostname regex (RFC 1123 compliant, e.g., google.com, sub.domain.org, localhost)
  const domainRegex = /^(?=.{1,253}$)(localhost|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;
  if (domainRegex.test(trimmed)) return true;

  return false;
}

/**
 * Parses individual output lines from the Windows 'tracert' command.
 * Extracts hop index, 3 probe latency values, resolved hostname, and IP address.
 */
function parseTracertHop(line) {
  const trimmed = line.trim();
  // Hop lines start with a hop number e.g. " 1    <1 ms    <1 ms    <1 ms  192.168.1.1"
  const hopMatch = trimmed.match(/^(\d+)\s+(.+)$/);
  if (!hopMatch) return null;

  const hopNum = parseInt(hopMatch[1], 10);
  const rest = hopMatch[2].trim();

  // Check if hop timed out completely
  const isAllTimeout = rest.includes('Request timed out') && !rest.match(/\b\d+\s*ms\b/i) && !rest.includes('<1 ms');

  if (isAllTimeout) {
    return {
      hop: hopNum,
      rtt1: '*',
      rtt2: '*',
      rtt3: '*',
      rtts: [],
      avgLatency: '—',
      avgLatencyValue: null,
      hostname: '—',
      ip: '—',
      status: 'Timeout',
      raw: line
    };
  }

  // Extract up to 3 RTT probe tokens: `<1 ms`, `15 ms`, `*`, etc.
  const rttRegex = /(<\s*1\s*ms|\d+\s*ms|\*)/gi;
  const rtts = [];
  let lastIndex = 0;
  let match;

  while ((match = rttRegex.exec(rest)) !== null && rtts.length < 3) {
    rtts.push(match[1].trim());
    lastIndex = rttRegex.lastIndex;
  }

  const endpointPart = rest.substring(lastIndex).trim();

  let hostname = '—';
  let ip = '—';

  if (endpointPart && endpointPart !== 'Request timed out.') {
    // Format: "hostname [ip]" or "ip" or "hostname"
    const hostWithIp = endpointPart.match(/^([^\s\[]+)\s+\[([^\]]+)\]/);
    if (hostWithIp) {
      hostname = hostWithIp[1];
      ip = hostWithIp[2];
    } else {
      const isIp = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(endpointPart) || endpointPart.includes(':');
      if (isIp) {
        ip = endpointPart;
        hostname = '—';
      } else {
        hostname = endpointPart;
      }
    }
  }

  // Calculate average latency from valid probes
  const validNumbers = [];
  rtts.forEach(r => {
    if (r.startsWith('<')) {
      validNumbers.push(0.5); // "<1 ms" represented as 0.5ms for calculation
    } else {
      const parsed = parseFloat(r);
      if (!isNaN(parsed) && r.toLowerCase().includes('ms')) {
        validNumbers.push(parsed);
      }
    }
  });

  let avgLatency = '—';
  let avgLatencyVal = null;
  if (validNumbers.length > 0) {
    const sum = validNumbers.reduce((a, b) => a + b, 0);
    avgLatencyVal = Math.round((sum / validNumbers.length) * 10) / 10;
    avgLatency = avgLatencyVal < 1 ? '<1 ms' : `${avgLatencyVal} ms`;
  }

  const status = validNumbers.length > 0 ? 'Online' : 'Timeout';

  return {
    hop: hopNum,
    rtt1: rtts[0] || '*',
    rtt2: rtts[1] || '*',
    rtt3: rtts[2] || '*',
    rtts: validNumbers,
    avgLatency: avgLatency,
    avgLatencyValue: avgLatencyVal,
    hostname: hostname,
    ip: ip,
    status: status,
    raw: line
  };
}

/**
 * GET /api/info
 * Returns server network environment information.
 */
app.get('/api/info', (req, res) => {
  res.json({
    platform: os.platform(),
    osType: os.type(),
    osRelease: os.release(),
    hostname: os.hostname(),
    protocol: 'ICMP / Traceroute',
    command: os.platform() === 'win32' ? 'tracert' : 'traceroute'
  });
});

/**
 * GET /api/trace
 * Streams real-time traceroute execution via Server-Sent Events (SSE).
 */
app.get('/api/trace', (req, res) => {
  const destination = (req.query.destination || '').trim();
  const sessionId = req.query.sessionId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const maxHops = Math.min(Math.max(parseInt(req.query.maxHops, 10) || 30, 1), 30);

  // Validate destination
  if (!destination) {
    return res.status(400).json({ error: 'Please enter a destination.' });
  }

  if (!isValidDestination(destination)) {
    return res.status(400).json({ error: 'Please enter a valid domain name or IP address.' });
  }

  // Setup Server-Sent Events (SSE) headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'tracert' : 'traceroute';

  // Build arguments array safely without shell interpolation
  // Windows: tracert -h <maxHops> -w <timeout_ms> <destination>
  const args = isWindows
    ? ['-h', String(maxHops), '-w', '1500', destination]
    : ['-m', String(maxHops), '-w', '2', destination];

  sendEvent('start', {
    sessionId,
    destination,
    command: `${command} ${args.join(' ')}`,
    timestamp: new Date().toISOString()
  });

  let child;
  try {
    // Spawn binary directly - safe from command injection
    child = spawn(command, args, {
      shell: false,
      windowsHide: true
    });
  } catch (err) {
    sendEvent('error', { message: `Traceroute command is unavailable on this system: ${err.message}` });
    return res.end();
  }

  activeProcesses.set(sessionId, child);

  let buffer = '';
  const hops = [];
  let headerFound = false;
  let resolvedTarget = destination;
  let resolvedIp = '—';
  const startTime = Date.now();

  const processLine = (line) => {
    if (!line || !line.trim()) return;
    const cleanLine = line.trim();

    // Stream raw line to client
    sendEvent('raw', { line: cleanLine });

    // Look for target header e.g. "Tracing route to google.com [142.250.193.206]"
    if (!headerFound) {
      const headerMatch = cleanLine.match(/Tracing route to\s+(?:([^\s\[]+)\s+)?\[?([0-9a-fA-F\.:]+)\]?/i);
      if (headerMatch) {
        headerFound = true;
        if (headerMatch[1]) resolvedTarget = headerMatch[1];
        if (headerMatch[2]) resolvedIp = headerMatch[2];
        sendEvent('header', {
          destination,
          targetHost: resolvedTarget,
          targetIp: resolvedIp
        });
        return;
      }
    }

    // Check for common error lines
    if (cleanLine.includes('Unable to resolve target') || cleanLine.includes('cannot resolve')) {
      sendEvent('error', { message: `Unable to resolve destination "${destination}". Please check the hostname.` });
      return;
    }

    if (cleanLine.includes('Destination host unreachable')) {
      sendEvent('error', { message: `Destination host "${destination}" is unreachable.` });
      return;
    }

    // Try parsing as a hop line
    const parsedHop = parseTracertHop(cleanLine);
    if (parsedHop) {
      hops.push(parsedHop);
      sendEvent('hop', parsedHop);
    }
  };

  child.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split(/\r?\n/);
    // Keep last incomplete chunk in buffer
    buffer = lines.pop();
    for (const line of lines) {
      processLine(line);
    }
  });

  child.stderr.on('data', (data) => {
    const errText = data.toString().trim();
    if (errText) {
      sendEvent('raw', { line: `[STDERR] ${errText}` });
    }
  });

  child.on('error', (err) => {
    sendEvent('error', { message: `Process execution error: ${err.message}` });
  });

  child.on('close', (code, signal) => {
    // Process remaining buffer
    if (buffer && buffer.trim()) {
      processLine(buffer);
      buffer = '';
    }

    activeProcesses.delete(sessionId);

    // Compute final summary
    const totalHops = hops.length;
    const successfulHops = hops.filter(h => h.status === 'Online').length;
    const failedHops = hops.filter(h => h.status === 'Timeout').length;

    // Collect all valid latency numbers across hops
    const allLatencies = [];
    hops.forEach(h => {
      if (h.avgLatencyValue !== null) {
        allLatencies.push(h.avgLatencyValue);
      }
    });

    let overallAvgLatency = '—';
    if (allLatencies.length > 0) {
      const avg = Math.round((allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length) * 10) / 10;
      overallAvgLatency = avg < 1 ? '<1 ms' : `${avg} ms`;
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

    sendEvent('complete', {
      stopped: signal === 'SIGTERM' || signal === 'SIGINT',
      exitCode: code,
      totalHops,
      successfulHops,
      failedHops,
      overallAvgLatency,
      durationSeconds: `${durationSeconds}s`,
      hopsCount: hops.length
    });

    res.end();
  });

  // If client disconnects or closes tab, stop the child process
  req.on('close', () => {
    if (activeProcesses.has(sessionId)) {
      const p = activeProcesses.get(sessionId);
      try {
        if (isWindows) {
          spawn('taskkill', ['/pid', p.pid.toString(), '/f', '/t']);
        } else {
          p.kill('SIGTERM');
        }
      } catch (_) {}
      activeProcesses.delete(sessionId);
    }
  });
});

/**
 * POST /api/stop
 * Terminates the actively running traceroute child process safely.
 */
app.post('/api/stop', (req, res) => {
  const { sessionId } = req.body || {};

  let killed = false;
  if (sessionId && activeProcesses.has(sessionId)) {
    const p = activeProcesses.get(sessionId);
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', p.pid.toString(), '/f', '/t']);
      } else {
        p.kill('SIGTERM');
      }
      killed = true;
    } catch (e) {
      console.error('Error killing process:', e);
    }
    activeProcesses.delete(sessionId);
  } else {
    // If no specific sessionId, kill any active traceroute process
    for (const [sId, p] of activeProcesses.entries()) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', p.pid.toString(), '/f', '/t']);
        } else {
          p.kill('SIGTERM');
        }
        killed = true;
      } catch (_) {}
      activeProcesses.delete(sId);
    }
  }

  res.json({ success: true, killed });
});

// Start Express server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Traceroute Visualizer Server running`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`💻 OS: ${os.type()} (${os.platform()})`);
  console.log(`====================================================`);
});
