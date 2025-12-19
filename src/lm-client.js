const http = require('http');
const { URL } = require('url');

class LMClient {
  constructor(config) {
    this.baseURL = config.baseURL || 'http://localhost:1234/v1';
    this.modelName = config.modelName || 'qwen/qwen3-4b-2507';
  }

  async sendChat(prompt) {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(`${this.baseURL}/chat/completions`);
        
        const requestBody = JSON.stringify({
          model: this.modelName,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          stream: false
        });

        const options = {
          hostname: url.hostname,
          port: url.port || 1234,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody)
          },
          timeout: 30000
        };

        console.log('Making request to:', `${url.protocol}//${url.hostname}:${url.port}${url.pathname}`);
        console.log('Request body:', requestBody.substring(0, 100) + '...');

        const req = http.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode !== 200) {
                console.error('HTTP Error:', res.statusCode, data);
                reject(new Error(`LM Studio API error: ${res.statusCode} - ${res.statusMessage}\nResponse: ${data.substring(0, 200)}`));
                return;
              }

              const response = JSON.parse(data);
              console.log('Response received, choices:', response.choices?.length || 0);

              if (response && response.choices && response.choices.length > 0) {
                const content = response.choices[0].message.content;
                resolve(content);
              } else {
                console.error('Invalid response structure:', JSON.stringify(response, null, 2));
                reject(new Error('Invalid response from LM Studio - no choices found'));
              }
            } catch (parseError) {
              console.error('Parse error:', parseError);
              console.error('Response data:', data);
              reject(new Error(`Failed to parse response: ${parseError.message}`));
            }
          });
        });

        req.on('error', (error) => {
          console.error('Request error:', error);
          if (error.code === 'ECONNREFUSED') {
            reject(new Error(`Could not connect to LM Studio at ${this.baseURL}. Make sure it's running and the server is started.`));
          } else if (error.code === 'ETIMEDOUT') {
            reject(new Error(`Request to LM Studio timed out. The server might be slow or not responding.`));
          } else {
            reject(new Error(`Network error: ${error.message} (${error.code})`));
          }
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request to LM Studio timed out after 30 seconds'));
        });

        req.write(requestBody);
        req.end();

      } catch (error) {
        console.error('Setup error:', error);
        reject(new Error(`Failed to create request: ${error.message}`));
      }
    });
  }
}

module.exports = { LMClient };

