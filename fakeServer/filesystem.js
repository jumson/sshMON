// Fake Filesystem Module
// Provides virtual directory structure and file contents for shell emulation

require('dotenv').config();

const EMULATION_PROFILE = process.env.EMULATION_PROFILE || 'raspberry-pi';
const FILESYSTEM_DYNAMIC = process.env.FILESYSTEM_DYNAMIC === 'true';

// Generate dynamic content based on profile
const profiles = {
    'raspberry-pi': {
        hostname: 'raspberrypi',
        architecture: 'armv7l',
        osRelease: 'Raspbian GNU/Linux 11 (bullseye)',
        kernel: '5.10.63-v7l+ #1459 SMP Wed Oct 6 16:41:57 BST 2021',
        hardware: 'BCM2835',
        model: 'Raspberry Pi 3 Model B Rev 1.2'
    },
    'ubuntu-server': {
        hostname: 'ubuntu-server',
        architecture: 'x86_64',
        osRelease: 'Ubuntu 20.04.3 LTS',
        kernel: '5.4.0-84-generic #94-Ubuntu SMP Thu Aug 26 20:27:37 UTC 2021',
        hardware: 'Generic',
        model: 'Standard PC'
    },
    'generic-iot': {
        hostname: 'camera01',
        architecture: 'mips',
        osRelease: 'OpenWrt 19.07.7',
        kernel: '4.9.140',
        hardware: 'MediaTek MT7621',
        model: 'Generic IoT Device'
    }
};

const profile = profiles[EMULATION_PROFILE] || profiles['raspberry-pi'];

// Filesystem structure
class FakeFilesystem {
    constructor() {
        this.currentDir = '/root';
        this.structure = this.buildStructure();
    }

    buildStructure() {
        return {
            '/': {
                type: 'dir',
                entries: ['bin', 'boot', 'dev', 'etc', 'home', 'lib', 'media', 'mnt', 'opt', 'proc', 'root', 'run', 'sbin', 'srv', 'sys', 'tmp', 'usr', 'var']
            },
            '/root': {
                type: 'dir',
                entries: ['.bashrc', '.profile', '.ssh']
            },
            '/root/.ssh': {
                type: 'dir',
                entries: ['authorized_keys']
            },
            '/root/.ssh/authorized_keys': {
                type: 'file',
                content: '# Authorized SSH keys\n',
                size: 23
            },
            '/root/.bashrc': {
                type: 'file',
                content: this.generateBashrc(),
                size: 3200
            },
            '/root/.profile': {
                type: 'file',
                content: '# ~/.profile: executed by the command interpreter for login shells.\n',
                size: 807
            },
            '/etc': {
                type: 'dir',
                entries: ['passwd', 'shadow', 'group', 'hosts', 'hostname', 'os-release', 'ssh', 'network', 'resolv.conf', 'issue']
            },
            '/etc/passwd': {
                type: 'file',
                content: this.generatePasswd(),
                size: 1847
            },
            '/etc/shadow': {
                type: 'file',
                content: this.generateShadow(),
                size: 1245
            },
            '/etc/group': {
                type: 'file',
                content: this.generateGroup(),
                size: 923
            },
            '/etc/hosts': {
                type: 'file',
                content: this.generateHosts(),
                size: 220
            },
            '/etc/hostname': {
                type: 'file',
                content: `${profile.hostname}\n`,
                size: profile.hostname.length + 1
            },
            '/etc/os-release': {
                type: 'file',
                content: this.generateOsRelease(),
                size: 450
            },
            '/etc/issue': {
                type: 'file',
                content: `${profile.osRelease} \\n \\l\n\n`,
                size: 50
            },
            '/etc/resolv.conf': {
                type: 'file',
                content: 'nameserver 192.168.1.1\nnameserver 8.8.8.8\n',
                size: 47
            },
            '/home': {
                type: 'dir',
                entries: ['pi']
            },
            '/home/pi': {
                type: 'dir',
                entries: ['.bashrc', '.profile', 'Documents', 'Downloads']
            },
            '/tmp': {
                type: 'dir',
                entries: []
            },
            '/var': {
                type: 'dir',
                entries: ['log', 'www', 'tmp']
            },
            '/var/log': {
                type: 'dir',
                entries: ['syslog', 'auth.log', 'messages']
            },
            '/proc': {
                type: 'dir',
                entries: ['cpuinfo', 'meminfo', 'version']
            },
            '/proc/cpuinfo': {
                type: 'file',
                content: this.generateCPUInfo(),
                size: 2048
            },
            '/proc/meminfo': {
                type: 'file',
                content: this.generateMemInfo(),
                size: 1400
            },
            '/proc/version': {
                type: 'file',
                content: `Linux version ${profile.kernel} (gcc version 10.2.1) ${new Date().toUTCString()}\n`,
                size: 200
            }
        };
    }

    // Get entry at path
    get(path) {
        const normalized = this.normalizePath(path);
        return this.structure[normalized] || null;
    }

    // List directory
    ls(path) {
        const entry = this.get(path);
        if (!entry || entry.type !== 'dir') return null;
        return entry.entries || [];
    }

    // Read file
    cat(path) {
        const entry = this.get(path);
        if (!entry || entry.type !== 'file') return null;

        if (typeof entry.content === 'function') {
            return entry.content();
        }
        return entry.content;
    }

    // Check if path exists
    exists(path) {
        return this.get(path) !== null;
    }

    // Change directory
    cd(targetPath) {
        const normalized = this.normalizePath(targetPath);
        const entry = this.get(normalized);

        if (!entry) return { success: false, error: `cd: ${targetPath}: No such file or directory` };
        if (entry.type !== 'dir') return { success: false, error: `cd: ${targetPath}: Not a directory` };

        this.currentDir = normalized;
        return { success: true, dir: normalized };
    }

    // Get current directory
    pwd() {
        return this.currentDir;
    }

    // Normalize path (handle relative paths)
    normalizePath(path) {
        if (!path || path === '') return this.currentDir;
        if (path === '~') return '/root';
        if (path.startsWith('~/')) return '/root' + path.substring(1);
        if (!path.startsWith('/')) {
            // Relative path
            path = this.currentDir + '/' + path;
        }

        // Handle . and ..
        const parts = path.split('/').filter(p => p && p !== '.');
        const resolved = [];

        for (const part of parts) {
            if (part === '..') {
                resolved.pop();
            } else {
                resolved.push(part);
            }
        }

        return '/' + resolved.join('/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    }

    // Dynamic content generators
    generatePasswd() {
        return `root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
sync:x:4:65534:sync:/bin:/bin/sync
games:x:5:60:games:/usr/games:/usr/sbin/nologin
man:x:6:12:man:/var/cache/man:/usr/sbin/nologin
lp:x:7:7:lp:/var/spool/lpd:/usr/sbin/nologin
mail:x:8:8:mail:/var/mail:/usr/sbin/nologin
news:x:9:9:news:/var/spool/news:/usr/sbin/nologin
pi:x:1000:1000:,,,:/home/pi:/bin/bash
sshd:x:109:65534::/run/sshd:/usr/sbin/nologin
`;
    }

    generateShadow() {
        // Fake hashes that won't crack to anything
        return `root:$6$xyz123abc$fakehashfakehashfakehashfakehashfakehashfakehashfakehashfakehash:18921:0:99999:7:::
daemon:*:18921:0:99999:7:::
bin:*:18921:0:99999:7:::
sys:*:18921:0:99999:7:::
pi:$6$abc789xyz$anotherfakehashfakehashfakehashfakehashfakehashfakehashfakehash:18921:0:99999:7:::
sshd:*:18921:0:99999:7:::
`;
    }

    generateGroup() {
        return `root:x:0:
daemon:x:1:
bin:x:2:
sys:x:3:
adm:x:4:
tty:x:5:
disk:x:6:
lp:x:7:
mail:x:8:
news:x:9:
sudo:x:27:pi
pi:x:1000:
`;
    }

    generateHosts() {
        return `127.0.0.1       localhost
::1             localhost ip6-localhost ip6-loopback
ff02::1         ip6-allnodes
ff02::2         ip6-allrouters

127.0.1.1       ${profile.hostname}
`;
    }

    generateOsRelease() {
        if (EMULATION_PROFILE === 'raspberry-pi') {
            return `PRETTY_NAME="Raspbian GNU/Linux 11 (bullseye)"
NAME="Raspbian GNU/Linux"
VERSION_ID="11"
VERSION="11 (bullseye)"
VERSION_CODENAME=bullseye
ID=raspbian
ID_LIKE=debian
HOME_URL="http://www.raspbian.org/"
SUPPORT_URL="http://www.raspbian.org/RaspbianForums"
BUG_REPORT_URL="http://www.raspbian.org/RaspbianBugs"
`;
        } else if (EMULATION_PROFILE === 'ubuntu-server') {
            return `NAME="Ubuntu"
VERSION="20.04.3 LTS (Focal Fossa)"
ID=ubuntu
ID_LIKE=debian
PRETTY_NAME="Ubuntu 20.04.3 LTS"
VERSION_ID="20.04"
HOME_URL="https://www.ubuntu.com/"
SUPPORT_URL="https://help.ubuntu.com/"
BUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/"
`;
        } else {
            return `NAME="OpenWrt"
VERSION="19.07.7"
ID="openwrt"
PRETTY_NAME="OpenWrt 19.07.7"
`;
        }
    }

    generateCPUInfo() {
        if (EMULATION_PROFILE === 'raspberry-pi') {
            return `processor       : 0
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
`;
        } else {
            return `processor       : 0
vendor_id       : GenuineIntel
cpu family      : 6
model           : 142
model name      : Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz
stepping        : 10
microcode       : 0xb4
cpu MHz         : 1800.000
cache size      : 6144 KB
physical id     : 0
siblings        : 4
core id         : 0
cpu cores       : 2
`;
        }
    }

    generateMemInfo() {
        return `MemTotal:         949248 kB
MemFree:          554320 kB
MemAvailable:     731168 kB
Buffers:           35808 kB
Cached:           192384 kB
SwapCached:            0 kB
Active:           213056 kB
Inactive:         114688 kB
SwapTotal:        102396 kB
SwapFree:         102396 kB
`;
    }

    generateBashrc() {
        return `# ~/.bashrc: executed by bash(1) for non-login shells.

# If not running interactively, don't do anything
case $- in
    *i*) ;;
      *) return;;
esac

# History settings
HISTCONTROL=ignoreboth
HISTSIZE=1000
HISTFILESIZE=2000

# Prompt
PS1='` + '${debian_chroot:+($debian_chroot)}\\u@' + profile.hostname + `:\\w\\$ '

# Aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
`;
    }
}

module.exports = FakeFilesystem;
