# sshMON Production Deployment Guide

This guide covers best practices for deploying sshMON in production environments, from single-instance setups to distributed honeypot networks.

---

## Table of Contents

1. [Pre-Deployment Planning](#pre-deployment-planning)
2. [Single Instance Deployment](#single-instance-deployment)
3. [Multi-Instance Deployment](#multi-instance-deployment)
4. [Security Hardening](#security-hardening)
5. [Monitoring & Maintenance](#monitoring--maintenance)
6. [Incident Response](#incident-response)
7. [Scaling Strategies](#scaling-strategies)

---

## Pre-Deployment Planning

### 1. Legal & Compliance

**Authorization Required**:
- ✅ Written permission to deploy honeypot on network
- ✅ Approval from IT security team / management
- ✅ Legal review (especially for corporate networks)
- ✅ Terms of service compliance (cloud providers)

**Prohibited Uses**:
- ❌ Deploying on networks you don't own/manage
- ❌ "Hacking back" or active countermeasures
- ❌ Capturing data without proper authorization
- ❌ Violating cloud provider ToS

**Documentation**:
- Document honeypot purpose and scope
- Define data retention policies
- Establish incident response procedures
- Maintain audit trail of approvals

---

### 2. Network Architecture Planning

**Isolation Requirements**:

```
┌─────────────────────────────────────────────────────────┐
│  Internet                                                │
└───────────────────────┬─────────────────────────────────┘
                        │
                ┌───────▼────────┐
                │  Firewall      │
                │  - Allow 22 IN │
                │  - Deny ALL OUT│ (or allow only threat intel APIs)
                └───────┬────────┘
                        │
        ┌───────────────▼─────────────────┐
        │  DMZ / Isolated Honeypot VLAN   │
        │  ┌──────────────────────────┐   │
        │  │  sshMON Container(s)     │   │
        │  └──────────────────────────┘   │
        │  NO ACCESS to:                  │
        │  - Production systems           │
        │  - Internal networks            │
        │  - Sensitive data               │
        └─────────────────────────────────┘
```

**Firewall Rules**:

Inbound:
```bash
# Allow SSH to honeypot
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# (Optional) Allow on alternate port
iptables -A INPUT -p tcp --dport 2222 -j ACCEPT
```

Outbound (Option 1 - Maximum Isolation):
```bash
# Deny all outbound (most secure)
iptables -A OUTPUT -j DROP
```

Outbound (Option 2 - Threat Intel Enabled):
```bash
# Allow DNS
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT

# Allow HTTPS for threat intel APIs
iptables -A OUTPUT -p tcp --dport 443 -d api.abuseipdb.com -j ACCEPT
iptables -A OUTPUT -p tcp --dport 443 -d api.shodan.io -j ACCEPT
iptables -A OUTPUT -p tcp --dport 443 -d ip-api.com -j ACCEPT

# Deny everything else
iptables -A OUTPUT -j DROP
```

**Recommendation**: Use Option 2 with strict outbound rules to enable threat intelligence while preventing compromise.

---

### 3. Infrastructure Selection

#### Cloud Deployment

**AWS**:
```
Instance Type: t3.micro (free tier eligible)
Region: Choose based on target geography
VPC: Dedicated VPC with isolated subnet
Security Group: Custom rules (SSH inbound only)
Cost: ~$8/month (after free tier)
```

**DigitalOcean**:
```
Droplet: Basic ($6/month)
Region: Multiple regions for distributed deployment
Networking: VPC with firewall rules
Backups: Enable for log preservation
Cost: $6/month per instance
```

**Google Cloud**:
```
Instance: e2-micro (free tier eligible)
Region: Global distribution options
VPC: Custom VPC with firewall rules
Cost: ~$7/month (after free tier)
```

**Azure**:
```
VM: B1s ($7.59/month)
Region: Choose strategically
NSG: Network Security Groups for isolation
Cost: ~$8/month
```

**Recommendation**: Start with cloud provider offering free tier (AWS/GCP) for testing, then scale to DigitalOcean for cost-effective multi-instance.

#### On-Premises

**Raspberry Pi** (Home/Lab):
```
Hardware: Raspberry Pi 4 (2GB RAM) - $45
Power: 5V 3A USB-C - $8
Network: Dedicated VLAN or separate router
Total: ~$60 one-time
Power Cost: ~$2/year
```

**Dedicated Server**:
```
Hardware: Any x86_64 server with Docker support
Isolation: VLAN tagging or physical separation
Monitoring: Local syslog server
```

---

## Single Instance Deployment

### Step-by-Step Production Setup

#### 1. Provision Server

**AWS Example**:
```bash
# Launch t3.micro with Ubuntu 22.04 LTS
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.micro \
  --security-group-ids sg-honeypot \
  --subnet-id subnet-dmz \
  --key-name honeypot-key \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=sshMON-prod}]'
```

**DigitalOcean Example**:
```bash
# Create droplet via web UI or doctl
doctl compute droplet create sshmon-prod \
  --image ubuntu-22-04-x64 \
  --size s-1vcpu-1gb \
  --region nyc1 \
  --vpc-uuid <vpc-id> \
  --tag-name honeypot
```

---

#### 2. Initial Server Hardening

**Update System**:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y fail2ban ufw docker.io docker-compose git
```

**Configure Firewall**:
```bash
# Allow SSH for management (use non-standard port)
sudo ufw allow 2222/tcp comment 'Honeypot SSH'

# (Optional) Allow your admin SSH on different port
sudo ufw allow from <your-ip> to any port 2223 comment 'Admin SSH'

# Enable firewall
sudo ufw --force enable
```

**Disable Unnecessary Services**:
```bash
sudo systemctl disable bluetooth
sudo systemctl disable cups
sudo systemctl stop bluetooth cups
```

---

#### 3. Deploy sshMON

**Clone Repository**:
```bash
cd /opt
sudo git clone https://github.com/yourusername/sshMON.git
cd sshMON
```

**Configure Environment**:
```bash
sudo cp .env.example .env
sudo nano .env  # Edit configuration
```

**Critical .env Settings for Production**:
```bash
# Use port 22 for realism (Docker port mapping)
PORT=22

# Rotate based on deployment
HOSTNAME=ubuntu-server
USERNAME=admin

# Enable all threat intel
ENABLE_THREAT_INTEL=true
ABUSEIPDB_API_KEY=your_key_here

# Production logging
LOG_LEVEL=info
LOG_PATH=/var/log/sshmon

# Security
MAX_CONCURRENT_SESSIONS=20
SESSION_TIMEOUT=180
```

**Set Permissions**:
```bash
sudo mkdir -p /var/log/sshmon
sudo chown -R 1001:1001 /var/log/sshmon
sudo chmod 755 /var/log/sshmon
```

**Start Services**:
```bash
sudo docker-compose up -d
```

**Verify Deployment**:
```bash
# Check container status
sudo docker-compose ps

# Check logs
sudo docker-compose logs -f

# Test connection from external IP
ssh root@<honeypot-ip> -p 22
```

---

#### 4. Configure Log Management

**Log Rotation**:
```bash
# Create /etc/logrotate.d/sshmon
sudo nano /etc/logrotate.d/sshmon
```

```
/var/log/sshmon/*.jsonl {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 1001 1001
    sharedscripts
    postrotate
        docker-compose -f /opt/sshMON/docker-compose.yml restart
    endscript
}

/var/log/sshmon/*.csv {
    weekly
    rotate 12
    compress
    delaycompress
    notifempty
    create 0640 1001 1001
}
```

**Test Rotation**:
```bash
sudo logrotate -f /etc/logrotate.d/sshmon
```

---

#### 5. Configure Automated Backups

**Daily Log Backup to S3**:
```bash
# Install AWS CLI
sudo apt install -y awscli

# Create backup script
sudo nano /opt/sshMON/scripts/backup-logs.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d)
LOG_DIR="/var/log/sshmon"
S3_BUCKET="s3://your-honeypot-logs"

# Compress today's logs
tar -czf /tmp/sshmon-logs-$DATE.tar.gz -C $LOG_DIR .

# Upload to S3
aws s3 cp /tmp/sshmon-logs-$DATE.tar.gz $S3_BUCKET/

# Cleanup
rm /tmp/sshmon-logs-$DATE.tar.gz

# Delete local logs older than 30 days
find $LOG_DIR -name "*.jsonl.*" -mtime +30 -delete
```

**Schedule Cron**:
```bash
sudo chmod +x /opt/sshMON/scripts/backup-logs.sh
sudo crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/sshMON/scripts/backup-logs.sh
```

---

## Multi-Instance Deployment

### Three-Instance Testing Configuration

**Purpose**: Test with different "personalities" to attract varied attacks.

#### Instance Profiles:

**Instance 1 - Raspberry Pi Profile**:
```bash
# .env configuration
HOSTNAME=raspberrypi
EMULATION_PROFILE=raspberry-pi
PORT=22
```

**Instance 2 - Ubuntu Server Profile**:
```bash
# .env configuration
HOSTNAME=ubuntu-server
EMULATION_PROFILE=ubuntu-server
PORT=22
```

**Instance 3 - Generic IoT Profile**:
```bash
# .env configuration
HOSTNAME=camera01
EMULATION_PROFILE=generic-iot
PORT=22
```

#### Deploy via Docker Compose Override:

```yaml
# docker-compose.override.yml
version: '3.8'

services:
  honeypot1:
    extends: honeypot
    container_name: sshmon-rpi
    ports:
      - "2222:22"
    env_file:
      - .env.rpi
    volumes:
      - ./logs/rpi:/logs

  honeypot2:
    extends: honeypot
    container_name: sshmon-ubuntu
    ports:
      - "2223:22"
    env_file:
      - .env.ubuntu
    volumes:
      - ./logs/ubuntu:/logs

  honeypot3:
    extends: honeypot
    container_name: sshmon-iot
    ports:
      - "2224:22"
    env_file:
      - .env.iot
    volumes:
      - ./logs/iot:/logs
```

**Start All Instances**:
```bash
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

---

### Distributed Network Deployment

**Architecture**:
```
Region 1 (US-East)     Region 2 (EU-West)    Region 3 (Asia-Pac)
    3 instances            3 instances           3 instances
         ↓                      ↓                     ↓
         └──────────────────────┴─────────────────────┘
                                │
                      ┌─────────▼──────────┐
                      │  Central Log Server │
                      │  (ELK Stack / Splunk) │
                      └────────────────────┘
```

**Log Forwarding** (Fluentd):

Each honeypot forwards logs to central server:

```yaml
# fluentd.conf
<source>
  @type tail
  path /logs/honeypot.jsonl
  pos_file /var/log/fluentd/sshmon.pos
  tag honeypot.attacks
  format json
</source>

<match honeypot.**>
  @type forward
  <server>
    host central-log-server.yourdomain.com
    port 24224
  </server>
  <buffer>
    flush_interval 10s
  </buffer>
</match>
```

**Central Server** (Elasticsearch):
```bash
# On central server
docker run -d \
  -p 9200:9200 \
  -p 5601:5601 \
  -e "discovery.type=single-node" \
  docker.elastic.co/elasticsearch/elasticsearch:8.10.0
```

---

## Security Hardening

### Container Hardening

**docker-compose.yml Security Settings**:
```yaml
version: '3.8'

services:
  honeypot:
    image: sshmon:latest
    build: .

    # Security options
    security_opt:
      - no-new-privileges:true
      - apparmor=docker-default
      - seccomp=/path/to/seccomp-profile.json

    # Drop all capabilities
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE  # Only if binding port < 1024

    # Read-only root filesystem
    read_only: true

    # Temporary filesystems
    tmpfs:
      - /tmp:noexec,nosuid,nodev,size=100m
      - /run:noexec,nosuid,nodev,size=50m

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

    # Restart policy
    restart: unless-stopped

    # Logging limits
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

**Custom Seccomp Profile**:
```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "syscalls": [
    {
      "names": [
        "accept", "bind", "listen", "socket",
        "read", "write", "open", "close",
        "stat", "fstat", "lstat",
        "poll", "select", "epoll_wait"
      ],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
```

---

### Host Hardening

**Kernel Hardening** (sysctl):
```bash
# /etc/sysctl.d/99-honeypot.conf

# Network security
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.default.rp_filter=1
net.ipv4.tcp_syncookies=1
net.ipv4.conf.all.accept_redirects=0
net.ipv4.conf.all.send_redirects=0
net.ipv4.icmp_echo_ignore_broadcasts=1

# Disable IPv6 (if not needed)
net.ipv6.conf.all.disable_ipv6=1

# Apply
sudo sysctl -p /etc/sysctl.d/99-honeypot.conf
```

**SSH Hardening** (for admin access):
```bash
# /etc/ssh/sshd_config (admin SSH on port 2223)

Port 2223  # NOT 22 (honeypot uses 22)
Protocol 2
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
AllowUsers admin_user
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2

# Restart SSH
sudo systemctl restart sshd
```

---

## Monitoring & Maintenance

### Health Monitoring

**Docker Health Checks**:
```yaml
services:
  honeypot:
    healthcheck:
      test: ["CMD-SHELL", "nc -z localhost 22 || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

**External Monitoring** (Uptime Robot):
- Monitor honeypot availability
- Alert if down >5 minutes
- Use TCP check on port 22

**Alert Script**:
```bash
#!/bin/bash
# /opt/sshMON/scripts/health-check.sh

if ! docker-compose -f /opt/sshMON/docker-compose.yml ps | grep -q "Up"; then
  echo "sshMON container is down!" | mail -s "Honeypot Alert" admin@example.com
  docker-compose -f /opt/sshMON/docker-compose.yml up -d
fi
```

**Cron**:
```bash
*/5 * * * * /opt/sshMON/scripts/health-check.sh
```

---

### Log Analysis

**Daily Attack Summary**:
```bash
#!/bin/bash
# /opt/sshMON/scripts/daily-summary.sh

DATE=$(date +%Y-%m-%d)
LOG_FILE="/var/log/sshmon/honeypot.jsonl"

echo "sshMON Daily Summary - $DATE"
echo "================================="
echo ""
echo "Total Connections:"
grep '"event":"connection"' $LOG_FILE | wc -l
echo ""
echo "Unique IPs:"
grep '"event":"connection"' $LOG_FILE | jq -r .ip | sort -u | wc -l
echo ""
echo "Top 10 IPs:"
grep '"event":"connection"' $LOG_FILE | jq -r .ip | sort | uniq -c | sort -rn | head -10
echo ""
echo "Top 10 Passwords:"
grep '"event":"auth"' $LOG_FILE | jq -r .password | sort | uniq -c | sort -rn | head -10
echo ""
echo "Top 10 Commands:"
grep '"event":"command"' $LOG_FILE | jq -r .input | sort | uniq -c | sort -rn | head -10
```

**Email Report**:
```bash
# Cron daily at 6 AM
0 6 * * * /opt/sshMON/scripts/daily-summary.sh | mail -s "Honeypot Daily Report" admin@example.com
```

---

## Incident Response

### Interesting Attack Indicators

**Alert on**:
- High AbuseIPDB score (>80) attackers
- Commands indicating advanced techniques (not just brute force)
- Download attempts (wget/curl to C2 servers)
- Multiple rapid connection attempts (coordinated attack)

**Automated Alert Script**:
```bash
#!/bin/bash
# Monitor for interesting attacks in real-time

tail -F /var/log/sshmon/honeypot.jsonl | while read line; do
  # High reputation score
  if echo "$line" | jq -e '.reputation.abuseipdb_score > 80' >/dev/null; then
    echo "HIGH RISK IP: $line" | mail -s "Honeypot: High-Risk Attacker" security@example.com
  fi

  # Malware download
  if echo "$line" | jq -e '.event == "download"' >/dev/null; then
    echo "MALWARE DOWNLOAD: $line" | mail -s "Honeypot: Malware Detected" security@example.com
  fi
done
```

---

## Scaling Strategies

### Horizontal Scaling

**Kubernetes Deployment** (Future):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sshmon
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sshmon
  template:
    metadata:
      labels:
        app: sshmon
    spec:
      containers:
      - name: honeypot
        image: sshmon:latest
        ports:
        - containerPort: 22
        env:
        - name: PORT
          value: "22"
        volumeMounts:
        - name: logs
          mountPath: /logs
      volumes:
      - name: logs
        persistentVolumeClaim:
          claimName: sshmon-logs
```

---

## Maintenance Checklist

**Daily**:
- [ ] Check container status (`docker-compose ps`)
- [ ] Review alert emails
- [ ] Verify log rotation

**Weekly**:
- [ ] Review attack trends
- [ ] Check API quota usage (AbuseIPDB, Shodan)
- [ ] Update threat intel databases (`npm run update-geoip`)
- [ ] Backup analysis of interesting attacks

**Monthly**:
- [ ] Update Docker images (`docker-compose pull && docker-compose up -d`)
- [ ] Review and update firewall rules
- [ ] Audit log retention policies
- [ ] Check disk usage

**Quarterly**:
- [ ] Security audit
- [ ] Review and update emulation responses
- [ ] Test incident response procedures
- [ ] Update documentation

---

## Appendix: Quick Reference Commands

```bash
# View live logs
docker-compose logs -f

# Restart honeypot
docker-compose restart

# Update and redeploy
git pull
docker-compose build
docker-compose up -d

# Check resource usage
docker stats

# Export logs
docker-compose exec honeypot cat /logs/honeypot.jsonl > export.jsonl

# Shell into container (debugging)
docker-compose exec honeypot /bin/bash

# View top attacker IPs today
grep "$(date +%Y-%m-%d)" /var/log/sshmon/honeypot.jsonl | jq -r .ip | sort | uniq -c | sort -rn | head -20
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-23
