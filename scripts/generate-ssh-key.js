#!/usr/bin/env node
// Generate SSH host key for honeypot using Node.js crypto

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEY_DIR = path.join(__dirname, '..', 'keys');
const KEY_FILE = path.join(KEY_DIR, 'host.key');

// Ensure keys directory exists
if (!fs.existsSync(KEY_DIR)) {
    fs.mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
    console.log(`Created directory: ${KEY_DIR}`);
}

// Check if key already exists
if (fs.existsSync(KEY_FILE)) {
    console.log('SSH host key already exists at:', KEY_FILE);
    console.log('Delete it first if you want to generate a new one.');
    process.exit(0);
}

console.log('Generating SSH host key using Node.js crypto...');

try {
    // Generate RSA key pair
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs1',
            format: 'pem'
        }
    });

    // Write private key
    fs.writeFileSync(KEY_FILE, privateKey, { mode: 0o600 });
    console.log('✓ Private key generated:', KEY_FILE);

    // Write public key
    const pubKeyFile = KEY_FILE + '.pub';
    fs.writeFileSync(pubKeyFile, publicKey, { mode: 0o644 });
    console.log('✓ Public key generated:', pubKeyFile);

    console.log('\nSSH host key generated successfully!');
    console.log('You can now start the honeypot with: npm start');
} catch (err) {
    console.error('Error generating SSH key:', err.message);
    process.exit(1);
}
