const { app, BrowserWindow, globalShortcut, Menu, Tray, ipcMain, nativeImage } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const { getSelectedText } = require('./src/selection');
const { LMClient } = require('./src/lm-client');
const { loadConfig, saveConfig } = require('./src/config-manager');

const execAsync = promisify(exec);

let mainWindow = null;
let contextMenuWindow = null;
let settingsWindow = null;
let tray = null;
let lmClient = null;
let currentConfig = null;

function createMainWindow() {
  // Main window is hidden - we use it for background processing
  mainWindow = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    frame: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
}

function createContextMenuWindow(selectedText, mousePos) {
  // Properly close and cleanup existing context menu if open
  if (contextMenuWindow && !contextMenuWindow.isDestroyed()) {
    contextMenuWindow.removeAllListeners();
    contextMenuWindow.close();
    contextMenuWindow = null;
  }

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Position near mouse cursor, but ensure it stays on screen
  const menuWidth = 400;
  const menuHeight = 700;
  let x = mousePos.x;
  let y = mousePos.y - menuHeight - 10; // Show above cursor

  // Adjust if menu would go off screen
  if (x + menuWidth > width) {
    x = width - menuWidth - 10;
  }
  if (y < 0) {
    y = mousePos.y + 20; // Show below cursor instead
  }
  if (x < 0) x = 10;
  if (y + menuHeight > height) {
    y = height - menuHeight - 10;
  }

  contextMenuWindow = new BrowserWindow({
    width: menuWidth,
    height: menuHeight,
    x: Math.round(x),
    y: Math.round(y),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  contextMenuWindow.loadFile('context-menu.html');
  
  // Send selected text to the window
  contextMenuWindow.webContents.once('did-finish-load', () => {
    if (contextMenuWindow && !contextMenuWindow.isDestroyed()) {
      contextMenuWindow.webContents.send('selected-text', selectedText);
    }
  });

  // Properly cleanup on close
  contextMenuWindow.on('closed', () => {
    contextMenuWindow = null;
  });

  // Close when clicking outside (but with a delay to allow clicking inside)
  contextMenuWindow.on('blur', () => {
    setTimeout(() => {
      if (contextMenuWindow && !contextMenuWindow.isDestroyed() && !contextMenuWindow.isFocused()) {
        contextMenuWindow.close();
      }
    }, 150);
  });
}

function createSettingsWindow() {
  // Close existing settings window if open
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 650,
    height: 600,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsWindow.loadFile('settings.html');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Context Menu (Cmd+Shift+A)',
      click: () => {
        showContextMenu();
      }
    },
    {
      label: 'Settings',
      click: () => {
        createSettingsWindow();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Highlight AI - Select text and press Cmd+Shift+A');
  tray.setContextMenu(contextMenu);
}

async function showContextMenu() {
  try {
    // Close any existing menu first
    if (contextMenuWindow && !contextMenuWindow.isDestroyed()) {
      contextMenuWindow.close();
      contextMenuWindow = null;
    }

    // Small delay to ensure previous window is closed
    await new Promise(resolve => setTimeout(resolve, 50));

    // Get current mouse position
    const { screen } = require('electron');
    const point = screen.getCursorScreenPoint();
    
    console.log('Getting selected text...');
    // Get selected text
    const selectedText = await getSelectedText();
    console.log('Selected text received:', selectedText ? `${selectedText.substring(0, 50)}...` : 'empty');
    
    if (!selectedText || selectedText.trim().length === 0) {
      // Show a small notification that no text is selected
      console.log('No text selected - make sure you have text selected before pressing Cmd+Shift+A');
      
      // Optionally show a brief notification window
      const notificationWindow = new BrowserWindow({
        width: 300,
        height: 100,
        x: point.x - 150,
        y: point.y - 50,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });
      
      notificationWindow.loadURL(`data:text/html;charset=utf-8,
        <html>
          <body style="margin:0;padding:20px;background:rgba(255,200,200,0.9);border-radius:8px;font-family:system-ui;text-align:center;">
            <p style="color:#d00;font-weight:bold;">No text selected</p>
            <p style="color:#666;font-size:12px;">Select text first, then press Cmd+Shift+A</p>
          </body>
        </html>
      `);
      
      setTimeout(() => {
        if (notificationWindow && !notificationWindow.isDestroyed()) {
          notificationWindow.close();
        }
      }, 2000);
      
      return;
    }

    createContextMenuWindow(selectedText, point);
  } catch (error) {
    console.error('Error showing context menu:', error);
  }
}

// Initialize LM Client with config
function initializeLMClient() {
  currentConfig = loadConfig();
  lmClient = new LMClient(currentConfig);
  console.log('LM Client initialized with config:', currentConfig);
}

// LM Studio CLI functions
async function installLMStudioCLI() {
  try {
    // Check if Python/pip is available
    try {
      await execAsync('python3 --version');
    } catch (e) {
      throw new Error('Python 3 is not installed. Please install Python 3 first.');
    }

    // Install lmstudio package
    const { stdout, stderr } = await execAsync('pip3 install lmstudio');
    console.log('LM Studio CLI installation output:', stdout);
    if (stderr) {
      console.log('LM Studio CLI installation stderr:', stderr);
    }
    
    // Pip outputs success messages to stdout, not stderr
    // Check stdout for success indicators
    const output = stdout || '';
    const errorOutput = stderr || '';
    
    // Check if installation was successful
    if (output.includes('Successfully installed') || output.includes('Requirement already satisfied')) {
      return { success: true, message: 'LM Studio CLI installed successfully' };
    }
    
    // Check if it's already installed (also in stdout)
    if (output.includes('already satisfied')) {
      return { success: true, message: 'LM Studio CLI is already installed' };
    }
    
    // If we have stderr with actual errors (not just warnings), treat as failure
    // Pip often outputs warnings to stderr even on success, so we check for actual error patterns
    if (errorOutput && (errorOutput.toLowerCase().includes('error:') || 
        errorOutput.toLowerCase().includes('failed') ||
        errorOutput.toLowerCase().includes('cannot'))) {
      throw new Error(errorOutput);
    }
    
    // If we got here and there's no clear success, but also no clear error, assume success
    // (pip might have installed silently or output format changed)
    return { success: true, message: 'LM Studio CLI installation completed' };
  } catch (error) {
    console.error('Error installing LM Studio CLI:', error);
    return { success: false, error: error.message };
  }
}

async function downloadModel(modelName) {
  try {
    // Validate model name to prevent command injection
    // Model names should only contain: alphanumeric, slashes, hyphens, underscores, dots
    // Pattern: org/model-name or model-name (e.g., "qwen/qwen3-4b-2507")
    const modelNamePattern = /^[a-zA-Z0-9._/-]+$/;
    if (!modelName || !modelNamePattern.test(modelName)) {
      return {
        success: false,
        error: 'Invalid model name format. Model names can only contain letters, numbers, slashes, hyphens, underscores, and dots.'
      };
    }

    // Additional length check to prevent extremely long inputs
    if (modelName.length > 200) {
      return {
        success: false,
        error: 'Model name is too long. Maximum length is 200 characters.'
      };
    }

    // Check if lms command is available
    try {
      await execAsync('lms --version');
    } catch (e) {
      return { 
        success: false, 
        error: 'LM Studio CLI not found. Please install it first using "Install LM Studio CLI" button.' 
      };
    }

    // Download the model - use spawn with arguments array to prevent command injection
    // This completely avoids shell interpretation
    console.log(`Downloading model: ${modelName}`);
    
    return new Promise((resolve) => {
      const child = spawn('lms', ['get', modelName]);
      
      let stdout = '';
      let stderr = '';
      
      // Set timeout manually since spawn doesn't support timeout option
      const timeout = setTimeout(() => {
        child.kill();
        resolve({ 
          success: false, 
          error: 'Download timed out. The model may be very large. Please try downloading manually in LM Studio.' 
        });
      }, 600000); // 10 minutes
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        clearTimeout(timeout);
        console.log('Model download output:', stdout);
        if (stderr) {
          console.log('Model download stderr:', stderr);
        }
        
        // Exit code 0 is the authoritative success indicator
        if (code === 0) {
          resolve({ success: true, message: `Model ${modelName} downloaded successfully` });
          return;
        }
        
        // Non-zero exit code indicates failure
        // Use stderr if available, otherwise provide generic error
        const errorMessage = stderr && stderr.trim() 
          ? stderr 
          : `Command exited with code ${code}`;
        resolve({ success: false, error: errorMessage });
      });
      
      child.on('error', (error) => {
        clearTimeout(timeout);
        console.error('Error downloading model:', error);
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error) {
    console.error('Error downloading model:', error);
    return { success: false, error: error.message };
  }
}

async function openLMStudio() {
  try {
    // Try to open LM Studio app on macOS
    // Common locations for LM Studio
    const possiblePaths = [
      '/Applications/LM Studio.app',
      path.join(process.env.HOME, 'Applications/LM Studio.app'),
      '/Applications/LMStudio.app',
      path.join(process.env.HOME, 'Applications/LMStudio.app')
    ];

    let found = false;
    for (const appPath of possiblePaths) {
      try {
        const fs = require('fs');
        if (fs.existsSync(appPath)) {
          await execAsync(`open "${appPath}"`);
          found = true;
          break;
        }
      } catch (e) {
        // Continue to next path
      }
    }

    if (!found) {
      // Try using 'open' command with the app name
      try {
        await execAsync('open -a "LM Studio"');
        found = true;
      } catch (e) {
        // Try alternative name
        try {
          await execAsync('open -a "LMStudio"');
          found = true;
        } catch (e2) {
          // Not found
        }
      }
    }

    if (!found) {
      return { 
        success: false, 
        error: 'LM Studio not found. Please install LM Studio from https://lmstudio.ai/' 
      };
    }

    return { success: true, message: 'LM Studio opened successfully' };
  } catch (error) {
    console.error('Error opening LM Studio:', error);
    return { success: false, error: error.message };
  }
}

app.whenReady().then(() => {
  // Load config and initialize LM Client
  initializeLMClient();

  createMainWindow();
  createTray();

  // Register global shortcut: Cmd+Shift+A
  const ret = globalShortcut.register('CommandOrControl+Shift+A', () => {
    showContextMenu();
  });

  if (!ret) {
    console.log('Failed to register global shortcut');
  }

  // Handle IPC calls from renderer
  ipcMain.handle('get-selected-text', async () => {
    return await getSelectedText();
  });

  ipcMain.handle('call-lm-api', async (event, { prompt, action }) => {
    try {
      const response = await lmClient.sendChat(prompt);
      return { success: true, text: response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.on('close-context-menu', () => {
    if (contextMenuWindow && !contextMenuWindow.isDestroyed()) {
      contextMenuWindow.close();
      contextMenuWindow = null;
    }
  });

  // Config management IPC handlers
  ipcMain.handle('get-config', async () => {
    return loadConfig();
  });

  ipcMain.handle('save-config', async (event, config) => {
    try {
      const savedConfig = saveConfig(config);
      currentConfig = savedConfig;
      return { success: true, config: savedConfig };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reload-lm-client', async () => {
    try {
      initializeLMClient();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // LM Studio IPC handlers
  ipcMain.handle('install-lmstudio', async () => {
    return await installLMStudioCLI();
  });

  ipcMain.handle('download-model', async (event, modelName) => {
    return await downloadModel(modelName);
  });

  ipcMain.handle('open-lmstudio', async () => {
    return await openLMStudio();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Don't quit when windows close - we're a background app
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

