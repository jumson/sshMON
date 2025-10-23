#!/usr/bin/env node
// Generate SSH host key for honeypot

const { execSync } = require('child_process');
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

console.log('Generating SSH host key...');

try {
    // Generate RSA key using ssh-keygen
    execSync(`ssh-keygen -t rsa -b 2048 -f "${KEY_FILE}" -N "" -C "sshMON-honeypot"`, {
        stdio: 'inherit'
    });

    // Set proper permissions
    fs.chmodSync(KEY_FILE, 0o600);

    console.log('SSH host key generated successfully!');
    console.log('Location:', KEY_FILE);
} catch (err) {
    console.error('Error generating SSH key:', err.message);
    console.log('\nAlternative: You can generate the key manually with:');
    console.log(`  ssh-keygen -t rsa -b 2048 -f "${KEY_FILE}" -N ""`);
    process.exit(1);
}
