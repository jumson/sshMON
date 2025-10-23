# sshMON Project Status & Implementation Plan

**Date**: 2025-10-23
**Current Branch**: `claude/project-assessment-011CUPvqo8wmC1reMvwLNtjR`
**Project Phase**: Full Implementation (Option A)

---

## Executive Summary

sshMON is being transformed from a basic SSH honeypot (last updated 2017) into a production-ready threat intelligence platform. The implementation follows a 4-phase approach with comprehensive documentation.

**Target Deployment**: Production honeypot for threat intelligence collection with Docker containerization.

---

## Implementation Status

### ✅ COMPLETED

#### Phase 0: Documentation & Planning
- [x] **README.md** - Comprehensive project overview with quick start guide
- [x] **docs/ARCHITECTURE.md** - Technical architecture and system design
- [x] **docs/SHELL_EMULATION_RESEARCH.md** - Detailed attacker reconnaissance research (CRITICAL)
  - Common recon commands and expected responses
  - VM/sandbox detection evasion strategies
  - Malware deployment patterns
  - Response strategy matrix
- [x] **docs/THREAT_INTEL_SETUP.md** - API setup guide for free tier services
- [x] **docs/DEPLOYMENT.md** - Production deployment best practices
- [x] **package.json** - Node.js dependencies and scripts
- [x] **.env.example** - Complete configuration template

#### Phase 1: Core Modules (In Progress)
- [x] **fakeServer/logger.js** - Enhanced multi-format logging (JSON Lines + CSV + Session transcripts)
- [x] **fakeServer/logToCSV.js** - Legacy CSV logging (backwards compatibility)
- [x] **fakeServer/csvToHtml.js** - CSV to HTML converter with search
- [x] **fakeServer/threatIntel.js** - Threat intelligence integration
  - GeoIP (geoip-lite offline)
  - IP-API.com (free geolocation fallback)
  - AbuseIPDB integration (1000 req/day free)
  - Shodan integration (1 req/sec basic tier)
  - Caching with TTL
  - Rate limiting
- [x] **fakeServer/filesystem.js** - Fake filesystem with multiple profiles
  - Raspberry Pi profile
  - Ubuntu Server profile
  - Generic IoT profile
  - Dynamic content generation

### 🚧 IN PROGRESS

#### Phase 1: Core Modules (Remaining)
- [ ] **fakeServer/shellEmulator.js** - Command parser and response engine
  - 50+ command handlers
  - Session state management
  - wget/curl malware capture
  - Piped command support
- [ ] **fakeServer/fakeSSH.js** - Modernized main server
  - Integrate all new modules
  - Session management
  - Error handling
  - Graceful shutdown

#### Phase 2: Docker & Infrastructure
- [ ] **Dockerfile** - Multi-stage build for minimal image
- [ ] **docker-compose.yml** - Single and multi-instance configs
- [ ] **.dockerignore**
- [ ] **scripts/generate-ssh-key.js** - SSH host key generation
- [ ] **scripts/health-check.js** - Docker health check script

### 📋 PENDING

#### Phase 3: Advanced Features
- [ ] Malware capture directory setup
- [ ] Log rotation configuration
- [ ] Analytics scripts
- [ ] Multi-instance orchestration

#### Phase 4: Testing & Deployment
- [ ] Unit tests
- [ ] Integration tests
- [ ] Docker build testing
- [ ] Production deployment checklist

---

## Documentation Highlights

### SHELL_EMULATION_RESEARCH.md

This document is **critical** for the project's success. It contains:

1. **Reconnaissance Phases** - Typical attacker workflow mapped out
2. **Command Response Matrix** - 30+ commands with exact responses needed
3. **VM Detection Evasion** - How to pass all virtualization checks
   - `systemd-detect-virt` → must return "none"
   - `dmidecode` → show real hardware or "command not found"
   - `/sys/class/dmi/` → "No such file or directory" (ARM systems don't have DMI)
   - `lspci` → empty output (no PCI bus on ARM)
4. **Network Reconnaissance** - Realistic network configs
   - IP addresses in 192.168.1.0/24 range
   - Real Raspberry Pi MAC OUI (b8:27:eb)
   - Standard services only (SSH, CUPS on localhost)
5. **Malware Deployment** - How to log wget/curl downloads
6. **Implementation Priorities** - Phased command implementation

**This document should be referenced constantly during shellEmulator.js development.**

---

## Key Technical Decisions

### Logging Strategy
- **Primary**: JSON Lines (machine-readable, greppable)
- **Legacy**: CSV (Excel-compatible, human-scannable)
- **Forensics**: Session transcripts (full replay capability)

### Threat Intelligence Stack (Free Tier)
| Service | Purpose | Rate Limit | Status |
|---------|---------|------------|--------|
| geoip-lite | Offline geolocation | Unlimited | ✅ Implemented |
| IP-API | Online geolocation fallback | 45/min | ✅ Implemented |
| AbuseIPDB | IP reputation | 1000/day | ✅ Implemented |
| Shodan | Host intelligence | 1 req/sec | ✅ Implemented |

### Shell Emulation Philosophy
- **Entirely scripted** - No real command execution
- **Feed expectations** - Give attackers what they expect to see
- **Elicit behavior** - Responses designed to reveal attacker objectives
- **Avoid detection** - Pass all VM/sandbox detection tests

---

## Next Steps (Priority Order)

### Immediate (Today)
1. **Create shellEmulator.js**
   - Reference SHELL_EMULATION_RESEARCH.md extensively
   - Implement core commands: whoami, id, uname, ls, cat, cd, pwd
   - Implement VM detection responses (critical!)
   - Add wget/curl malware capture

2. **Modernize fakeSSH.js**
   - Integrate logger module
   - Integrate threatIntel module
   - Integrate shellEmulator module
   - Add session management

3. **Create Docker files**
   - Dockerfile with security best practices
   - docker-compose.yml for easy deployment
   - Generate SSH key script

### Short Term (This Week)
4. **Testing**
   - Test honeypot locally
   - Verify all commands work
   - Test threat intel APIs
   - Validate Docker build

5. **Documentation Finalization**
   - Create CHANGELOG.md
   - Create CONTRIBUTING.md
   - Update README with actual tested examples

### Medium Term (Next 2 Weeks)
6. **Multi-Instance Setup**
   - Test 3-instance deployment
   - Verify different profiles
   - Log aggregation testing

7. **Production Deployment**
   - Deploy to cloud provider
   - Configure firewall rules
   - Set up monitoring
   - Test with real attackers

---

## GitHub Project Management

### Recommended Structure

Create GitHub Issues for:
- [ ] Issue #1: Implement shellEmulator.js with VM detection
- [ ] Issue #2: Modernize fakeSSH.js with new modules
- [ ] Issue #3: Create Docker deployment files
- [ ] Issue #4: Write unit tests for all modules
- [ ] Issue #5: Production deployment guide
- [ ] Issue #6: Multi-instance orchestration
- [ ] Issue #7: Malware analysis workflow
- [ ] Issue #8: Analytics dashboard (future)

Create GitHub Milestones:
- **Milestone 1: Core Functionality** (Issues #1, #2)
- **Milestone 2: Docker Deployment** (Issue #3)
- **Milestone 3: Production Ready** (Issues #4, #5)
- **Milestone 4: Multi-Instance** (Issue #6, #7)
- **Milestone 5: Analytics** (Issue #8)

### GitHub Labels
- `documentation` - Docs updates
- `enhancement` - New features
- `bug` - Bug fixes
- `security` - Security-related
- `threat-intel` - Threat intelligence features
- `emulation` - Shell emulation improvements
- `deployment` - Deployment and infrastructure

---

## File Structure (Current)

```
sshMON/
├── docs/
│   ├── ARCHITECTURE.md              ✅ Complete
│   ├── SHELL_EMULATION_RESEARCH.md  ✅ Complete (CRITICAL REFERENCE)
│   ├── THREAT_INTEL_SETUP.md        ✅ Complete
│   └── DEPLOYMENT.md                ✅ Complete
├── fakeServer/
│   ├── fakeSSH.js                   ⏳ Needs modernization
│   ├── logger.js                    ✅ Complete
│   ├── logToCSV.js                  ✅ Complete
│   ├── csvToHtml.js                 ✅ Complete
│   ├── threatIntel.js               ✅ Complete
│   ├── filesystem.js                ✅ Complete
│   └── shellEmulator.js             ❌ To be created (NEXT)
├── scripts/                         ❌ To be created
│   ├── generate-ssh-key.js
│   ├── health-check.js
│   └── analyze-logs.js
├── logs/                            (Created at runtime)
├── keys/                            (Created at runtime)
├── .env.example                     ✅ Complete
├── package.json                     ✅ Complete
├── Dockerfile                       ❌ To be created
├── docker-compose.yml               ❌ To be created
├── .dockerignore                    ❌ To be created
├── .gitignore                       ❌ To be created
├── README.md                        ✅ Complete
└── PROJECT_STATUS.md                ✅ This file
```

---

## Critical Reminders

1. **SHELL_EMULATION_RESEARCH.md is your bible** for implementing shellEmulator.js
   - Every command response should match the research
   - VM detection evasion is CRITICAL - if attackers detect honeypot, they leave

2. **Threat Intelligence APIs are Optional**
   - System works with zero API keys (uses geoip-lite)
   - Graceful degradation if APIs fail
   - Never block honeypot operation for enrichment

3. **Security First**
   - All shell interaction is scripted (no real execution)
   - Docker isolation mandatory for production
   - No real credentials or sensitive data in system

4. **Machine-Readable but Human-Scrollable**
   - JSON Lines for programmatic analysis
   - But `tail -f logs/honeypot.jsonl | jq` should be easy to read
   - CSV for quick Excel analysis

5. **Rate Limits Matter**
   - AbuseIPDB: 1000/day = cache aggressively
   - Shodan: 1/sec = queue carefully
   - IP-API: 45/min = use as fallback only

---

## Success Criteria

### Phase 1 Complete When:
- [x] All documentation written and reviewed
- [x] Core logging modules functional
- [x] Threat intel integration working
- [x] Filesystem structure realistic
- [ ] Shell emulator handles 50+ commands
- [ ] VM detection tests pass
- [ ] Modernized fakeSSH.js integrates everything

### Phase 2 Complete When:
- [ ] Docker builds successfully
- [ ] docker-compose up works first try
- [ ] Health checks pass
- [ ] Logs persist across restarts

### Phase 3 Complete When:
- [ ] 3 instances run simultaneously
- [ ] Each instance has different profile
- [ ] Logs aggregate correctly
- [ ] No resource conflicts

### Phase 4 Complete When:
- [ ] Deployed to public-facing IP
- [ ] Captures real attack within 24 hours
- [ ] Threat intel enrichment works in production
- [ ] No false positives (localhost not logged if disabled)

---

## Questions for User (If Needed)

1. **Shodan API Key**: Do you have your Shodan API key available to add to .env?
2. **Deployment Target**: AWS, DigitalOcean, GCP, or on-premises first?
3. **Port Preference**: Use port 22 (requires Docker root) or 2222 initially?
4. **Log Retention**: How long to keep logs? 30 days default okay?
5. **Multi-Instance Timing**: Test 3 instances immediately after single works, or wait?

---

## Resources & References

- **ssh2 Library Docs**: https://github.com/mscdex/ssh2
- **AbuseIPDB API**: https://docs.abuseipdb.com/
- **Shodan API**: https://developer.shodan.io/api
- **Docker Security**: https://docs.docker.com/engine/security/
- **OWASP Honeypot**: https://owasp.org/www-community/Honeypots

---

**Last Updated**: 2025-10-23 (Auto-generated during implementation)
**Maintained By**: Claude Code + User
**Project Goal**: Production-ready SSH honeypot for threat intelligence collection
