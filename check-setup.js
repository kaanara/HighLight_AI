#!/usr/bin/env node

/**
 * Setup verification script
 * Checks if LM Studio is running and configured correctly
 */

const http = require('http');
const { URL } = require('url');

const LM_CONFIG = {
  baseURL: 'http://localhost:1234/v1',
  modelName: 'qwen/qwen3-4b-2507'
};

console.log('🔍 Checking Highlight AI Setup...\n');

// Check 1: LM Studio server is running
console.log('1. Checking if LM Studio server is running...');
const url = new URL(`${LM_CONFIG.baseURL}/chat/completions`);

const testRequest = {
  hostname: url.hostname,
  port: url.port || 1234,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': 0
  },
  timeout: 5000
};

const req = http.request(testRequest, (res) => {
  console.log('   ✅ LM Studio server is running!\n');
  
  // Check 2: Test with actual request
  console.log('2. Testing API with model:', LM_CONFIG.modelName);
  
  const testBody = JSON.stringify({
    model: LM_CONFIG.modelName,
    messages: [{ role: 'user', content: 'Hello' }]
  });
  
  const testOptions = {
    hostname: url.hostname,
    port: url.port || 1234,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(testBody)
    },
    timeout: 30000
  };
  
  const testReq = http.request(testOptions, (testRes) => {
    let data = '';
    testRes.on('data', (chunk) => { data += chunk; });
    testRes.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.choices && response.choices.length > 0) {
          console.log('   ✅ Model is working! Got response:', response.choices[0].message.content.substring(0, 50) + '...\n');
          console.log('✅ All checks passed! You can run the app with: npm start\n');
        } else {
          console.log('   ⚠️  Got response but no choices. Check model name in main.js\n');
        }
      } catch (e) {
        console.log('   ❌ Failed to parse response:', e.message);
        console.log('   Response:', data.substring(0, 200));
      }
    });
  });
  
  testReq.on('error', (error) => {
    if (error.code === 'ECONNREFUSED') {
      console.log('   ❌ Could not connect. Make sure LM Studio server is started!');
    } else {
      console.log('   ❌ Error:', error.message);
    }
  });
  
  testReq.write(testBody);
  testReq.end();
});

req.on('error', (error) => {
  if (error.code === 'ECONNREFUSED') {
    console.log('   ❌ LM Studio server is NOT running!');
    console.log('\n   Please:');
    console.log('   1. Open LM Studio');
    console.log('   2. Load a model (e.g., qwen/qwen3-4b-2507)');
    console.log('   3. Go to Local Server tab');
    console.log('   4. Click "Start Server"');
    console.log('   5. Run this check again: node check-setup.js\n');
  } else if (error.code === 'ETIMEDOUT') {
    console.log('   ❌ Connection timed out. Is LM Studio running?');
  } else {
    console.log('   ❌ Error:', error.message);
  }
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  console.log('   ❌ Connection timed out');
  process.exit(1);
});

req.end();

