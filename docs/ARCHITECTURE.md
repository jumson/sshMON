# sshMON Architecture

## System Overview

sshMON is a modular SSH honeypot built on Node.js, designed for production deployment with Docker containerization. The architecture prioritizes:

- **Isolation**: Containerized deployment prevents escape to host
- **Observability**: Multi-format logging (JSON, CSV, session transcripts)
- **Intelligence**: Automated threat data enrichment
- **Scalability**: Stateless design enables horizontal scaling
- **Maintainability**: Modular codebase with clear separation of concerns

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet / Attackers                      │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ TCP/22 (or custom port)
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                     Docker Container Boundary                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   SSH Honeypot Server                      │  │
│  │                    (fakeSSH.js)                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  SSH2 Library (Protocol Handler)                    │  │  │
│  │  │  - Accept all authentication attempts              │  │  │
│  │  │  - PTY allocation & shell emulation                │  │  │
│  │  │  - Session management                              │  │  │
│  │  └──────────┬──────────────────────────────────────────┘  │  │
│  │             │                                              │  │
│  │  ┌──────────▼──────────────────────────────────────────┐  │  │
│  │  │  Shell Emulator (shellEmulator.js)                  │  │  │
│  │  │  - Command parser & router                         │  │  │
│  │  │  - Response generator                              │  │  │
│  │  │  - Session state tracking                          │  │  │
│  │  └──────────┬──────────────────────────────────────────┘  │  │
│  │             │                                              │  │
│  │  ┌──────────▼──────────────────────────────────────────┐  │  │
│  │  │  Fake Filesystem (filesystem.js)                    │  │  │
│  │  │  - Virtual directory tree                          │  │  │
│  │  │  - Fake file contents                              │  │  │
│  │  │  - Dynamic content generation                      │  │  │
│  │  └──────────┬──────────────────────────────────────────┘  │  │
│  │             │                                              │  │
│  └─────────────┼──────────────────────────────────────────────┘  │
│                │                                                 │
│  ┌─────────────▼──────────────────────────────────────────────┐ │
│  │         Threat Intelligence Layer (threatIntel.js)         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │ │
│  │  │  GeoIP       │  │  AbuseIPDB   │  │  Shodan API     │  │ │
│  │  │  (geoip-lite)│  │  (IP Rep)    │  │  (Host Intel)   │  │ │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘  │ │
│  │         ↓                  ↓                  ↓             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  Enrichment Engine                                   │  │ │
│  │  │  - Rate limiting per API                            │  │ │
│  │  │  - Caching (reduce duplicate lookups)              │  │ │
│  │  │  - Fallback handling (graceful degradation)        │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └─────────────┬──────────────────────────────────────────────┘ │
│                │                                                 │
│  ┌─────────────▼──────────────────────────────────────────────┐ │
│  │             Logging Layer (logger.js)                      │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │ │
│  │  │  JSON Lines  │  │  CSV Logger  │  │  Session Logs   │  │ │
│  │  │  (structured)│  │  (legacy)    │  │  (transcripts)  │  │ │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │ │
│  │         │                  │                   │            │ │
│  └─────────┼──────────────────┼───────────────────┼────────────┘ │
│            │                  │                   │              │
│            ▼                  ▼                   ▼              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Docker Volume (Persistent Storage)          │   │
│  │  /logs/honeypot.jsonl                                   │   │
│  │  /logs/credentials.csv                                  │   │
│  │  /logs/sessions/[session-id].log                        │   │
│  │  /logs/malware/[captured-files]                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                 │
                 │ Volume Mount
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Host Filesystem                              │
│  /var/lib/sshmon/logs/                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. SSH Protocol Handler (`fakeSSH.js`)

**Responsibilities**:
- Listen for incoming SSH connections
- Handle SSH protocol negotiation (via ssh2 library)
- Accept all authentication attempts (regardless of credentials)
- Allocate pseudo-terminals (PTY)
- Route input to shell emulator
- Send output back to attacker

**Technology**:
- `ssh2` npm package (SSH2 protocol implementation)
- Event-driven architecture (Node.js streams)

**Key Functions**:
```javascript
// Pseudo-code
server.on('connection', (client) => {
  client.on('authentication', (ctx) => {
    logAuthAttempt(ctx.username, ctx.password);
    enrichWithThreatIntel(client.ip);
    ctx.accept(); // Always accept
  });

  client.on('session', (accept) => {
    session = accept();
    session.on('shell', (accept) => {
      stream = accept();
      shellEmulator.handleSession(stream, client.ip);
    });
  });
});
```

**Configuration**:
- Port: ENV `PORT` (default 2222)
- Host key: Auto-generated RSA 2048-bit on first run
- Binding: `0.0.0.0` (all interfaces)

---

### 2. Shell Emulator (`shellEmulator.js`)

**Responsibilities**:
- Parse attacker input (command line)
- Route commands to appropriate handlers
- Generate realistic responses
- Maintain session state (current directory, environment vars)
- Detect and log malware downloads (wget/curl)

**Architecture**:
```javascript
class ShellEmulator {
  constructor(filesystem, logger) {
    this.fs = filesystem;
    this.log = logger;
    this.commandHandlers = {
      'whoami': this.handleWhoami,
      'id': this.handleId,
      'uname': this.handleUname,
      'ls': this.handleLs,
      'cat': this.handleCat,
      'cd': this.handleCd,
      'pwd': this.handlePwd,
      'wget': this.handleWget,
      'curl': this.handleCurl,
      // ... 50+ commands
    };
  }

  executeCommand(input, sessionState) {
    const parsed = this.parseCommand(input);
    const handler = this.commandHandlers[parsed.command] || this.handleUnknown;
    return handler(parsed.args, sessionState);
  }
}
```

**Command Routing**:
1. **Exact match**: Pre-defined commands (whoami, ls, etc.)
2. **Pattern match**: Piped commands (cat file | grep pattern)
3. **Script detection**: Multi-line input, shell syntax
4. **Fallback**: "command not found" or generic error

**Session State**:
```javascript
{
  sessionId: 'uuid-v4',
  ip: '1.2.3.4',
  port: 54321,
  username: 'root',
  currentDir: '/root',
  env: { HOME: '/root', USER: 'root', SHELL: '/bin/bash' },
  startTime: timestamp,
  commandHistory: []
}
```

---

### 3. Fake Filesystem (`filesystem.js`)

**Responsibilities**:
- Provide virtual directory structure
- Generate realistic file contents on-demand
- Track attacker's current working directory
- Simulate file operations (read-only, no actual file creation)

**Structure**:
```javascript
const filesystem = {
  '/': {
    type: 'dir',
    entries: ['bin', 'etc', 'home', 'root', 'tmp', 'usr', 'var', 'proc', 'sys']
  },
  '/etc': {
    type: 'dir',
    entries: ['passwd', 'shadow', 'hosts', 'hostname', 'os-release', 'ssh']
  },
  '/etc/passwd': {
    type: 'file',
    content: () => generatePasswdFile(), // Dynamic generation
    permissions: '-rw-r--r--',
    owner: 'root:root',
    size: 1847
  },
  '/home/pi': {
    type: 'dir',
    entries: ['.bashrc', '.profile', 'Documents', 'Downloads']
  },
  // ... full UNIX directory tree
};
```

**Dynamic Content Generation**:
- `/proc/cpuinfo`: Generate based on configured CPU type
- `/etc/passwd`: Randomize UIDs while maintaining realism
- `/var/log/*`: Include fake log entries with realistic timestamps
- Directory listings: Randomize modification times

**Anti-Detection**:
- Consistent responses (same file always returns same content within session)
- Realistic file sizes
- Proper permissions (match real system expectations)

---

### 4. Threat Intelligence Layer (`threatIntel.js`)

**Responsibilities**:
- Enrich IP addresses with geolocation
- Check IP reputation against abuse databases
- Query Shodan for host intelligence
- Cache results to minimize API calls
- Handle rate limits gracefully

**API Integrations**:

#### GeoIP (geoip-lite - Offline)
```javascript
const geoip = require('geoip-lite');
const geo = geoip.lookup(ip);
// Returns: { country, region, city, ll: [lat, lon], range, ... }
```

**Pros**: No API calls, instant, no rate limits
**Cons**: Less accurate than commercial services

#### AbuseIPDB (Free Tier: 1000/day)
```javascript
async function checkAbuseIPDB(ip) {
  const response = await axios.get(`https://api.abuseipdb.com/api/v2/check`, {
    headers: { 'Key': process.env.ABUSEIPDB_API_KEY },
    params: { ipAddress: ip, maxAgeInDays: 90 }
  });
  return {
    abuseConfidenceScore: response.data.abuseConfidenceScore,
    totalReports: response.data.totalReports,
    isWhitelisted: response.data.isWhitelisted,
    isTor: response.data.isTor
  };
}
```

**Rate Limiting**:
- 1000 requests per day = ~1 per 90 seconds continuous
- Implement request queue with 90s interval
- Cache results for 24 hours

#### Shodan (Basic Tier: 1 req/sec)
```javascript
async function queryShodan(ip) {
  await rateLimiter.wait('shodan'); // Ensure 1 req/sec
  const response = await axios.get(`https://api.shodan.io/shodan/host/${ip}`, {
    params: { key: process.env.SHODAN_API_KEY }
  });
  return {
    openPorts: response.data.ports,
    vulns: response.data.vulns,
    tags: response.data.tags,
    org: response.data.org,
    asn: response.data.asn
  };
}
```

**Rate Limiting**:
- Basic tier: 1 query per second
- Monthly quota: Check limits, queue excess
- Cache indefinitely (host data changes slowly)

**Caching Strategy**:
```javascript
const cache = new Map(); // In-memory cache
const CACHE_TTL = {
  geoip: 7 * 24 * 60 * 60 * 1000,      // 7 days
  abuseipdb: 24 * 60 * 60 * 1000,       // 24 hours
  shodan: 30 * 24 * 60 * 60 * 1000      // 30 days
};

async function enrichIP(ip) {
  const cacheKey = `ip:${ip}`;
  if (cache.has(cacheKey) && !isExpired(cache.get(cacheKey))) {
    return cache.get(cacheKey).data;
  }

  const enriched = {
    geo: geoip.lookup(ip),
    reputation: await checkAbuseIPDB(ip),
    shodan: await queryShodan(ip)
  };

  cache.set(cacheKey, { data: enriched, timestamp: Date.now() });
  return enriched;
}
```

**Fallback Handling**:
- If API fails: Log error, continue without enrichment
- If quota exceeded: Use cached data or omit field
- Never block honeypot operation due to enrichment failure

---

### 5. Logging Layer (`logger.js`)

**Multi-Format Output**:

#### JSON Lines (Primary - Machine Readable)
```json
{"timestamp":"2025-10-23T10:15:32.456Z","event":"connection","ip":"1.2.3.4","port":54321,"geo":{"country":"CN","city":"Beijing"},"session":"abc-123"}
{"timestamp":"2025-10-23T10:15:33.123Z","event":"auth","session":"abc-123","ip":"1.2.3.4","method":"password","username":"root","password":"admin123","accepted":true}
{"timestamp":"2025-10-23T10:15:35.789Z","event":"command","session":"abc-123","ip":"1.2.3.4","input":"uname -a","output":"Linux raspberrypi 5.10.63-v7l+..."}
{"timestamp":"2025-10-23T10:16:12.234Z","event":"disconnect","session":"abc-123","ip":"1.2.3.4","duration":40,"commandCount":15}
```

**Format**: [JSON Lines](https://jsonlines.org/) - one JSON object per line
**Benefits**:
- Stream processing (tail -f, grep)
- Easy parsing (jq, Python json module)
- Append-only (no file locks)
- Human-scrollable with formatting tools

#### CSV (Legacy - Human Readable)
```csv
Date,Time,IP,Port,Method,Username,Password,Country,City,AbuseScore,Event
2025-10-23,10:15:32,1.2.3.4,54321,password,root,admin123,CN,Beijing,100,auth
2025-10-23,10:15:35,1.2.3.4,54321,command,root,,CN,Beijing,100,uname -a
```

**Benefits**:
- Excel/LibreOffice compatible
- Quick visual inspection
- Simple aggregation (sort, unique)

#### Session Transcripts (Detailed)
```
=== Session abc-123 ===
Start: 2025-10-23 10:15:32 UTC
IP: 1.2.3.4:54321
Geo: Beijing, CN (AS4134 - ChinaNet)
AbuseIPDB Score: 100/100
---

[10:15:33] AUTH: root / admin123 [ACCEPTED]
[10:15:35] CMD: uname -a
           OUT: Linux raspberrypi 5.10.63-v7l+ #1459 SMP Wed Oct 6 16:41:57 BST 2021 armv7l GNU/Linux
[10:15:37] CMD: whoami
           OUT: root
[10:15:40] CMD: cat /etc/passwd
           OUT: [passwd file contents]
[10:16:12] DISCONNECT (duration: 40s, commands: 15)
```

**Benefits**:
- Complete session replay
- Forensic analysis
- Training/demonstration material

**Log Rotation**:
```javascript
// Daily rotation
const winston = require('winston');
require('winston-daily-rotate-file');

const transport = new winston.transports.DailyRotateFile({
  filename: 'honeypot-%DATE%.jsonl',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d' // Keep 30 days
});
```

---

## Data Flow

### Typical Attack Session Flow

```
1. TCP Connection
   ↓
2. SSH Protocol Negotiation (ssh2 library handles)
   ↓
3. Authentication Attempt
   ├─ Log: timestamp, IP, method, username, password
   ├─ Enrich: GeoIP lookup (immediate)
   ├─ Queue: AbuseIPDB check (async)
   └─ Accept: ctx.accept()
   ↓
4. PTY Request
   ├─ Log: terminal type, dimensions
   └─ Accept & allocate
   ↓
5. Shell Interaction Loop:
   ├─ Receive: attacker input
   ├─ Parse: extract command + args
   ├─ Route: find handler (shellEmulator)
   ├─ Execute: generate response (filesystem)
   ├─ Log: command + response (all formats)
   └─ Send: response to attacker
   ↓
6. Disconnect
   ├─ Log: session duration, command count
   ├─ Finalize: session transcript
   └─ Cleanup: remove session state
```

---

## Deployment Architecture

### Single Instance (Development/Testing)

```
┌─────────────────────────────────────┐
│  Docker Host                        │
│  ┌───────────────────────────────┐  │
│  │  sshmon-honeypot container    │  │
│  │  Port: 2222 → 22 (internal)   │  │
│  │  Volumes: ./logs → /logs      │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Command**: `docker-compose up`

### Three-Instance Testing (Phase 4)

```
┌─────────────────────────────────────────────────────────────┐
│  Docker Host                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Instance 1  │  │  Instance 2  │  │  Instance 3  │      │
│  │  Port: 2222  │  │  Port: 2223  │  │  Port: 2224  │      │
│  │  Profile: Pi │  │  Profile:Web │  │  Profile:IoT │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┴─────────────────┘               │
│                           │                                 │
│                  ┌────────▼────────┐                        │
│                  │  Log Aggregator │                        │
│                  │  (Fluentd/rsyslog) │                     │
│                  └────────┬────────┘                        │
│                           │                                 │
│                  ┌────────▼────────┐                        │
│                  │  Central Storage│                        │
│                  └─────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Distributed Network (Future - Phase 7)

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Region 1    │    │  Region 2    │    │  Region 3    │
│  (US-East)   │    │  (EU-West)   │    │  (Asia-Pac)  │
│  3 instances │    │  3 instances │    │  3 instances │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┴───────────────────┘
                           │
                  ┌────────▼────────┐
                  │  Central SIEM   │
                  │  (ELK/Splunk)   │
                  └─────────────────┘
```

---

## Security Considerations

### Container Isolation

**Dockerfile Best Practices**:
```dockerfile
# Use minimal base image
FROM node:20-alpine

# Run as non-root user
RUN addgroup -g 1001 honeypot && \
    adduser -D -u 1001 -G honeypot honeypot

# Drop capabilities
# (Managed via docker-compose security settings)

# Read-only root filesystem
# (Except /logs volume)

USER honeypot
```

**docker-compose.yml Security**:
```yaml
services:
  honeypot:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE  # Only if binding port < 1024
    read_only: true
    tmpfs:
      - /tmp
    volumes:
      - ./logs:/logs:rw  # Only writable mount
```

### Network Isolation

- Deploy in DMZ or dedicated VLAN
- Firewall rules: Allow inbound SSH, deny all outbound (optional: allow threat intel APIs)
- No access to internal networks
- No sensitive data on same host

### Rate Limiting (DoS Prevention)

```javascript
const rateLimit = require('express-rate-limit');

// Limit connections per IP
const limiter = {
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 connections per minute per IP
  handler: (socket) => {
    logger.warn(`Rate limit exceeded: ${socket.remoteAddress}`);
    socket.destroy();
  }
};
```

### Log Security

- Logs may contain attacker scripts (potential malware)
- Sanitize before analysis (use sandboxed environments)
- Encrypt logs at rest if containing PII (IP addresses)
- Implement log rotation to prevent disk exhaustion

---

## Performance Considerations

### Resource Requirements

**Single Instance**:
- CPU: 0.5 cores (burst to 1 core during attacks)
- RAM: 256 MB (512 MB recommended)
- Disk: 100 MB container + 1 GB/week logs (varies by traffic)
- Network: ~10 Kbps per concurrent session

**Expected Load**:
- Typical: 10-50 attacks/day (low-profile deployment)
- High: 500+ attacks/day (popular port, cloud IPs)
- Concurrent sessions: 5-20 (adjust container limits accordingly)

### Scalability Limits

**Node.js Single Thread**:
- Can handle ~100 concurrent SSH sessions
- CPU-bound at ~50 sessions with heavy logging
- Recommend horizontal scaling beyond 50 concurrent

**Optimization Strategies**:
1. **Async I/O**: All logging operations non-blocking
2. **Lazy Loading**: Load filesystem entries on-demand
3. **Caching**: Reuse threat intel lookups
4. **Connection Pooling**: Reuse HTTP clients for APIs

---

## Monitoring & Observability

### Health Checks

**Docker Health Check**:
```yaml
healthcheck:
  test: ["CMD", "node", "healthcheck.js"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

**healthcheck.js**:
```javascript
// Attempt local SSH connection
const net = require('net');
const client = net.connect({ port: 22 }, () => {
  process.exit(0); // Success
});
client.on('error', () => process.exit(1));
client.setTimeout(5000, () => process.exit(1));
```

### Metrics to Track

- **Connections**: Total, successful auth, rejected (rate limited)
- **Commands**: Top 10 most common, unique commands per day
- **Credentials**: Unique username/password pairs
- **Geography**: Country distribution
- **Malware**: Download attempts, unique URLs
- **Threat Intel**: API usage, cache hit rate

---

## Future Enhancements

### Phase 5: Analytics Dashboard

```
Grafana Dashboard:
┌────────────────────────────────────────┐
│  Live Attacks Map (Geolocation)       │
├────────────────────────────────────────┤
│  Top Credentials  │  Top Commands     │
├────────────────────────────────────────┤
│  Attack Timeline  │  Country Stats    │
└────────────────────────────────────────┘
```

**Data Source**: Elasticsearch (ingest JSON logs)

### Phase 6: Machine Learning

- **Anomaly Detection**: Flag unusual command sequences
- **Botnet Clustering**: Group related attacks by behavior
- **Automated Tagging**: Classify attack types (cryptominer, backdoor, recon)

### Phase 7: Threat Feed Publishing

- Share anonymized attack data with community
- STIX/TAXII format for SIEM integration
- Public dashboard (e.g., honeypot.yourdomain.com/stats)

---

## References

- **ssh2 Library**: https://github.com/mscdex/ssh2
- **Docker Security**: https://docs.docker.com/engine/security/
- **OWASP Honeypot Project**: https://owasp.org/www-community/Honeypots
- **SANS Honeypot Whitepaper**: https://www.sans.org/reading-room/whitepapers/detection/

---

**Document Version**: 1.0
**Last Updated**: 2025-10-23
**Maintained By**: sshMON Development Team
