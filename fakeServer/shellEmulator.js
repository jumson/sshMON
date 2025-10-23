// Shell Emulator Module
// Handles command parsing and generates realistic responses
// Reference: docs/SHELL_EMULATION_RESEARCH.md

const FakeFilesystem = require('./filesystem');
const logger = require('./logger');

require('dotenv').config();

const EMULATION_PROFILE = process.env.EMULATION_PROFILE || 'raspberry-pi';
const COMMAND_DELAY_MS = parseInt(process.env.COMMAND_DELAY_MS) || 50;
const VM_DETECTION_EVASION = process.env.VM_DETECTION_EVASION === 'true';

// Profile-specific configurations
const profiles = {
    'raspberry-pi': {
        hostname: 'raspberrypi',
        username: 'root',
        architecture: 'armv7l',
        kernel: 'Linux raspberrypi 5.10.63-v7l+ #1459 SMP Wed Oct 6 16:41:57 BST 2021 armv7l GNU/Linux',
        ipAddress: '192.168.1.47',
        macAddress: 'b8:27:eb:3a:12:34'
    },
    'ubuntu-server': {
        hostname: 'ubuntu-server',
        username: 'admin',
        architecture: 'x86_64',
        kernel: 'Linux ubuntu-server 5.4.0-84-generic #94-Ubuntu SMP Thu Aug 26 20:27:37 UTC 2021 x86_64 x86_64 x86_64 GNU/Linux',
        ipAddress: '192.168.1.152',
        macAddress: 'aa:bb:cc:dd:ee:ff'
    },
    'generic-iot': {
        hostname: 'camera01',
        username: 'admin',
        architecture: 'mips',
        kernel: 'Linux localhost 4.9.140 #1 SMP PREEMPT Mon Jul 15 10:23:45 CST 2019 mips GNU/Linux',
        ipAddress: '192.168.1.198',
        macAddress: '00:11:22:33:44:55'
    }
};

const profile = profiles[EMULATION_PROFILE] || profiles['raspberry-pi'];

class ShellEmulator {
    constructor(sessionId, ip, authenticatedUsername) {
        this.sessionId = sessionId;
        this.ip = ip;
        this.username = authenticatedUsername || profile.username;
        this.filesystem = new FakeFilesystem();
        this.commandCount = 0;
        this.env = {
            HOME: '/root',
            USER: this.username,
            SHELL: '/bin/bash',
            PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
            PWD: '/root'
        };

        // Command handlers
        this.commands = {
            // Identity & Privileges
            'whoami': this.handleWhoami.bind(this),
            'id': this.handleId.bind(this),
            'sudo': this.handleSudo.bind(this),

            // System Information
            'uname': this.handleUname.bind(this),
            'hostname': this.handleHostname.bind(this),
            'uptime': this.handleUptime.bind(this),

            // Filesystem Navigation
            'pwd': this.handlePwd.bind(this),
            'cd': this.handleCd.bind(this),
            'ls': this.handleLs.bind(this),
            'cat': this.handleCat.bind(this),
            'echo': this.handleEcho.bind(this),

            // VM Detection
            'systemd-detect-virt': this.handleSystemdDetectVirt.bind(this),
            'dmidecode': this.handleDmidecode.bind(this),
            'lspci': this.handleLspci.bind(this),
            'dmesg': this.handleDmesg.bind(this),

            // Network Commands
            'ifconfig': this.handleIfconfig.bind(this),
            'ip': this.handleIp.bind(this),
            'netstat': this.handleNetstat.bind(this),
            'ss': this.handleSs.bind(this),
            'ping': this.handlePing.bind(this),

            // Process & System
            'ps': this.handlePs.bind(this),
            'top': this.handleTop.bind(this),
            'free': this.handleFree.bind(this),
            'df': this.handleDf.bind(this),

            // Downloading (CRITICAL for malware capture)
            'wget': this.handleWget.bind(this),
            'curl': this.handleCurl.bind(this),

            // Other Common Commands
            'find': this.handleFind.bind(this),
            'grep': this.handleGrep.bind(this),
            'history': this.handleHistory.bind(this),
            'exit': this.handleExit.bind(this),
            'clear': this.handleClear.bind(this)
        };
    }

    /**
     * Execute command and return response
     */
    async execute(input) {
        this.commandCount++;
        const trimmed = input.trim();

        if (!trimmed) return '';

        // Parse command and arguments
        const parsed = this.parseCommand(trimmed);
        const cmd = parsed.command.toLowerCase();

        // Log command
        logger.info(`Command executed: ${trimmed}`, { session: this.sessionId, ip: this.ip });

        // Simulate processing delay
        if (COMMAND_DELAY_MS > 0) {
            await new Promise(resolve => setTimeout(resolve, COMMAND_DELAY_MS));
        }

        // Route to handler
        if (this.commands[cmd]) {
            return this.commands[cmd](parsed.args, parsed.flags);
        }

        // Default: command not found
        return this.handleUnknown(cmd);
    }

    /**
     * Parse command line into command, args, and flags
     */
    parseCommand(input) {
        const parts = input.split(/\s+/);
        const command = parts[0];
        const args = [];
        const flags = {};

        for (let i = 1; i < parts.length; i++) {
            if (parts[i].startsWith('-')) {
                flags[parts[i]] = true;
            } else {
                args.push(parts[i]);
            }
        }

        return { command, args, flags };
    }

    /**
     * Get prompt string
     */
    getPrompt() {
        return `${this.username}@${profile.hostname}:${this.filesystem.pwd()}# `;
    }

    // ========================================
    // COMMAND HANDLERS
    // ========================================

    handleWhoami(args, flags) {
        return this.username;
    }

    handleId(args, flags) {
        if (this.username === 'root') {
            return 'uid=0(root) gid=0(root) groups=0(root)';
        }
        return `uid=1000(${this.username}) gid=1000(${this.username}) groups=1000(${this.username}),27(sudo)`;
    }

    handleSudo(args, flags) {
        if (args.includes('-l')) {
            return `User ${this.username} may run the following commands on ${profile.hostname}:\n    (ALL : ALL) ALL`;
        }
        // Simulate sudo command execution
        return this.handleUnknown('sudo');
    }

    handleUname(args, flags) {
        if (flags['-a']) {
            return profile.kernel;
        }
        if (flags['-r']) {
            return profile.kernel.split(' ')[2];
        }
        if (flags['-m']) {
            return profile.architecture;
        }
        return 'Linux';
    }

    handleHostname(args, flags) {
        return profile.hostname;
    }

    handleUptime(args, flags) {
        const uptime = Math.floor(Math.random() * 7 * 24 * 60); // Random uptime up to 7 days
        const days = Math.floor(uptime / (24 * 60));
        const hours = Math.floor((uptime % (24 * 60)) / 60);
        const minutes = uptime % 60;
        const load = `${(Math.random() * 0.5).toFixed(2)}, ${(Math.random() * 0.3).toFixed(2)}, ${(Math.random() * 0.2).toFixed(2)}`;

        return ` ${new Date().toTimeString().split(' ')[0]} up ${days} days, ${hours}:${minutes.toString().padStart(2, '0')}, 1 user, load average: ${load}`;
    }

    handlePwd(args, flags) {
        return this.filesystem.pwd();
    }

    handleCd(args, flags) {
        const target = args[0] || '/root';
        const result = this.filesystem.cd(target);

        if (result.success) {
            this.env.PWD = result.dir;
            return '';
        }
        return result.error;
    }

    handleLs(args, flags) {
        const path = args[0] || this.filesystem.pwd();
        const entries = this.filesystem.ls(path);

        if (!entries) {
            return `ls: cannot access '${path}': No such file or directory`;
        }

        if (flags['-l'] || flags['-la'] || flags['-al']) {
            // Long format
            return entries.map(entry => {
                const isDir = this.filesystem.get(`${path}/${entry}`)?.type === 'dir';
                const perms = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
                const size = isDir ? '4096' : Math.floor(Math.random() * 50000).toString();
                const date = 'Oct 23 10:15';
                return `${perms}  1 root root ${size.padStart(8)} ${date} ${entry}`;
            }).join('\n');
        }

        // Simple format
        return entries.join('  ');
    }

    handleCat(args, flags) {
        if (args.length === 0) {
            return ''; // Wait for input (we won't actually handle this)
        }

        const path = args[0];
        const content = this.filesystem.cat(path);

        if (content === null) {
            return `cat: ${path}: No such file or directory`;
        }

        return content;
    }

    handleEcho(args, flags) {
        return args.join(' ');
    }

    // ========================================
    // VM DETECTION EVASION (CRITICAL!)
    // Reference: docs/SHELL_EMULATION_RESEARCH.md
    // ========================================

    handleSystemdDetectVirt(args, flags) {
        if (!VM_DETECTION_EVASION) {
            return 'none';
        }
        // MUST return 'none' for bare metal
        // Exit code 1 (handled by shell wrapper)
        return 'none';
    }

    handleDmidecode(args, flags) {
        // ARM systems typically don't have dmidecode
        if (profile.architecture === 'armv7l' || profile.architecture === 'mips') {
            return 'bash: dmidecode: command not found';
        }
        // x86 systems: show real-looking hardware
        if (args.includes('-s') && args.includes('system-product-name')) {
            return 'OptiPlex 7060';
        }
        return 'bash: dmidecode: command not found'; // Safer default
    }

    handleLspci(args, flags) {
        // ARM/MIPS systems don't have PCI bus
        if (profile.architecture === 'armv7l' || profile.architecture === 'mips') {
            return 'bash: lspci: command not found';
        }
        // x86: Show minimal PCI devices (no VM-specific devices)
        return `00:00.0 Host bridge: Intel Corporation Device 5904 (rev 08)
00:02.0 VGA compatible controller: Intel Corporation UHD Graphics 620 (rev 07)
00:14.0 USB controller: Intel Corporation Sunrise Point-LP USB 3.0 xHCI Controller (rev 21)`;
    }

    handleDmesg(args, flags) {
        // Modern systems restrict dmesg
        return 'dmesg: read kernel buffer failed: Operation not permitted';
    }

    // ========================================
    // NETWORK COMMANDS
    // ========================================

    handleIfconfig(args, flags) {
        return `eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet ${profile.ipAddress}  netmask 255.255.255.0  broadcast 192.168.1.255
        inet6 fe80::ba27:ebff:fe3a:1234  prefixlen 64  scopeid 0x20<link>
        ether ${profile.macAddress}  txqueuelen 1000  (Ethernet)
        RX packets 145832  bytes 98234567 (93.7 MiB)
        RX errors 0  dropped 12  overruns 0  frame 0
        TX packets 89234  bytes 45678901 (43.5 MiB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.255.0.0
        inet6 ::1  prefixlen 128  scopeid 0x10<host>
        loop  txqueuelen 1000  (Local Loopback)`;
    }

    handleIp(args, flags) {
        if (args[0] === 'addr' || args[0] === 'a') {
            return `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP qlen 1000
    link/ether ${profile.macAddress} brd ff:ff:ff:ff:ff:ff
    inet ${profile.ipAddress}/24 brd 192.168.1.255 scope global eth0`;
        }
        return 'Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }';
    }

    handleNetstat(args, flags) {
        if (flags['-tulpn'] || flags['-tulp']) {
            return `Active Internet connections (only servers)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      412/sshd
tcp        0      0 127.0.0.1:631           0.0.0.0:*               LISTEN      -
tcp6       0      0 :::22                   :::*                    LISTEN      412/sshd`;
        }
        return 'Active Internet connections (w/o servers)';
    }

    handleSs(args, flags) {
        return this.handleNetstat(args, flags);
    }

    handlePing(args, flags) {
        const target = args[0] || '8.8.8.8';
        return `PING ${target} (${target}) 56(84) bytes of data.
64 bytes from ${target}: icmp_seq=1 ttl=64 time=0.045 ms
64 bytes from ${target}: icmp_seq=2 ttl=64 time=0.052 ms
^C
--- ${target} ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1001ms
rtt min/avg/max/mdev = 0.045/0.048/0.052/0.003 ms`;
    }

    // ========================================
    // PROCESS & SYSTEM
    // ========================================

    handlePs(args, flags) {
        if (flags['-aux'] || args[0] === 'aux') {
            return `USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.2  27092  2876 ?        Ss   Oct22   0:01 /sbin/init
root       412  0.0  0.4  12876  4712 ?        Ss   Oct22   0:00 /usr/sbin/sshd -D
root      1834  0.0  0.2   7644  2156 pts/0    Ss   10:15   0:00 -bash
root      1891  0.0  0.1   9392  1320 pts/0    R+   10:17   0:00 ps aux`;
        }
        return `  PID TTY          TIME CMD
 1834 pts/0    00:00:00 bash
 1891 pts/0    00:00:00 ps`;
    }

    handleTop(args, flags) {
        return `top - ${new Date().toTimeString().split(' ')[0]} up 2 days, 1:45, 1 user, load average: 0.12, 0.08, 0.05
Tasks:  78 total,   1 running,  77 sleeping,   0 stopped,   0 zombie
%Cpu(s):  2.3 us,  0.7 sy,  0.0 ni, 96.8 id,  0.2 wa,  0.0 hi,  0.0 si,  0.0 st
KiB Mem :   949248 total,   554320 free,   156872 used,   238056 buff/cache

  PID USER      PR  NI    VIRT    RES    SHR S  %CPU %MEM     TIME+ COMMAND
    1 root      20   0   27092   2876   2548 S   0.0  0.3   0:01.23 init
  412 root      20   0   12876   4712   3876 S   0.0  0.5   0:00.45 sshd`;
    }

    handleFree(args, flags) {
        const header = flags['-h'] ? 'total        used        free      shared  buff/cache   available' : 'total        used        free      shared  buffers     cached';
        const mem = flags['-h'] ? '927Mi       156Mi       542Mi       8.0Mi       228Mi       714Mi' : '949248      160000      554320        8192       35000      192384';
        const swap = flags['-h'] ? '99Mi          0B        99Mi' : '102396           0      102396';

        return `              ${header}
Mem:          ${mem}
Swap:         ${swap}`;
    }

    handleDf(args, flags) {
        if (flags['-h']) {
            return `Filesystem      Size  Used Avail Use% Mounted on
/dev/root        29G  4.2G   24G  15% /
devtmpfs        430M     0  430M   0% /dev
tmpfs           463M     0  463M   0% /dev/shm
/dev/mmcblk0p1  253M   49M  204M  20% /boot`;
        }
        return `Filesystem     1K-blocks    Used Available Use% Mounted on
/dev/root       30185472 4404224  25252992  15% /
devtmpfs          440320       0    440320   0% /dev`;
    }

    // ========================================
    // MALWARE DOWNLOAD HANDLERS (CRITICAL!)
    // ========================================

    handleWget(args, flags) {
        const url = args.find(arg => arg.startsWith('http://') || arg.startsWith('https://'));

        if (!url) {
            return 'wget: missing URL';
        }

        // Log the malware download attempt
        logger.warn(`Malware download attempt via wget: ${url}`, {
            session: this.sessionId,
            ip: this.ip,
            command: `wget ${args.join(' ')}`
        });

        // Simulate successful download
        const filename = url.split('/').pop() || 'index.html';
        return `--${new Date().toISOString().replace('T', ' ').split('.')[0]}--  ${url}
Resolving ${url.split('/')[2]}... ${this.generateRandomIP()}
Connecting to ${url.split('/')[2]}|${this.generateRandomIP()}|:80... connected.
HTTP request sent, awaiting response... 200 OK
Length: ${Math.floor(Math.random() * 100000)} (${Math.floor(Math.random() * 100)}K) [text/plain]
Saving to: '${filename}'

${filename}             100%[===================>]  ${Math.floor(Math.random() * 100)}K  --.-KB/s    in 0.001s

${new Date().toISOString().replace('T', ' ').split('.')[0]} (8.45 MB/s) - '${filename}' saved`;
    }

    handleCurl(args, flags) {
        const url = args.find(arg => arg.startsWith('http://') || arg.startsWith('https://'));

        if (!url) {
            return 'curl: no URL specified!';
        }

        // Log the malware download attempt
        logger.warn(`Malware download attempt via curl: ${url}`, {
            session: this.sessionId,
            ip: this.ip,
            command: `curl ${args.join(' ')}`
        });

        // Simulate output
        if (flags['-O'] || flags['--remote-name']) {
            const filename = url.split('/').pop() || 'downloaded_file';
            return `  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100 ${Math.floor(Math.random() * 100)}k  100 ${Math.floor(Math.random() * 100)}k    0     0   845k      0 --:--:-- --:--:-- --:--:--  845k`;
        }

        // Return fake content
        return '#!/bin/bash\n# Malware placeholder\necho "Downloaded content"';
    }

    // ========================================
    // OTHER COMMANDS
    // ========================================

    handleFind(args, flags) {
        return `find: '${args[0] || '/'}': Permission denied`;
    }

    handleGrep(args, flags) {
        return ''; // No matches
    }

    handleHistory(args, flags) {
        return '    1  uname -a\n    2  whoami\n    3  id\n    4  ls\n    5  history';
    }

    handleExit(args, flags) {
        return '__EXIT__'; // Signal to close connection
    }

    handleClear(args, flags) {
        return '\x1b[2J\x1b[H'; // ANSI clear screen
    }

    handleUnknown(cmd) {
        return `bash: ${cmd}: command not found`;
    }

    // ========================================
    // UTILITIES
    // ========================================

    generateRandomIP() {
        return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    }
}

module.exports = ShellEmulator;
