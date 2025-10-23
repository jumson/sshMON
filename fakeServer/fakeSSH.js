#!/usr/bin/env node
/**
 * sshMON - SSH Honeypot with Threat Intelligence
 * Modernized version integrating all new modules
 */

const fs = require('fs');
const path = require('path');
const ssh2 = require('ssh2');
const { v4: uuidv4 } = require('uuid');

// Load environment configuration
require('dotenv').config();

// Import our modules
const logger = require('./logger');
const threatIntel = require('./threatIntel');
const ShellEmulator = require('./shellEmulator');

// Configuration
const PORT = parseInt(process.env.PORT) || 2222;
const HOST = process.env.HOST || '0.0.0.0';
const KEY_PATH = process.env.KEY_PATH || path.join(__dirname, '..', 'keys', 'host.key');
const LOG_LOCALHOST = process.env.LOG_LOCALHOST === 'true';
const MAX_CONCURRENT_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 50;
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT) || 300; // seconds

// Active sessions tracking
const activeSessions = new Map();

// Check if SSH host key exists
if (!fs.existsSync(KEY_PATH)) {
    console.error(`ERROR: SSH host key not found at: ${KEY_PATH}`);
    console.error('Generate a key first with: npm run generate-key');
    console.error(`Or manually: ssh-keygen -t rsa -b 2048 -f "${KEY_PATH}" -N ""`);
    process.exit(1);
}

// Read SSH host key
let hostKey;
try {
    hostKey = fs.readFileSync(KEY_PATH);
    logger.info(`SSH host key loaded from: ${KEY_PATH}`);
} catch (err) {
    console.error(`ERROR: Cannot read SSH host key: ${err.message}`);
    process.exit(1);
}

// Create SSH server
const server = new ssh2.Server({
    hostKeys: [hostKey],
    banner: '', // No banner to avoid fingerprinting
    ident: 'SSH-2.0-OpenSSH_8.2p1 Ubuntu-4ubuntu0.3' // Mimic real SSH server
}, handleClient);

/**
 * Handle new SSH client connection
 */
function handleClient(client) {
    let sessionId = null;
    let sessionData = null;
    let clientAddress = null;
    let clientPort = null;
    let clientStart = Date.now();
    let authenticatedUsername = null;
    let shellEmulator = null;
    let threatIntelData = null;
    let sessionTimeout = null;

    try {
        // Extract client information
        const sock = client._sock;
        if (!sock || !sock._peername) {
            logger.warn('Client connected without socket information');
            client.end();
            return;
        }

        clientAddress = sock._peername.address;
        clientPort = sock._peername.port;

        // Skip localhost connections if configured
        if (!LOG_LOCALHOST && (clientAddress === '127.0.0.1' || clientAddress === '::1')) {
            logger.info(`Skipping localhost connection: ${clientAddress}`);
            client.end();
            return;
        }

        // Check concurrent session limit
        if (activeSessions.size >= MAX_CONCURRENT_SESSIONS) {
            logger.warn(`Max concurrent sessions reached (${MAX_CONCURRENT_SESSIONS}), rejecting ${clientAddress}`);
            client.end();
            return;
        }

        // Generate session ID
        sessionId = uuidv4();

        logger.info(`New connection: ${clientAddress}:${clientPort}`, {
            session: sessionId,
            ip: clientAddress,
            port: clientPort
        });

        // Enrich IP with threat intelligence (async, non-blocking)
        threatIntel.enrichIP(clientAddress).then(intel => {
            threatIntelData = intel;
            logger.logConnection(clientAddress, clientPort, intel.geo || {});
        }).catch(err => {
            logger.error(`Threat intel enrichment failed for ${clientAddress}: ${err.message}`);
            threatIntelData = { ip: clientAddress, enriched: false, error: err.message };
        });

        // Create session data
        sessionData = {
            id: sessionId,
            ip: clientAddress,
            port: clientPort,
            startTime: clientStart,
            commandCount: 0,
            authenticated: false
        };

        activeSessions.set(sessionId, sessionData);

        // Set session timeout
        const resetTimeout = () => {
            if (sessionTimeout) clearTimeout(sessionTimeout);
            sessionTimeout = setTimeout(() => {
                logger.info(`Session timeout for ${clientAddress}`, { session: sessionId });
                client.end();
            }, SESSION_TIMEOUT * 1000);
        };

        resetTimeout();

        // Handle authentication
        client.on('authentication', (ctx) => {
            const method = ctx.method;
            const username = ctx.username;
            const password = ctx.password || '';

            logger.info(`Auth attempt: ${method} - ${username}`, {
                session: sessionId,
                ip: clientAddress,
                method,
                username,
                password: password.substring(0, 100) // Limit password length in logs
            });

            // Always accept authentication
            authenticatedUsername = username;
            sessionData.authenticated = true;
            sessionData.username = username;

            // Log authentication with threat intel
            logger.logAuth(sessionId, clientAddress, clientPort, username, password, true, threatIntelData);

            // Accept the authentication
            ctx.accept();
        });

        // Handle successful authentication
        client.on('ready', () => {
            logger.info(`Client authenticated: ${clientAddress}`, {
                session: sessionId,
                username: authenticatedUsername
            });

            // Create session logger
            logger.createSession(sessionId, clientAddress, clientPort);

            // Initialize shell emulator
            shellEmulator = new ShellEmulator(sessionId, clientAddress, authenticatedUsername);

            // Handle session requests
            client.on('session', (accept, reject) => {
                const session = accept();

                // Handle PTY requests
                session.on('pty', (accept, reject, info) => {
                    logger.info(`PTY requested: ${info.term}`, {
                        session: sessionId,
                        term: info.term,
                        cols: info.cols,
                        rows: info.rows
                    });
                    accept();
                });

                // Handle window resize
                session.on('window-change', (accept, reject, info) => {
                    logger.info(`Window resize: ${info.cols}x${info.rows}`, {
                        session: sessionId,
                        cols: info.cols,
                        rows: info.rows
                    });
                });

                // Handle shell requests (interactive shell)
                session.on('shell', (accept, reject) => {
                    const stream = accept();

                    logger.info('Shell session started', { session: sessionId });

                    // Send initial prompt
                    const initialPrompt = shellEmulator.getPrompt();
                    stream.write(initialPrompt);

                    let commandBuffer = '';

                    // Handle data from client
                    stream.on('data', async (data) => {
                        resetTimeout(); // Reset timeout on activity

                        const char = data.toString();
                        const charCode = data[0];

                        // Handle Ctrl+C (0x03)
                        if (charCode === 3) {
                            logger.info('Client sent Ctrl+C', { session: sessionId });
                            stream.write('^C\n');
                            stream.write(shellEmulator.getPrompt());
                            commandBuffer = '';
                            return;
                        }

                        // Handle Ctrl+D (0x04) - EOF
                        if (charCode === 4) {
                            logger.info('Client sent Ctrl+D (logout)', { session: sessionId });
                            stream.write('logout\n');
                            stream.exit(0);
                            stream.end();
                            return;
                        }

                        // Handle Enter (CR 0x0D or LF 0x0A)
                        if (charCode === 13 || charCode === 10) {
                            if (commandBuffer.trim().length === 0) {
                                stream.write('\r\n' + shellEmulator.getPrompt());
                                return;
                            }

                            stream.write('\r\n');

                            // Execute command
                            try {
                                sessionData.commandCount++;
                                const response = await shellEmulator.execute(commandBuffer.trim());

                                // Check for exit command
                                if (response === '__EXIT__') {
                                    stream.write('logout\n');
                                    stream.exit(0);
                                    stream.end();
                                    return;
                                }

                                // Log command and response
                                logger.logCommand(sessionId, clientAddress, commandBuffer.trim(), response);

                                // Send response
                                if (response) {
                                    stream.write(response + '\r\n');
                                }

                                // Send new prompt
                                stream.write(shellEmulator.getPrompt());
                            } catch (err) {
                                logger.error(`Command execution error: ${err.message}`, {
                                    session: sessionId,
                                    command: commandBuffer
                                });
                                stream.write(`Error: ${err.message}\r\n`);
                                stream.write(shellEmulator.getPrompt());
                            }

                            commandBuffer = '';
                            return;
                        }

                        // Handle Backspace (0x7F or 0x08)
                        if (charCode === 127 || charCode === 8) {
                            if (commandBuffer.length > 0) {
                                commandBuffer = commandBuffer.slice(0, -1);
                                stream.write('\b \b'); // Erase character
                            }
                            return;
                        }

                        // Handle Tab (0x09) - simple completion (just echo)
                        if (charCode === 9) {
                            stream.write('  '); // Just add spaces for now
                            return;
                        }

                        // Regular character - add to buffer and echo
                        if (charCode >= 32 && charCode <= 126) {
                            commandBuffer += char;
                            stream.write(char);
                        }
                    });

                    // Handle stream close
                    stream.on('close', () => {
                        logger.info('Shell stream closed', { session: sessionId });
                    });

                    stream.on('error', (err) => {
                        logger.error(`Stream error: ${err.message}`, { session: sessionId });
                    });
                });

                // Handle exec requests (single command execution)
                session.on('exec', async (accept, reject, info) => {
                    const command = info.command;
                    logger.info(`Exec request: ${command}`, {
                        session: sessionId,
                        command
                    });

                    const stream = accept();

                    try {
                        if (!shellEmulator) {
                            shellEmulator = new ShellEmulator(sessionId, clientAddress, authenticatedUsername);
                        }

                        const response = await shellEmulator.execute(command);
                        logger.logCommand(sessionId, clientAddress, command, response);

                        if (response && response !== '__EXIT__') {
                            stream.write(response + '\n');
                        }

                        stream.exit(0);
                        stream.end();
                    } catch (err) {
                        logger.error(`Exec error: ${err.message}`, {
                            session: sessionId,
                            command
                        });
                        stream.stderr.write(`Error: ${err.message}\n`);
                        stream.exit(1);
                        stream.end();
                    }
                });
            });
        });

        // Handle client errors
        client.on('error', (err) => {
            logger.error(`Client error: ${err.message}`, {
                session: sessionId,
                ip: clientAddress,
                error: err.message
            });
        });

        // Handle client disconnect
        client.on('end', () => {
            if (sessionTimeout) clearTimeout(sessionTimeout);

            const duration = Math.floor((Date.now() - clientStart) / 1000);

            logger.info(`Client disconnected: ${clientAddress}`, {
                session: sessionId,
                duration,
                commandCount: sessionData.commandCount
            });

            logger.logDisconnect(sessionId, clientAddress, clientPort, duration);

            // Remove from active sessions
            activeSessions.delete(sessionId);
        });

    } catch (err) {
        logger.error(`Error handling client: ${err.message}`, {
            session: sessionId,
            ip: clientAddress,
            error: err.stack
        });

        // Clean up
        if (sessionId) {
            activeSessions.delete(sessionId);
        }
        if (sessionTimeout) {
            clearTimeout(sessionTimeout);
        }
        client.end();
    }
}

// Start server
server.listen(PORT, HOST, function() {
    const address = this.address();
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║              🍯  sshMON Honeypot Active  🍯               ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  Listening on:    ${address.address}:${address.port}`);
    console.log(`  Session timeout: ${SESSION_TIMEOUT}s`);
    console.log(`  Max sessions:    ${MAX_CONCURRENT_SESSIONS}`);
    console.log(`  Threat Intel:    ${process.env.ENABLE_THREAT_INTEL === 'true' ? 'Enabled' : 'Disabled'}`);
    console.log(`  Log localhost:   ${LOG_LOCALHOST ? 'Yes' : 'No'}`);
    console.log('');
    console.log('  Press Ctrl+C to stop');
    console.log('');

    logger.info('sshMON honeypot started', {
        port: address.port,
        host: address.address,
        version: '2.0.0'
    });
});

// Handle server errors
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`ERROR: Port ${PORT} is already in use`);
        console.error('Try a different port with: PORT=2222 node fakeServer/fakeSSH.js');
    } else if (err.code === 'EACCES') {
        console.error(`ERROR: Permission denied to bind to port ${PORT}`);
        console.error('Ports below 1024 require root privileges or CAP_NET_BIND_SERVICE');
        console.error('Try: PORT=2222 node fakeServer/fakeSSH.js');
    } else {
        console.error(`Server error: ${err.message}`);
    }
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
    console.log('\n\nShutting down honeypot...');
    logger.info('Honeypot shutting down');

    // Close all active sessions
    for (const [sessionId, session] of activeSessions) {
        logger.info(`Closing active session: ${sessionId}`, {
            ip: session.ip,
            duration: Math.floor((Date.now() - session.startTime) / 1000)
        });
    }

    server.close(() => {
        console.log('Server closed');
        logger.info('Honeypot stopped');
        process.exit(0);
    });

    // Force exit after 5 seconds if graceful shutdown fails
    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 5000);
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', {
        error: err.message,
        stack: err.stack
    });
    console.error('Uncaught exception:', err);
    shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection:', {
        reason: reason,
        promise: promise
    });
    console.error('Unhandled rejection:', reason);
});
