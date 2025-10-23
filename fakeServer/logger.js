// Enhanced logging module for sshMON
// Supports JSON Lines, CSV, and session transcript formats

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// Load environment configuration
require('dotenv').config();

const LOG_PATH = process.env.LOG_PATH || './logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FILE_JSON = process.env.LOG_FILE_JSON || 'honeypot.jsonl';
const LOG_FILE_CSV = process.env.LOG_FILE_CSV || 'credentials.csv';
const LOG_DIR_SESSIONS = process.env.LOG_DIR_SESSIONS || 'sessions';

// Ensure log directories exist
const ensureDirectories = () => {
    [LOG_PATH, path.join(LOG_PATH, LOG_DIR_SESSIONS)].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
        }
    });
};

ensureDirectories();

// Winston logger for JSON Lines format
const jsonLogger = winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new DailyRotateFile({
            filename: path.join(LOG_PATH, LOG_FILE_JSON.replace('.jsonl', '-%DATE%.jsonl')),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
            format: winston.format.printf(info => JSON.stringify(info))
        }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// CSV logging class
class CSVLogger {
    constructor() {
        this.csvPath = path.join(LOG_PATH, LOG_FILE_CSV);
        this.header = "Date,Time,IP,Port,Event,Username,Password,Country,City,AbuseScore,Details";
        this.ensureHeader();
    }

    ensureHeader() {
        if (!fs.existsSync(this.csvPath)) {
            fs.writeFileSync(this.csvPath, this.header + '\n', { mode: 0o644 });
        }
    }

    log(data) {
        const row = [
            data.date || new Date().toISOString().split('T')[0],
            data.time || new Date().toISOString().split('T')[1].split('.')[0],
            data.ip || '-',
            data.port || '-',
            data.event || '-',
            this.escapeCsv(data.username || '-'),
            this.escapeCsv(data.password || '-'),
            data.country || '-',
            data.city || '-',
            data.abuseScore || '-',
            this.escapeCsv(data.details || '-')
        ].join(',');

        fs.appendFileSync(this.csvPath, row + '\n');
    }

    escapeCsv(field) {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            return '"' + field.replace(/"/g, '""') + '"';
        }
        return field;
    }
}

const csvLogger = new CSVLogger();

// Session transcript logger
class SessionLogger {
    constructor(sessionId, ip, port) {
        this.sessionId = sessionId;
        this.ip = ip;
        this.port = port;
        this.sessionFile = path.join(LOG_PATH, LOG_DIR_SESSIONS, `${sessionId}.log`);
        this.startTime = new Date();
        this.commandCount = 0;

        this.writeHeader();
    }

    writeHeader() {
        const header = [
            `=== Session ${this.sessionId} ===`,
            `Start: ${this.startTime.toISOString()}`,
            `IP: ${this.ip}:${this.port}`,
            `---`,
            ``
        ].join('\n');

        fs.writeFileSync(this.sessionFile, header, { mode: 0o644 });
    }

    log(event, data) {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        let line = '';

        switch (event) {
            case 'auth':
                line = `[${timestamp}] AUTH: ${data.username} / ${data.password} [${data.accepted ? 'ACCEPTED' : 'REJECTED'}]`;
                break;
            case 'command':
                this.commandCount++;
                line = `[${timestamp}] CMD: ${data.input}`;
                if (data.output) {
                    const outputLines = data.output.split('\n');
                    line += '\n' + outputLines.map(l => `           OUT: ${l}`).join('\n');
                }
                break;
            case 'disconnect':
                const duration = Math.floor((new Date() - this.startTime) / 1000);
                line = `[${timestamp}] DISCONNECT (duration: ${duration}s, commands: ${this.commandCount})`;
                break;
            default:
                line = `[${timestamp}] ${event.toUpperCase()}: ${JSON.stringify(data)}`;
        }

        fs.appendFileSync(this.sessionFile, line + '\n');
    }

    close() {
        this.log('disconnect', {});
    }
}

// Main logging interface
class HoneypotLogger {
    constructor() {
        this.sessions = new Map();
    }

    // Log connection event
    logConnection(ip, port, geo = {}) {
        const data = {
            event: 'connection',
            ip,
            port,
            geo: {
                country: geo.country || '-',
                city: geo.city || '-',
                asn: geo.asn || '-'
            }
        };

        jsonLogger.info(data);

        csvLogger.log({
            ip,
            port,
            event: 'connection',
            country: geo.country,
            city: geo.city,
            details: 'Socket connection initiated'
        });
    }

    // Log authentication attempt
    logAuth(sessionId, ip, port, username, password, accepted = true, threatIntel = {}) {
        const data = {
            event: 'auth',
            session: sessionId,
            ip,
            port,
            username,
            password,
            accepted,
            geo: threatIntel.geo || {},
            reputation: threatIntel.reputation || {}
        };

        jsonLogger.info(data);

        csvLogger.log({
            ip,
            port,
            event: 'password',
            username,
            password,
            country: threatIntel.geo?.country,
            city: threatIntel.geo?.city,
            abuseScore: threatIntel.reputation?.abuseConfidenceScore
        });

        if (this.sessions.has(sessionId)) {
            this.sessions.get(sessionId).log('auth', { username, password, accepted });
        }
    }

    // Log command execution
    logCommand(sessionId, ip, command, response) {
        const data = {
            event: 'command',
            session: sessionId,
            ip,
            input: command,
            output: response.substring(0, 500) // Truncate long responses in JSON
        };

        jsonLogger.info(data);

        csvLogger.log({
            ip,
            event: 'command',
            details: command
        });

        if (this.sessions.has(sessionId)) {
            this.sessions.get(sessionId).log('command', { input: command, output: response });
        }
    }

    // Log malware download attempt
    logDownload(sessionId, ip, url, savedPath) {
        const data = {
            event: 'download',
            session: sessionId,
            ip,
            url,
            savedPath
        };

        jsonLogger.warn(data);

        csvLogger.log({
            ip,
            event: 'malware_download',
            details: url
        });

        if (this.sessions.has(sessionId)) {
            this.sessions.get(sessionId).log('download', { url, savedPath });
        }
    }

    // Log session disconnect
    logDisconnect(sessionId, ip, port, duration) {
        const data = {
            event: 'disconnect',
            session: sessionId,
            ip,
            port,
            duration
        };

        jsonLogger.info(data);

        if (this.sessions.has(sessionId)) {
            this.sessions.get(sessionId).close();
            this.sessions.delete(sessionId);
        }
    }

    // Create session logger
    createSession(sessionId, ip, port) {
        const session = new SessionLogger(sessionId, ip, port);
        this.sessions.set(sessionId, session);
        return session;
    }

    // Generic logging
    log(level, message, meta = {}) {
        jsonLogger.log(level, message, meta);
    }

    info(message, meta = {}) {
        jsonLogger.info(message, meta);
    }

    warn(message, meta = {}) {
        jsonLogger.warn(message, meta);
    }

    error(message, meta = {}) {
        jsonLogger.error(message, meta);
    }
}

// Export singleton instance
module.exports = new HoneypotLogger();
