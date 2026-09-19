/**
 * ============================================================================
 * Traceroute Visualizer - Client Logic
 * ============================================================================
 * Computer Networks Mini Project
 * 
 * Interacts with Express SSE streaming endpoint to visualize real Windows
 * 'tracert' packets live, hop-by-hop.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const traceForm = document.getElementById('trace-form');
  const destInput = document.getElementById('destination-input');
  const clearInputBtn = document.getElementById('clear-input-btn');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const presetChips = document.querySelectorAll('.preset-chip');

  // Status Banner Elements
  const statusBanner = document.getElementById('status-banner');
  const bannerSpinner = document.getElementById('banner-spinner');
  const bannerIcon = document.getElementById('banner-icon');
  const bannerTitle = document.getElementById('banner-title');
  const bannerDetail = document.getElementById('banner-detail');

  // Meta Bar Elements
  const metaLocalHost = document.getElementById('meta-local-host');
  const metaDestination = document.getElementById('meta-destination');
  const metaProtocol = document.getElementById('meta-protocol');
  const metaHopCount = document.getElementById('meta-hop-count');
  const metaDuration = document.getElementById('meta-duration');
  const systemOsBadge = document.getElementById('system-os-badge');

  // Summary Metrics Elements
  const sumDest = document.getElementById('sum-dest');
  const sumDestIp = document.getElementById('sum-dest-ip');
  const sumTotalHops = document.getElementById('sum-total-hops');
  const sumSuccessHops = document.getElementById('sum-success-hops');
  const sumFailedHops = document.getElementById('sum-failed-hops');
  const sumAvgLatency = document.getElementById('sum-avg-latency');

  // Visual Route Elements
  const routeContainer = document.getElementById('visual-route-container');
  const routeEmptyMsg = document.getElementById('route-empty-msg');
  const clientNode = document.getElementById('client-node');

  // Hop Table Elements
  const hopTableBody = document.getElementById('hop-table-body');
  const tableCounter = document.getElementById('table-counter');

  // Hop Inspector Elements
  const detHopNum = document.getElementById('det-hop-num');
  const detHostname = document.getElementById('det-hostname');
  const detIp = document.getElementById('det-ip');
  const detStatus = document.getElementById('det-status');
  const detRtt1 = document.getElementById('det-rtt1');
  const detRtt2 = document.getElementById('det-rtt2');
  const detRtt3 = document.getElementById('det-rtt3');
  const detAvgLatency = document.getElementById('det-avg-latency');

  // Terminal Elements
  const rawTerminalBody = document.getElementById('raw-terminal-body');
  const rawOutputPre = document.getElementById('raw-output-pre');
  const toggleRawBtn = document.getElementById('toggle-raw-btn');
  const toggleRawText = document.getElementById('toggle-raw-text');
  const copyRawBtn = document.getElementById('copy-raw-btn');

  // State
  let eventSource = null;
  let currentSessionId = null;
  let isRunning = false;
  let timerInterval = null;
  let startTime = null;
  let hopsData = [];
  let rawTextLogs = '';
  let selectedHopIndex = null;
  let resolvedTargetIp = '—';
  let targetHostname = '';

  // --------------------------------------------------------------------------
  // Initialize Server & Network Info
  // --------------------------------------------------------------------------
  async function fetchSystemInfo() {
    try {
      const res = await fetch('/api/info');
      if (res.ok) {
        const info = await res.json();
        metaLocalHost.textContent = info.hostname ? `${info.hostname} (${info.platform})` : 'Client Host';
        systemOsBadge.textContent = `${info.command.toUpperCase()} (${info.osType || info.platform})`;
        metaProtocol.textContent = `ICMP / ${info.command}`;
      }
    } catch (_) {
      // Fallback
    }
  }
  fetchSystemInfo();

  // --------------------------------------------------------------------------
  // Preset Buttons Handling
  // --------------------------------------------------------------------------
  presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const dest = chip.getAttribute('data-dest');
      destInput.value = dest;
      destInput.focus();
      updateClearBtnVisibility();
    });
  });

  destInput.addEventListener('input', updateClearBtnVisibility);

  function updateClearBtnVisibility() {
    clearInputBtn.style.display = destInput.value.trim() ? 'block' : 'none';
  }

  clearInputBtn.addEventListener('click', () => {
    destInput.value = '';
    destInput.focus();
    updateClearBtnVisibility();
  });

  // --------------------------------------------------------------------------
  // Form Submission / Start Traceroute
  // --------------------------------------------------------------------------
  traceForm.addEventListener('submit', (e) => {
    e.preventDefault();
    startTraceroute();
  });

  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    startTraceroute();
  });

  stopBtn.addEventListener('click', () => {
    stopTraceroute('Traceroute stopped by user.');
  });

  function validateInput(destination) {
    if (!destination) {
      showBanner('error', 'Validation Error', 'Please enter a destination.');
      return false;
    }

    const domainOrIpRegex = /^(localhost|[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*|([0-9a-fA-F:.]*))$/;
    if (!domainOrIpRegex.test(destination) || destination.length > 253) {
      showBanner('error', 'Invalid Input', 'Please enter a valid domain name or IP address.');
      return false;
    }
    return true;
  }

  function startTraceroute() {
    const destination = destInput.value.trim();

    if (!validateInput(destination)) {
      return;
    }

    if (isRunning) {
      return;
    }

    // Reset UI State
    resetState();
    isRunning = true;
    currentSessionId = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    targetHostname = destination;

    // UI Loading state
    startBtn.disabled = true;
    stopBtn.disabled = false;
    destInput.disabled = true;

    metaDestination.textContent = destination;
    sumDest.textContent = destination;
    sumDestIp.textContent = 'Resolving IP...';

    showBanner('running', 'Running Traceroute…', `Initiating real ICMP trace to ${destination}...`);
    rawOutputPre.innerHTML = `<code>Executing command: tracert ${destination}\n====================================================\n</code>`;
    rawTextLogs = `Executing command: tracert ${destination}\n\n`;

    // Start Timer
    startTime = Date.now();
    metaDuration.textContent = '0.0s';
    timerInterval = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      metaDuration.textContent = `${elapsed}s`;
    }, 100);

    // Open SSE Connection
    const sseUrl = `/api/trace?destination=${encodeURIComponent(destination)}&sessionId=${currentSessionId}&maxHops=30`;
    eventSource = new EventSource(sseUrl);

    eventSource.addEventListener('start', (e) => {
      const data = JSON.parse(e.data);
      appendRawOutput(`[INIT] Target: ${data.destination} | Command: ${data.command}\n`);
    });

    eventSource.addEventListener('header', (e) => {
      const data = JSON.parse(e.data);
      if (data.targetIp && data.targetIp !== '—') {
        resolvedTargetIp = data.targetIp;
        sumDestIp.textContent = `IP: ${data.targetIp}`;
      }
      if (data.targetHost) {
        metaDestination.textContent = `${data.targetHost} [${data.targetIp || destination}]`;
      }
    });

    eventSource.addEventListener('hop', (e) => {
      const hop = JSON.parse(e.data);
      handleNewHop(hop);
    });

    eventSource.addEventListener('raw', (e) => {
      const data = JSON.parse(e.data);
      appendRawOutput(`${data.line}\n`);
    });

    eventSource.addEventListener('error', (e) => {
      let msg = 'Connection error with traceroute backend.';
      try {
        if (e.data) {
          const parsed = JSON.parse(e.data);
          msg = parsed.message || msg;
        }
      } catch (_) {}

      showBanner('error', 'Trace Notice', msg);
    });

    eventSource.addEventListener('complete', (e) => {
      const summary = JSON.parse(e.data);
      finishTraceroute(summary);
    });

    eventSource.onerror = () => {
      if (isRunning) {
        // Stream completed or terminated
        finishTraceroute();
      }
    };
  }

  // --------------------------------------------------------------------------
  // Process Incoming Hop
  // --------------------------------------------------------------------------
  function handleNewHop(hop) {
    hopsData.push(hop);
    const hopCount = hopsData.length;

    // Update Counts & Live Banner
    metaHopCount.textContent = hopCount;
    tableCounter.textContent = `${hopCount} Hop${hopCount > 1 ? 's' : ''}`;

    if (hop.status === 'Online') {
      showBanner('running', 'Running Traceroute…', `Hop ${hop.hop}: ${hop.ip !== '—' ? hop.ip : hop.hostname} (${hop.avgLatency})`);
    } else {
      showBanner('running', 'Running Traceroute…', `Hop ${hop.hop}: Request timed out (* * *)`);
    }

    // Calculate dynamic live metrics
    updateSummaryMetrics();

    // Append to Visual Route
    renderVisualHop(hop);

    // Append to Hop Table
    renderTableHop(hop);

    // If first hop, inspect it
    if (hopCount === 1) {
      selectHop(0);
    }
  }

  // --------------------------------------------------------------------------
  // Visual Route Rendering
  // --------------------------------------------------------------------------
  function renderVisualHop(hop) {
    if (routeEmptyMsg) {
      routeEmptyMsg.style.display = 'none';
    }

    // Create Connector line
    const connector = document.createElement('div');
    connector.className = 'route-connector animated';
    connector.innerHTML = `
      <div class="connector-line"></div>
      <div class="connector-arrow">➔</div>
    `;
    routeContainer.appendChild(connector);

    // Create Hop Node Card
    const isTimeout = hop.status === 'Timeout';
    const node = document.createElement('div');
    node.className = `route-node ${isTimeout ? 'node-timeout' : 'node-online'}`;
    node.id = `route-node-${hop.hop}`;
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.setAttribute('aria-label', `Hop ${hop.hop}: ${hop.hostname || hop.ip}, Status ${hop.status}`);

    const icon = isTimeout ? '⚠️' : '🔀';
    const titleText = isTimeout ? 'Timeout' : (hop.hostname !== '—' ? hop.hostname : (hop.ip !== '—' ? hop.ip : 'Router'));
    const ipText = hop.ip !== '—' ? hop.ip : (isTimeout ? 'No Response' : 'Unknown IP');
    const pillClass = isTimeout ? 'pill-timeout' : 'pill-online';
    const pillText = isTimeout ? 'Timeout' : hop.avgLatency;

    node.innerHTML = `
      <div class="node-icon-box">${icon}</div>
      <div class="node-body">
        <div class="node-tag">HOP ${hop.hop}</div>
        <div class="node-name" title="${titleText}">${titleText}</div>
        <div class="node-ip">${ipText}</div>
        <span class="node-latency-pill ${pillClass}">${pillText}</span>
      </div>
    `;

    const hopIndex = hopsData.length - 1;
    node.addEventListener('click', () => selectHop(hopIndex));
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectHop(hopIndex);
      }
    });

    routeContainer.appendChild(node);

    // Smooth scroll route to right as nodes appear
    const viewport = document.getElementById('route-viewport');
    viewport.scrollTo({ left: viewport.scrollWidth, behavior: 'smooth' });
  }

  function renderDestinationNode() {
    // Check if target is already shown as final node
    const connector = document.createElement('div');
    connector.className = 'route-connector animated';
    connector.innerHTML = `
      <div class="connector-line"></div>
      <div class="connector-arrow">➔</div>
    `;
    routeContainer.appendChild(connector);

    const destNode = document.createElement('div');
    destNode.className = 'route-node node-dest';
    destNode.id = 'route-node-dest';
    destNode.setAttribute('role', 'button');
    destNode.setAttribute('tabindex', '0');

    destNode.innerHTML = `
      <div class="node-icon-box">🎯</div>
      <div class="node-body">
        <div class="node-tag">DESTINATION</div>
        <div class="node-name" title="${targetHostname}">${targetHostname}</div>
        <div class="node-ip">${resolvedTargetIp !== '—' ? resolvedTargetIp : 'Target Reached'}</div>
        <span class="node-latency-pill pill-online">Final Destination</span>
      </div>
    `;

    routeContainer.appendChild(destNode);
    const viewport = document.getElementById('route-viewport');
    viewport.scrollTo({ left: viewport.scrollWidth, behavior: 'smooth' });
  }

  // --------------------------------------------------------------------------
  // Table Rendering
  // --------------------------------------------------------------------------
  function renderTableHop(hop) {
    // Remove empty placeholder row
    const emptyRow = hopTableBody.querySelector('.empty-table-row');
    if (emptyRow) {
      emptyRow.remove();
    }

    const row = document.createElement('tr');
    row.id = `table-row-${hop.hop}`;
    const hopIndex = hopsData.length - 1;

    const isTimeout = hop.status === 'Timeout';
    const statusBadge = isTimeout
      ? `<span class="status-badge badge-timeout">Timeout</span>`
      : `<span class="status-badge badge-online">Online</span>`;

    row.innerHTML = `
      <td><strong>#${hop.hop}</strong></td>
      <td class="text-truncate" style="max-width: 200px;">${escapeHtml(hop.hostname)}</td>
      <td class="font-mono">${escapeHtml(hop.ip)}</td>
      <td class="font-mono ${isTimeout ? 'text-danger' : 'text-success'}">${escapeHtml(hop.avgLatency)}</td>
      <td>${statusBadge}</td>
    `;

    row.addEventListener('click', () => selectHop(hopIndex));
    hopTableBody.appendChild(row);
  }

  // --------------------------------------------------------------------------
  // Hop Inspector Selection
  // --------------------------------------------------------------------------
  function selectHop(index) {
    if (index < 0 || index >= hopsData.length) return;
    selectedHopIndex = index;
    const hop = hopsData[index];

    // Update active highlight classes in visual route
    document.querySelectorAll('.route-node').forEach(n => n.classList.remove('active-selected'));
    const activeNode = document.getElementById(`route-node-${hop.hop}`);
    if (activeNode) activeNode.classList.add('active-selected');

    // Update active row in table
    document.querySelectorAll('#hop-table-body tr').forEach(r => r.classList.remove('row-selected'));
    const activeRow = document.getElementById(`table-row-${hop.hop}`);
    if (activeRow) activeRow.classList.add('row-selected');

    // Populate Inspector Fields
    detHopNum.textContent = `Hop ${hop.hop}`;
    detHostname.textContent = hop.hostname !== '—' ? hop.hostname : 'No reverse DNS record';
    detIp.textContent = hop.ip !== '—' ? hop.ip : 'Request timed out';
    detStatus.textContent = hop.status;
    detStatus.className = `detail-val ${hop.status === 'Online' ? 'text-success' : 'text-danger'}`;

    detRtt1.textContent = hop.rtt1;
    detRtt2.textContent = hop.rtt2;
    detRtt3.textContent = hop.rtt3;
    detAvgLatency.textContent = hop.avgLatency;
  }

  // --------------------------------------------------------------------------
  // Summary Calculation
  // --------------------------------------------------------------------------
  function updateSummaryMetrics() {
    const total = hopsData.length;
    const success = hopsData.filter(h => h.status === 'Online').length;
    const failed = hopsData.filter(h => h.status === 'Timeout').length;

    sumTotalHops.textContent = total;
    sumSuccessHops.textContent = success;
    sumFailedHops.textContent = failed;

    const validVals = [];
    hopsData.forEach(h => {
      if (h.avgLatencyValue !== null) {
        validVals.push(h.avgLatencyValue);
      }
    });

    if (validVals.length > 0) {
      const avg = Math.round((validVals.reduce((a, b) => a + b, 0) / validVals.length) * 10) / 10;
      sumAvgLatency.textContent = avg < 1 ? '<1 ms' : `${avg} ms`;
    } else {
      sumAvgLatency.textContent = '—';
    }
  }

  // --------------------------------------------------------------------------
  // Finish / Stop Handlers
  // --------------------------------------------------------------------------
  function finishTraceroute(summary) {
    if (!isRunning) return;
    isRunning = false;

    clearInterval(timerInterval);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    startBtn.disabled = false;
    stopBtn.disabled = true;
    destInput.disabled = false;

    // Render Destination Node if hops were collected
    if (hopsData.length > 0) {
      renderDestinationNode();
    }

    if (summary) {
      if (summary.overallAvgLatency && summary.overallAvgLatency !== '—') {
        sumAvgLatency.textContent = summary.overallAvgLatency;
      }
      if (summary.durationSeconds) {
        metaDuration.textContent = summary.durationSeconds;
      }
    }

    const responded = hopsData.filter(h => h.status === 'Online').length;
    if (responded > 0) {
      showBanner('success', 'Traceroute Complete', `Discovered ${hopsData.length} hops (${responded} responded) in ${metaDuration.textContent}.`);
    } else if (hopsData.length > 0) {
      showBanner('error', 'Trace Finished', 'All probed hops timed out or were blocked by upstream firewalls.');
    } else {
      showBanner('error', 'Trace Failed', 'No hop responses received. Please verify network connectivity.');
    }

    appendRawOutput(`\nTrace complete.\n====================================================\n`);
  }

  async function stopTraceroute(reasonText) {
    if (!isRunning) return;

    if (currentSessionId) {
      try {
        await fetch('/api/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: currentSessionId })
        });
      } catch (_) {}
    }

    finishTraceroute();
    showBanner('error', 'Traceroute Stopped', reasonText || 'The process was terminated.');
    appendRawOutput(`\n[STOPPED] Traceroute halted by user.\n`);
  }

  // --------------------------------------------------------------------------
  // Helper UI Utilities
  // --------------------------------------------------------------------------
  function resetState() {
    hopsData = [];
    selectedHopIndex = null;
    resolvedTargetIp = '—';

    // Clear Visual Route
    const nodes = routeContainer.querySelectorAll('.route-node:not(#client-node), .route-connector');
    nodes.forEach(n => n.remove());
    if (routeEmptyMsg) routeEmptyMsg.style.display = 'none';

    // Clear Table
    hopTableBody.innerHTML = `
      <tr class="empty-table-row">
        <td colspan="5">Probing network hops...</td>
      </tr>
    `;

    // Clear Metrics
    metaHopCount.textContent = '0';
    tableCounter.textContent = '0 Hops';
    sumTotalHops.textContent = '0';
    sumSuccessHops.textContent = '0';
    sumFailedHops.textContent = '0';
    sumAvgLatency.textContent = '—';

    // Reset Inspector
    detHopNum.textContent = '—';
    detHostname.textContent = '—';
    detIp.textContent = '—';
    detStatus.textContent = '—';
    detStatus.className = 'detail-val';
    detRtt1.textContent = '—';
    detRtt2.textContent = '—';
    detRtt3.textContent = '—';
    detAvgLatency.textContent = '—';
  }

  function showBanner(type, title, detail) {
    statusBanner.className = 'status-banner';
    bannerSpinner.classList.add('hidden');
    bannerIcon.classList.add('hidden');

    if (type === 'running') {
      statusBanner.classList.add('banner-running');
      bannerSpinner.classList.remove('hidden');
    } else if (type === 'success') {
      statusBanner.classList.add('banner-success');
      bannerIcon.textContent = '✅';
      bannerIcon.classList.remove('hidden');
    } else if (type === 'error') {
      statusBanner.classList.add('banner-error');
      bannerIcon.textContent = '⚠️';
      bannerIcon.classList.remove('hidden');
    }

    bannerTitle.textContent = title;
    bannerDetail.textContent = detail || '';
    statusBanner.classList.remove('hidden');
  }

  function appendRawOutput(text) {
    rawTextLogs += text;
    rawOutputPre.innerHTML = `<code>${escapeHtml(rawTextLogs)}</code>`;
    rawTerminalBody.scrollTop = rawTerminalBody.scrollHeight;
  }

  function escapeHtml(str) {
    if (!str) return '—';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Terminal Toggle
  let isRawVisible = true;
  toggleRawBtn.addEventListener('click', () => {
    isRawVisible = !isRawVisible;
    rawTerminalBody.style.display = isRawVisible ? 'block' : 'none';
    toggleRawText.textContent = isRawVisible ? 'Hide Output' : 'Show Output';
    toggleRawBtn.setAttribute('aria-expanded', isRawVisible ? 'true' : 'false');
  });

  // Copy Raw Output
  copyRawBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(rawTextLogs || rawOutputPre.innerText);
      const span = copyRawBtn.querySelector('span');
      const orig = span.textContent;
      span.textContent = 'Copied!';
      setTimeout(() => { span.textContent = orig; }, 1800);
    } catch (_) {
      // Fallback
    }
  });

});
