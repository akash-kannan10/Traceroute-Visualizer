# Traceroute Visualizer

A student-level, real-time **Computer Networks Mini Project** designed to demonstrate and visualize the hop-by-hop path Internet Protocol (IP) packets take across an internetwork to reach a remote destination using real Windows `tracert` network data.

---

## 1. Introduction

In modern internet communication, data is split into small units called packets that travel through multiple intermediate routing devices before reaching their final destination. **Traceroute Visualizer** is a web-based educational and diagnostic tool built with Node.js, Express, and Vanilla JavaScript that executes real system network commands (`tracert` on Windows), parses packet telemetry in real time, and renders an interactive, visual topology map of the routing path.

---

## 2. Problem Statement

Standard command-line diagnostic tools like Windows `tracert` output text-heavy, monolithic logs that can be intimidating and difficult for students and network administrators to interpret. There is a lack of accessible, lightweight, and zero-dependency educational tools that translate raw ICMP time-exceeded probe responses into an intuitive, interactive visual interface while preserving real underlying network data.

---

## 3. Objective

1. Provide an intuitive, real-time graphical visualization of IP packet paths from client to destination.
2. Execute **real** operating system network commands (`tracert`) safely using non-shell child process execution to prevent command injection.
3. Stream hop-by-hop telemetry (IP addresses, hostnames, and round-trip latencies) using **Server-Sent Events (SSE)**.
4. Calculate authentic metrics (Total Hops, Responded Hops, Timed Out Hops, Average Latency).
5. Serve as a comprehensive educational demonstration for **Computer Networks (CN 302)** academic coursework and viva examinations.

---

## 4. Features

- **Live Real-Time Streaming**: Discovered router hops appear dynamically on the screen as `tracert` discovers them.
- **Dynamic Logical Route Graph**: Interactive node-based topology visualization clearly distinguishing Client, Intermediate Routers, Timeouts, and the Final Destination.
- **Hop Inspector & Telemetry**: Click any visual node or table row to view individual probe Round Trip Times (RTT 1, 2, 3), resolved hostnames, and IP addresses.
- **Structured Hop Routing Table**: Clean, responsive tabular display with color-coded status badges (`Online` vs `Timeout`).
- **Real Metrics Calculation**: Computes actual aggregate latency and hop response ratios directly from live probe measurements without fabricated numbers.
- **Interactive Control Center**: Quick destination presets (`8.8.8.8`, `1.1.1.1`, `google.com`, `127.0.0.1`), validation guardrails, and a safe **Stop** button that terminates running system processes.
- **Integrated Terminal Console**: Collapsible raw terminal window displaying the authentic Windows `tracert` command output with one-click clipboard copy.
- **Educational Knowledge Base**: Step-by-step ICMP/TTL packet forwarding visual walkthrough and conceptual explanations tailored for Computer Networks students.

---

## 5. Technologies Used

- **Frontend**:
  - **HTML5**: Semantic document structure and accessibility attributes.
  - **CSS3**: Custom dark-mode design system, glassmorphism cards, CSS grid/flexbox, keyframe pulse animations.
  - **Vanilla JavaScript (ES6+)**: Event handling, DOM manipulation, and native `EventSource` (Server-Sent Events) API.
- **Backend**:
  - **Node.js**: Cross-platform runtime environment.
  - **Express.js**: Lightweight HTTP server providing static asset delivery and SSE streaming endpoints.
  - **Node.js `child_process.spawn`**: Secure, parameterized execution of the Windows `tracert` binary.
- **Operating System Utility**:
  - Windows `tracert` (ICMP Echo Request probing utility).

---

## 6. Computer Networks Concepts

### IP Addressing
Every device connected to an IP network possesses a unique numerical identifier (e.g., IPv4 `142.250.193.206` or IPv6 `2001:4860:4860::8888`) used by Layer 3 protocols for source and destination addressing.

### Routing & Routers
A **Router** is a Layer 3 (Network Layer) device that connects different subnets. It examines incoming packet header destination IP addresses, looks up its internal **Routing Table**, and forwards the packet through the optimal next-hop interface.

### Hops
A **Hop** represents an intermediate point of transit (a router or gateway) through which a packet must pass on its journey from source to destination.

### ICMP (Internet Control Message Protocol)
ICMP is a core protocol of the Internet Protocol Suite used by network devices to send error messages and operational information (such as destination unreachable, echo requests, and time exceeded notifications).

### TTL (Time-To-Live)
TTL is an 8-bit field in the IPv4 packet header (called *Hop Limit* in IPv6). It prevents packets from circulating indefinitely in routing loops:
- Every router that handles the packet decrements the TTL value by 1.
- If a router decrements the TTL to 0, it drops the packet and transmits an **ICMP Type 11 (Time Exceeded)** message back to the sender.

### Latency & Round-Trip Time (RTT)
Latency is the time interval (measured in milliseconds, `ms`) required for a packet probe to travel from the source host to an intermediate router and for the acknowledgment response to return.

---

## 7. System Architecture

```text
┌────────────────────────────────────────────────────────┐
│                   BROWSER (CLIENT)                     │
│  - User enters domain/IP (e.g., google.com)            │
│  - Establishes EventSource (SSE) connection            │
│  - Dynamically renders interactive visual route graph   │
└─────────────────────────▲──────────────────────────────┘
                          │ SSE (Event Stream) / HTTP
┌─────────────────────────▼──────────────────────────────┐
│                 EXPRESS.JS SERVER                      │
│  - Validates input format (RFC 1123 / IP validation)   │
│  - Spawns Windows tracert child process safely         │
│  - Parses raw stdout stream into structured JSON hops  │
└─────────────────────────▲──────────────────────────────┘
                          │ child_process.spawn()
┌─────────────────────────▼──────────────────────────────┐
│               WINDOWS OS (tracert.exe)                 │
│  - Generates ICMP Echo Request packets (TTL: 1,2,3...) │
└─────────────────────────▲──────────────────────────────┘
                          │ ICMP Packets
┌─────────────────────────▼──────────────────────────────┐
│            INTERNET ROUTERS & DESTINATION              │
│  - Decrements TTL, returns ICMP Type 11 / Type 0       │
└────────────────────────────────────────────────────────┘
```

---

## 8. Project Structure

```text
traceroute-visualizer/
│
├── server.js               # Express server, input sanitizer, process spawner, SSE streamer
├── package.json            # Project metadata and Express dependency
├── .gitignore              # Ignores node_modules and local system files
├── README.md               # Complete academic documentation and viva preparation
│
└── public/                 # Static frontend assets
    ├── index.html          # Semantic HTML layout and UI components
    ├── style.css           # Modern dark theme styles, node visuals, and responsive layouts
    └── script.js           # Client-side SSE stream listener, DOM renderer, and metrics logic
```

---

## 9. Installation

### Prerequisites
- **Node.js** (v14.0.0 or higher recommended)
- **Windows OS** (for `tracert` utility)

### Setup Steps
1. Open your terminal (PowerShell or Command Prompt) in the project directory:
   ```bash
   cd "d:\College\#SEM 5\CN 302\CN Mini Project"
   ```
2. Install the required dependencies:
   ```bash
   npm install
   ```

---

## 10. Running the Project

1. Start the application:
   ```bash
   npm start
   ```
2. Open your web browser and navigate to:
   ```
   http://localhost:3000
   ```
3. Enter any domain name (e.g., `google.com`) or IP address (e.g., `8.8.8.8`), then click **Start Traceroute**.

---

## 11. How the Project Works (Step-by-Step)

1. **User Input Validation**: The client and server validate the input string against regular expressions to ensure it is a valid domain or IP address, rejecting shell characters.
2. **Process Spawn**: The server calls `spawn('tracert', ['-h', '30', '-w', '1500', destination])` without invoking a shell, ensuring safe execution.
3. **Packet Transmission with Increasing TTL**:
   - `tracert` sends 3 ICMP Echo Request packets with `TTL = 1`.
   - Router 1 receives the packet, decrements TTL to 0, drops the packet, and sends back `ICMP Type 11 (Time Exceeded)`.
   - `tracert` records the router's IP, hostname, and the 3 probe latencies.
   - `tracert` increments TTL to 2, 3, 4, etc., probing each consecutive gateway.
4. **Real-time Parsing**: As Windows outputs each line to `stdout`, `server.js` parses the hop index, individual probe times, hostname, and IP address.
5. **SSE Streaming**: The server emits an `event: hop` JSON payload to the browser via an active Server-Sent Events HTTP connection.
6. **Dynamic DOM Rendering**: The frontend script intercepts the event, constructs a new node card with connecting arrows in the Visual Route, adds a row to the Hop Table, and updates live aggregate statistics.
7. **Destination Completion**: Once the destination host replies with `ICMP Type 0 (Echo Reply)`, `tracert` completes, and the final destination node is highlighted.

---

## 12. Example Traceroute Output

### Raw Command Line Output:
```text
Tracing route to dns.google [8.8.8.8]
over a maximum of 30 hops:

  1     1 ms     1 ms    <1 ms  router.asus.com [192.168.1.1]
  2    12 ms    11 ms    11 ms  10.240.0.1
  3    14 ms    13 ms    14 ms  core1.isp.net [182.79.14.2]
  4     *        *        *     Request timed out.
  5    18 ms    17 ms    17 ms  72.14.215.85
  6    18 ms    18 ms    18 ms  dns.google [8.8.8.8]

Trace complete.
```

### Structured Visualizer Representation:
- **Total Hops**: 6
- **Successful Hops**: 5
- **Failed Hops**: 1 (Hop 4 timed out)
- **Average Latency**: ~13.8 ms
- **Path**: `Client` ➔ `192.168.1.1` ➔ `10.240.0.1` ➔ `182.79.14.2` ➔ `[Timeout]` ➔ `72.14.215.85` ➔ `dns.google [8.8.8.8]`

---

## 13. Limitations

1. **Firewall Filtering**: Some intermediate ISP core routers have ICMP responses disabled or rate-limited by administrators for security reasons, resulting in `Request timed out (*)` even though the router successfully forwards user traffic.
2. **Asymmetric Routing**: Packets sent to a destination and the return acknowledgment packets may take different physical paths across the Internet. Traceroute measures the cumulative round-trip path.
3. **Dynamic Path Changes**: Due to BGP (Border Gateway Protocol) routing changes, load balancers, or link failures, subsequent traceroute executions may follow different routes.
4. **Local Network Dependencies**: The first 1–2 hops are determined by your local network configuration (e.g., home Wi-Fi gateway, university proxy, or cellular hotspot).

---

## 14. Future Enhancements

- **Historical Route Comparison**: Store trace sessions in memory or local storage to visualize latency fluctuations over time.
- **Latency Distribution Charts**: Visual graphs showing round-trip latency variance across consecutive hops.
- **TCP/UDP Traceroute Modes**: Support SYN/UDP probes for diagnosing ports blocked by firewalls.
- **Export Reports**: Generate downloadable PDF or JSON telemetry summaries for network audit logs.

---

## 15. Computer Networks Concepts Demonstrated

- **Client-Server Architecture**: Web browser client communicating asynchronously with an Express backend.
- **Network Layer Protocol (Layer 3)**: IP packet addressing, TTL decrementing, and packet forwarding.
- **ICMP Diagnostics**: Utilization of ICMP Echo Request (Type 8), ICMP Time Exceeded (Type 11), and ICMP Echo Reply (Type 0).
- **Round-Trip Delay (RTT)**: Propagation, transmission, and queuing delay analysis.
- **Network Gateways**: Identification of default local gateways, ISP transit nodes, and autonomous systems (AS).
- **Asynchronous Data Streaming**: Event-driven client-server streaming using Server-Sent Events (SSE).

---

## 16. Viva Questions & Answers

### Q1: What is Traceroute?
**Answer:** Traceroute is a network diagnostic utility used to track and display the sequence of intermediate routers (hops) that an IP packet traverses from a source computer to a destination host, along with the round-trip latency for each hop.

### Q2: What is the difference between `tracert` and `traceroute`?
**Answer:** `tracert` is the Windows implementation that primarily uses **ICMP Echo Request** packets by default. `traceroute` is the Unix/Linux/macOS implementation that by default uses **UDP packets** targeted at high-numbered ports (or ICMP when specified with flags).

### Q3: What is a Hop in computer networks?
**Answer:** A hop represents one intermediate network device (typically a Layer 3 router or gateway) that forwards an IP packet along the transmission path between source and destination.

### Q4: What is TTL (Time-To-Live) and what is its purpose?
**Answer:** TTL is an 8-bit field in the IPv4 packet header designed to prevent packets from circulating indefinitely in routing loops. Every router decrements the TTL by 1. When TTL reaches 0, the router discards the packet and returns an ICMP Time Exceeded message.

### Q5: How does Traceroute discover intermediate routers using TTL?
**Answer:** Traceroute sends a series of probe packets starting with `TTL = 1`. The first router decrements TTL to 0, drops the packet, and replies with an ICMP Time Exceeded packet revealing its IP. Traceroute then repeats the process with `TTL = 2`, `TTL = 3`, and so forth until the destination host is reached.

### Q6: What is ICMP and which ICMP message types are used during a trace?
**Answer:** Internet Control Message Protocol (ICMP) is used for network diagnostics and error reporting. Windows `tracert` utilizes:
1. **ICMP Type 8 (Echo Request)**: Sent by the client to probe hops.
2. **ICMP Type 11 (Time Exceeded)**: Returned by intermediate routers when TTL expires.
3. **ICMP Type 0 (Echo Reply)**: Returned by the final target destination when reached.

### Q7: What is Latency (Round-Trip Time)?
**Answer:** Latency (RTT) is the total elapsed time in milliseconds for a data packet to travel from the source host to a remote network device and for the acknowledgment response to return back to the source.

### Q8: Why does a hop display "Request timed out" (`*`)?
**Answer:** A hop times out when no ICMP response is received within the wait threshold. This commonly happens because:
1. The router is configured to discard or block ICMP packets via a firewall rule.
2. The router prioritizes forwarding user traffic and drops ICMP generation (ICMP rate limiting).
3. Network congestion or packet loss occurred on that specific link.

### Q9: What is the difference between TCP and UDP?
**Answer:** 
- **TCP (Transmission Control Protocol)** is a connection-oriented, reliable protocol that guarantees packet ordering, error checking, and flow control using a 3-way handshake (`SYN`, `SYN-ACK`, `ACK`).
- **UDP (User Datagram Protocol)** is a connectionless, lightweight protocol that provides fast transmission without delivery guarantees, acknowledgments, or retransmissions.

### Q10: What is DNS and how is it used in this project?
**Answer:** Domain Name System (DNS) is the distributed naming system that translates human-readable hostnames (e.g., `google.com`) into machine-routable IP addresses (e.g., `142.250.193.206`). In this project, `tracert` uses DNS reverse-lookup to resolve IP addresses into hostnames.

### Q11: What is Client-Server Architecture?
**Answer:** It is a distributed application structure that partitions tasks between resource/service providers (servers) and service requesters (clients). In this project, the web browser is the client, and the Express.js application is the server coordinating system network operations.

### Q12: What happens step-by-step when a user types `google.com` into a browser?
**Answer:**
1. **DNS Lookup**: The browser queries local DNS caches and DNS servers to resolve `google.com` to an IP address.
2. **TCP 3-Way Handshake**: The browser establishes a TCP connection on port 443 with Google's server (`SYN` ➔ `SYN-ACK` ➔ `ACK`).
3. **TLS Handshake**: Secure cryptographic keys and certificates are negotiated for HTTPS.
4. **HTTP Request**: The browser sends an `HTTP GET` request for `/`.
5. **Server Processing & Response**: Google's web server generates and returns the HTTP 200 response with HTML/CSS/JS.
6. **Rendering**: The browser parses HTML, constructs the DOM/CSSOM trees, and renders the webpage.

### Q13: Why does the route contain multiple routers instead of a direct connection?
**Answer:** The Internet is a mesh network of interconnected Autonomous Systems (AS) managed by universities, enterprises, and Internet Service Providers (ISPs). Routers forward traffic across localized subnets, regional backbones, and international undersea fiber cables using routing algorithms (like BGP and OSPF).

### Q14: Why can traceroute results change between successive runs?
**Answer:** Internet routing is dynamic. Routing protocols constantly adapt to link congestion, hardware failures, BGP route updates, and load balancing across multi-homed ISP connections, causing subsequent packets to traverse alternate paths.

### Q15: How does this application prevent command injection security vulnerabilities?
**Answer:** Instead of executing an unsafe shell string like `exec('tracert ' + input)`, the application strictly validates input against RFC-compliant domain and IP regular expressions and utilizes `child_process.spawn('tracert', [args])` with `shell: false`, passing the destination directly as a separate process argument.
#   T r a c e r o u t e - V i s u a l i z e r  
 