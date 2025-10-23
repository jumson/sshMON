# sshMON - SSH Honeypot with Threat Intelligence

A production-ready SSH honeypot designed for threat intelligence collection and analysis. Captures attacker behavior, credentials, commands, and enriches data with geolocation and IP reputation information.

## Overview

sshMON is a defensive security tool that:
- **Mimics** a real SSH server to attract and monitor unauthorized access attempts
- **Captures** authentication attempts, commands, and attacker behavior
- **Enriches** data with threat intelligence (geolocation, IP reputation)
- **Logs** all activity in both machine-readable (JSON) and human-readable formats
- **Simulates** realistic shell interactions to elicit deeper attacker reconnaissance

## Key Features

- ✅ **Full SSH Protocol Support** - Handles password & keyboard-interactive auth
- 🌍 **Geolocation Tracking** - IP → Country/City/ASN/ISP mapping
- 🛡️ **IP Reputation** - Integration with AbuseIPDB, Shodan, and other threat feeds
- 🎭 **Realistic Shell Emulation** - Scripted responses to common attacker commands
- 📊 **Structured Logging** - JSON Lines format + human-readable CSV
- 🐳 **Docker Ready** - One-command deployment with docker-compose
- 📈 **Threat Intelligence** - Automatic enrichment of all captured data

## Quick Start

### Prerequisites
- Docker & Docker Compose (recommended)
- OR Node.js 18+ (for local development)

### Docker Deployment (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/sshMON.git
cd sshMON

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your API keys (optional but recommended)

# Start the honeypot
docker-compose up -d

# View logs
docker-compose logs -f

# Check captured data
tail -f logs/honeypot.jsonl
```

The honeypot will start listening on port 2222 by default (configurable).

### Local Development

```bash
# Install dependencies
npm install

# Generate SSH host key
npm run generate-key

# Configure environment
cp .env.example .env

# Start honeypot
npm start
```

## Architecture

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed system design.

```
Internet → SSH Honeypot → Threat Intel Layer → Logging & Storage
                ↓              ↓                    ↓
         Accept All Auth   Geolocation         JSON + CSV
         Fake Shell       IP Reputation        Malware Capture
         Command Log      Enrichment           Analytics
```

## Project Structure

```
sshMON/
├── fakeServer/
│   ├── fakeSSH.js              # Main honeypot server
│   ├── logToCSV.js             # CSV logging module
│   ├── csvToHtml.js            # CSV to HTML converter
│   ├── threatIntel.js          # Threat intelligence integration
│   ├── shellEmulator.js        # Fake shell command responses
│   ├── filesystem.js           # Fake filesystem structure
│   └── logger.js               # Enhanced structured logging
├── docs/
│   ├── ARCHITECTURE.md         # System architecture details
│   ├── SHELL_EMULATION_RESEARCH.md  # Attacker behavior research
│   ├── THREAT_INTEL_SETUP.md   # API setup instructions
│   └── DEPLOYMENT.md           # Production deployment guide
├── logs/                       # Log output directory (created at runtime)
├── keys/                       # SSH host keys (auto-generated)
├── docker-compose.yml
├── Dockerfile
├── package.json
├── .env.example
└── README.md
```

## Configuration

All configuration is done via environment variables in `.env`:

```bash
# Server Configuration
PORT=2222                       # Port to listen on (don't use 22 in Docker!)
HOSTNAME=@raspberrypi          # Fake hostname shown in prompt

# Logging
LOG_PATH=./logs                # Where to store logs
LOG_LEVEL=info                 # Logging verbosity

# Threat Intelligence APIs (all optional, but recommended)
ABUSEIPDB_API_KEY=             # Free tier: 1000 requests/day
SHODAN_API_KEY=                # Your Shodan API key
IPAPI_KEY=                     # Free tier: 1000 requests/day (optional)
MAXMIND_LICENSE_KEY=           # For GeoLite2 database (free)

# Rate Limiting
SHODAN_RATE_LIMIT=1            # Requests per second (basic tier = 1 req/sec)
ABUSEIPDB_RATE_LIMIT=1000      # Requests per day
```

## Documentation

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Technical architecture and design decisions
- **[SHELL_EMULATION_RESEARCH.md](./docs/SHELL_EMULATION_RESEARCH.md)** - Detailed research on attacker reconnaissance techniques and realistic response strategies
- **[THREAT_INTEL_SETUP.md](./docs/THREAT_INTEL_SETUP.md)** - How to obtain and configure threat intelligence API keys
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Production deployment best practices

## Log Formats

### JSON Lines (Machine-Readable)
Primary log format: `logs/honeypot.jsonl`

```json
{"timestamp":"2025-10-23T10:15:32.123Z","event":"auth_attempt","ip":"1.2.3.4","port":54321,"method":"password","username":"root","password":"admin123","geo":{"country":"CN","city":"Beijing","asn":"AS4134"},"reputation":{"abuseipdb_score":100,"is_tor":false}}
{"timestamp":"2025-10-23T10:15:35.456Z","event":"command","ip":"1.2.3.4","session":"abc123","command":"uname -a","response":"Linux raspberrypi 5.10.63-v7l+ #1459 SMP armv7l GNU/Linux"}
```

### CSV (Human-Readable)
Legacy format: `logs/credentials.csv`

```csv
Date,Time,IP,Port,Method,Username,Password,Country,City,Reputation Score
2025-10-23,10:15:32,1.2.3.4,54321,password,root,admin123,CN,Beijing,100
```

### Session Logs
Detailed session transcripts: `logs/sessions/[session-id].log`

```
[2025-10-23 10:15:35] Connected: 1.2.3.4:54321 (CN - Beijing - AS4134)
[2025-10-23 10:15:36] Auth: root / admin123
[2025-10-23 10:15:37] Command: uname -a
[2025-10-23 10:15:37] Response: Linux raspberrypi 5.10.63-v7l+...
[2025-10-23 10:15:40] Command: cat /etc/passwd
[2025-10-23 10:15:40] Response: [fake passwd file content]
```

## Threat Intelligence Sources (Free Tier)

### Configured by Default
- **geoip-lite** - Offline geolocation database (no API needed)
- **IP-API.com** - Free geolocation (45 req/min, no key needed)

### Optional (Requires API Keys)
- **AbuseIPDB** - IP reputation (1000 req/day free) - [Get Key](https://www.abuseipdb.com/register)
- **Shodan** - Internet scan data (1 req/sec basic tier) - [Your existing key]
- **MaxMind GeoLite2** - Enhanced geolocation (free) - [Get Key](https://www.maxmind.com/en/geolite2/signup)

See [THREAT_INTEL_SETUP.md](./docs/THREAT_INTEL_SETUP.md) for detailed setup.

## Shell Emulation

sshMON provides realistic command responses to common attacker reconnaissance:

- **Privilege Testing**: `whoami`, `id`, `sudo -l`
- **System Info**: `uname -a`, `cat /proc/cpuinfo`, `lsb_release -a`
- **Network Discovery**: `ifconfig`, `ip addr`, `netstat -tulpn`
- **VM Detection Evasion**: Realistic responses to avoid detection
- **File System**: `ls`, `cat`, `pwd`, `cd` with fake directories

See [SHELL_EMULATION_RESEARCH.md](./docs/SHELL_EMULATION_RESEARCH.md) for comprehensive research on attacker techniques.

## Security Considerations

**IMPORTANT**: This honeypot should be deployed in an isolated environment:

- ✅ Use Docker containers for isolation
- ✅ Deploy in DMZ or separate network segment
- ✅ Do NOT run on systems with sensitive data
- ✅ Monitor resource usage (prevent DoS)
- ✅ Regularly rotate logs and analyze data
- ⚠️ Never give attackers real shell access
- ⚠️ Do not use real credentials anywhere in the system

## Development Roadmap

### Phase 1: Foundation ✅
- [x] Basic SSH honeypot functionality
- [x] CSV logging
- [x] Docker deployment

### Phase 2: Threat Intelligence 🚧
- [x] Geolocation integration
- [x] IP reputation checking
- [x] Structured JSON logging
- [ ] SQLite database for queries

### Phase 3: Advanced Emulation 📋
- [x] Fake filesystem
- [x] Command response engine
- [ ] Malware download capture
- [ ] Advanced session recording

### Phase 4: Multi-Instance 📋
- [ ] Orchestration for 3+ instances
- [ ] Centralized log aggregation
- [ ] Cross-instance correlation

### Phase 5: Analytics 📋
- [ ] Real-time dashboard
- [ ] Grafana visualization
- [ ] ML-based anomaly detection
- [ ] SIEM integration

## Contributing

This is a security research project. Contributions welcome for:
- Additional command emulations
- New threat intelligence sources
- Analytics and visualization
- Documentation improvements

## License

MIT License - See LICENSE file

## Acknowledgments

- Built on [ssh2](https://github.com/mscdex/ssh2) by Brian White
- Inspired by the cybersecurity research community
- Threat intelligence from AbuseIPDB, Shodan, and MaxMind

## Support

For issues, questions, or feature requests:
- GitHub Issues: [Project Issues](https://github.com/yourusername/sshMON/issues)
- Documentation: [docs/](./docs/)

---

**⚠️ DISCLAIMER**: This tool is for defensive security research and authorized network monitoring only. Ensure you have proper authorization before deploying on any network. The authors are not responsible for misuse.
