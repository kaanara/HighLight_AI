const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CONFIG_FILENAME = 'config.json';

// Default configuration
const DEFAULT_CONFIG = {
  baseURL: 'http://localhost:1234/v1',
  modelName: 'qwen/qwen3-4b-2507'
};

/**
 * Get the path to the config file
 */
function getConfigPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, CONFIG_FILENAME);
}

/**
 * Load configuration from file, or return defaults if file doesn't exist
 */
function loadConfig() {
  try {
    const configPath = getConfigPath();
    
    // Ensure userData directory exists
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    // If config file doesn't exist, create it with defaults
    if (!fs.existsSync(configPath)) {
      saveConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
    
    // Read and parse config file
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    // Merge with defaults to ensure all required fields exist
    return {
      ...DEFAULT_CONFIG,
      ...config
    };
  } catch (error) {
    console.error('Error loading config:', error);
    // Return defaults on error
    return DEFAULT_CONFIG;
  }
}

/**
 * Save configuration to file
 */
function saveConfig(config) {
  try {
    const configPath = getConfigPath();
    const userDataPath = app.getPath('userData');
    
    // Ensure userData directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    // Validate config
    const validatedConfig = {
      baseURL: config.baseURL || DEFAULT_CONFIG.baseURL,
      modelName: config.modelName || DEFAULT_CONFIG.modelName
    };
    
    // Write config file
    fs.writeFileSync(configPath, JSON.stringify(validatedConfig, null, 2), 'utf8');
    console.log('Config saved to:', configPath);
    
    return validatedConfig;
  } catch (error) {
    console.error('Error saving config:', error);
    throw error;
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  getConfigPath
};

