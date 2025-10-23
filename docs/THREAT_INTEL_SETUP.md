# Threat Intelligence API Setup Guide

This guide provides step-by-step instructions for obtaining and configuring threat intelligence API keys for sshMON. All services listed have **free tiers** suitable for honeypot deployment.

---

## Overview

sshMON integrates with multiple threat intelligence services to enrich attack data:

| Service | Purpose | Free Tier | Recommended |
|---------|---------|-----------|-------------|
| **geoip-lite** | IP Geolocation (offline) | Unlimited | ✅ Yes - Default |
| **IP-API** | IP Geolocation (online) | 45 req/min | ✅ Yes - Fallback |
| **AbuseIPDB** | IP Reputation | 1000 req/day | ✅ Yes - Primary reputation |
| **Shodan** | Host/Port Intelligence | 1 req/sec (basic) | ⚠️ Optional - if you have key |
| **MaxMind GeoLite2** | Enhanced Geolocation | Unlimited | ⚠️ Optional - better accuracy |

**Minimum Setup**: None required! sshMON works out-of-the-box with geoip-lite (offline database).

**Recommended Setup**: AbuseIPDB (free tier provides excellent IP reputation data).

---

## Quick Start (No API Keys)

If you want to get started immediately without any API keys:

```bash
# Clone and start
git clone https://github.com/yourusername/sshMON.git
cd sshMON
docker-compose up -d

# sshMON will use:
# - geoip-lite for geolocation (offline, no API needed)
# - No reputation checking (graceful degradation)
```

This is perfect for testing and initial deployment. Add API keys later to enhance data quality.

---

## Service Setup Instructions

### 1. AbuseIPDB (Recommended - IP Reputation)

**What It Provides**:
- Abuse Confidence Score (0-100%)
- Total reports count
- Category tags (SSH abuse, port scan, etc.)
- Tor exit node detection
- Known VPN/proxy detection

**Free Tier**:
- 1,000 requests per day
- 90-day historical data
- All API features

**Perfect for**: ~40 attacks/hour with 24-hour caching

#### Sign Up Process:

1. **Visit**: https://www.abuseipdb.com/register

2. **Create Account**:
   - Email address
   - Username
   - Password
   - Agree to terms

3. **Verify Email**: Check inbox and click verification link

4. **Generate API Key**:
   - Log in to https://www.abuseipdb.com/
   - Navigate to Account → API
   - Click "Create Key"
   - Give it a name (e.g., "sshMON Production")
   - Copy the key (looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0...`)

5. **Test Your Key**:
   ```bash
   curl -G https://api.abuseipdb.com/api/v2/check \
     --data-urlencode "ipAddress=8.8.8.8" \
     -d maxAgeInDays=90 \
     -H "Key: YOUR_API_KEY_HERE" \
     -H "Accept: application/json"
   ```

6. **Add to sshMON**:
   ```bash
   # Edit .env file
   ABUSEIPDB_API_KEY=your_actual_key_here
   ```

#### Rate Limit Management:

With 1,000 requests/day:
- **Without caching**: ~41 requests/hour = 1 every 88 seconds
- **With 24-hour caching**: ~1,000 unique IPs/day (sufficient for most deployments)

sshMON automatically:
- Caches results for 24 hours
- Queues requests to stay under limit
- Continues operation if quota exceeded (logs without reputation)

---

### 2. Shodan (Optional - Host Intelligence)

**What It Provides**:
- Open ports on attacker's IP
- Known vulnerabilities
- Organization/ISP details
- Hostnames and domains
- Historical scan data

**Free Tier** (Basic API Key):
- 1 query per second
- 100 query credits per month
- Basic host information

**Paid Tier** (if you upgrade later):
- Higher rate limits
- More query credits
- Advanced features

**Use Case**: Deep investigation of interesting attackers

#### If You Already Have a Shodan Account:

1. **Log in**: https://account.shodan.io/

2. **Find API Key**:
   - Navigate to Account (top right)
   - Your API key is displayed at the top
   - Copy it (looks like: `ABCD1234EFGH5678IJKL9012MNOP3456`)

3. **Add to sshMON**:
   ```bash
   # Edit .env file
   SHODAN_API_KEY=your_shodan_key_here
   SHODAN_RATE_LIMIT=1  # 1 req/sec for basic tier
   ```

#### If You Need a New Shodan Account:

1. **Sign Up**: https://account.shodan.io/register

2. **Choose Plan**:
   - **Free**: No credit card, 100 credits/month
   - **Basic**: $49/month (not necessary for honeypot)

3. **Retrieve API Key** (see steps above)

#### Rate Limit Management:

- Basic tier: **1 request per second** (strictly enforced)
- sshMON automatically spaces requests
- Caches results for 30 days (Shodan data changes slowly)
- Recommended: Enable only for "interesting" IPs (high AbuseIPDB score)

#### Testing Your Shodan Key:

```bash
curl "https://api.shodan.io/shodan/host/8.8.8.8?key=YOUR_SHODAN_KEY"
```

---

### 3. IP-API (No Key Needed - Geolocation Fallback)

**What It Provides**:
- Country, region, city
- Latitude/longitude
- ISP and organization
- ASN (Autonomous System Number)
- Timezone

**Free Tier**:
- 45 requests per minute
- 1,000 requests per day
- No API key required
- Non-commercial use

**Use Case**: Fallback when geoip-lite lacks data

#### Configuration:

```bash
# No API key needed!
# sshMON automatically uses IP-API as fallback
```

#### Rate Limits:

sshMON respects IP-API's limits:
- Max 45 requests/minute
- Automatic rate limiting built-in
- Falls back to geoip-lite if quota exceeded

**Note**: For commercial deployment, upgrade to IP-API Pro ($13/month for unlimited).

---

### 4. MaxMind GeoLite2 (Optional - Enhanced Geolocation)

**What It Provides**:
- More accurate city-level geolocation
- ASN database
- Offline database (faster than API calls)
- Weekly updates

**Free Tier**:
- GeoLite2 databases (free forever)
- Unlimited queries (offline database)
- Less accurate than paid GeoIP2 (still very good)

**Use Case**: Better geolocation than geoip-lite without API calls

#### Sign Up Process:

1. **Create Account**: https://www.maxmind.com/en/geolite2/signup

2. **Fill Form**:
   - Email
   - Password
   - Country
   - Use case: "Research" or "Education"

3. **Verify Email**

4. **Generate License Key**:
   - Log in: https://www.maxmind.com/en/account/login
   - Navigate to "My License Keys"
   - Click "Generate new license key"
   - **Important**: Select "No" for "Will this key be used for GeoIP Update?"
   - Name it (e.g., "sshMON Honeypot")
   - Copy the key (only shown once!)

5. **Add to sshMON**:
   ```bash
   # Edit .env file
   MAXMIND_LICENSE_KEY=your_license_key_here
   ```

sshMON will automatically download GeoLite2 databases on first run.

#### Database Updates:

MaxMind updates GeoLite2 weekly. sshMON can auto-update:

```bash
# Add to cron (weekly on Sundays)
0 2 * * 0 docker-compose exec honeypot npm run update-geoip
```

---

## Configuration Reference

### Complete .env File Example:

```bash
# ============================================
# sshMON Configuration
# ============================================

# Server Settings
PORT=2222
HOSTNAME=raspberrypi
USERNAME=root

# Logging
LOG_PATH=./logs
LOG_LEVEL=info
LOG_FORMAT=json,csv,session  # Comma-separated

# Threat Intelligence APIs
# -----------------------------------------

# AbuseIPDB (Recommended - Free 1000/day)
ABUSEIPDB_API_KEY=a1b2c3d4e5f6g7h8...

# Shodan (Optional - Basic tier 1 req/sec)
SHODAN_API_KEY=ABCD1234EFGH5678...
SHODAN_RATE_LIMIT=1

# MaxMind (Optional - Free offline database)
MAXMIND_LICENSE_KEY=xyz789abc...

# IP-API (No key needed, auto-enabled)
# Free: 45/min, 1000/day

# Rate Limiting
# -----------------------------------------
ABUSEIPDB_RATE_LIMIT=1000        # Requests per day
CACHE_ABUSEIPDB_TTL=86400        # 24 hours in seconds
CACHE_SHODAN_TTL=2592000         # 30 days in seconds

# Feature Flags
# -----------------------------------------
ENABLE_THREAT_INTEL=true         # Master switch
ENABLE_ABUSEIPDB=true
ENABLE_SHODAN=false              # Set true if you have key
ENABLE_MAXMIND=false             # Set true if you have key
ENABLE_IPAPI=true                # Fallback geolocation

# Shell Emulation
# -----------------------------------------
EMULATION_PROFILE=raspberry-pi   # Options: raspberry-pi, ubuntu-server, generic-iot
FILESYSTEM_DYNAMIC=true          # Generate dynamic content
VM_DETECTION_EVASION=true        # Respond to VM detection attempts

# Advanced
# -----------------------------------------
MAX_CONCURRENT_SESSIONS=50
SESSION_TIMEOUT=300              # Seconds of inactivity before disconnect
COMMAND_DELAY_MS=50              # Simulate command processing time
```

---

## Testing Your Configuration

After configuring API keys, test the integration:

### 1. Start sshMON:
```bash
docker-compose up -d
docker-compose logs -f
```

### 2. Trigger a Test Connection:

From another machine:
```bash
ssh root@your_honeypot_ip -p 2222
# Password: anything (will be accepted)
# Type: whoami
# Exit: CTRL+C
```

### 3. Check Logs:

```bash
# View JSON log with threat intel
tail -n 1 logs/honeypot.jsonl | jq .

# Should see:
{
  "timestamp": "2025-10-23T10:15:32.123Z",
  "event": "auth",
  "ip": "1.2.3.4",
  "geo": {
    "country": "US",
    "city": "New York",
    "asn": "AS15169"
  },
  "reputation": {
    "abuseipdb_score": 0,
    "total_reports": 0,
    "is_tor": false
  },
  "username": "root",
  "password": "test123"
}
```

If `geo` and `reputation` fields are populated, threat intel is working!

---

## Troubleshooting

### Issue: "AbuseIPDB rate limit exceeded"

**Symptoms**: Logs show `WARN: AbuseIPDB quota exceeded`

**Solutions**:
1. **Increase cache TTL**: `CACHE_ABUSEIPDB_TTL=172800` (48 hours)
2. **Reduce checks**: Only check IPs with >5 auth attempts
3. **Wait**: Quota resets in 24 hours
4. **Upgrade**: AbuseIPDB paid tier (not usually necessary)

---

### Issue: "Shodan API error: 401 Unauthorized"

**Cause**: Invalid API key

**Solutions**:
1. Verify key copied correctly (no extra spaces)
2. Check key is active at https://account.shodan.io/
3. Ensure key has remaining credits
4. Test manually:
   ```bash
   curl "https://api.shodan.io/api-info?key=YOUR_KEY"
   ```

---

### Issue: "MaxMind database download failed"

**Cause**: License key invalid or network issue

**Solutions**:
1. Re-generate license key at MaxMind
2. Ensure "GeoIP Update" option was set to "No"
3. Check network connectivity from container:
   ```bash
   docker-compose exec honeypot curl https://download.maxmind.com
   ```
4. Manually download databases:
   ```bash
   npm run download-geoip
   ```

---

### Issue: "No threat intelligence data appearing"

**Checklist**:
- [ ] `ENABLE_THREAT_INTEL=true` in .env
- [ ] At least one API key configured OR geoip-lite installed
- [ ] Container restarted after .env changes
- [ ] No firewall blocking API requests
- [ ] Test IP is not localhost (127.0.0.1/::1 skipped)

**Debug Mode**:
```bash
# Enable debug logging
LOG_LEVEL=debug
docker-compose restart
docker-compose logs -f | grep -i "threat"
```

---

## API Cost Planning

### Expected API Usage (per day)

Assuming **100 unique attacker IPs per day**:

| Service | Requests | Free Tier | Cost (if exceeded) |
|---------|----------|-----------|-------------------|
| AbuseIPDB | 100 (with cache) | 1000/day | $20/mo for 10k |
| Shodan | 0-10 (selective) | 100/month | $49/mo unlimited |
| IP-API | 100 (fallback) | 1000/day | $13/mo unlimited |
| MaxMind | 0 (offline) | Unlimited | Free forever |

**Recommendation**: Start with free tiers. You'll likely never need paid plans for a single honeypot instance.

### Scaling to 1,000 Unique IPs/day:

- **AbuseIPDB**: Upgrade to $20/month (10,000 requests)
- **IP-API**: Upgrade to Pro $13/month (unlimited)
- **Shodan**: Keep disabled or use sparingly (100/month sufficient)
- **MaxMind**: Still free

**Total cost at scale**: ~$33/month for full threat intel

---

## Privacy & Legal Considerations

### Data Retention:

- **API Providers**: Store IP lookups in their logs
- **sshMON**: Stores attacker IPs locally (ensure compliance)

### GDPR Considerations:

- IP addresses are personal data in EU
- Honeypot data = security processing (legitimate interest)
- Document purpose: "Network security monitoring"
- Consider anonymization after 90 days (hash IPs in old logs)

### Terms of Service:

- **AbuseIPDB**: Free tier for non-commercial use only
- **IP-API**: Non-commercial license (commercial = $13/month)
- **Shodan**: Check data redistribution terms if sharing honeypot data publicly
- **MaxMind**: Cannot redistribute GeoLite2 databases

---

## Advanced: Custom Threat Intel Integration

Want to add another service? Modify `threatIntel.js`:

```javascript
// Example: Adding VirusTotal IP lookup
async function checkVirusTotal(ip) {
  const response = await axios.get(`https://www.virustotal.com/api/v3/ip_addresses/${ip}`, {
    headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY }
  });
  return {
    malicious_votes: response.data.data.attributes.last_analysis_stats.malicious,
    reputation: response.data.data.attributes.reputation
  };
}

// Add to enrichment pipeline
exports.enrichIP = async (ip) => {
  // ... existing code ...
  if (process.env.VIRUSTOTAL_API_KEY) {
    enriched.virustotal = await checkVirusTotal(ip);
  }
  return enriched;
};
```

---

## Summary Checklist

**Minimum Setup** (no API keys needed):
- [x] Deploy sshMON with docker-compose
- [x] Uses geoip-lite automatically
- [x] Ready to collect attack data

**Recommended Setup** (best free experience):
- [x] Sign up for AbuseIPDB
- [x] Add `ABUSEIPDB_API_KEY` to .env
- [x] Restart container
- [x] Verify reputation data in logs

**Advanced Setup** (maximum intelligence):
- [x] Add Shodan key (if available)
- [x] Add MaxMind license
- [x] Configure rate limits
- [x] Enable all services
- [x] Test with real attack

**Next Steps**:
- Monitor API quota usage (check service dashboards weekly)
- Review logs for threat patterns
- Adjust caching based on attack volume

---

**Need Help?**
- AbuseIPDB Support: https://www.abuseipdb.com/contact
- Shodan Support: https://help.shodan.io/
- MaxMind Support: https://support.maxmind.com/
- sshMON Issues: https://github.com/yourusername/sshMON/issues

---

**Document Version**: 1.0
**Last Updated**: 2025-10-23
