#!/usr/bin/env node

// Load environment variables FIRST
require('dotenv').config();

const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 Starting Twitter Telegram Bot...');

// Set NODE_ENV to production if not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Environment will be checked by src/index.js
console.log('📋 Loading environment variables...');

// Start the main application
const mainScript = path.join(__dirname, 'src', 'index.js');
const child = spawn('node', [mainScript], {
  stdio: 'inherit',
  env: process.env
});

child.on('close', (code) => {
  console.log(`Bot process exited with code ${code}`);
  process.exit(code);
});

child.on('error', (error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n📱 Shutting down bot gracefully...');
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n📱 Shutting down bot gracefully...');
  child.kill('SIGTERM');
}); 