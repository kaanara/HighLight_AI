const { app, BrowserWindow, globalShortcut, Menu, Tray, ipcMain, nativeImage } = require('electron');
const path = require('path');
const { getSelectedText } = require('./src/selection');
const { LMClient } = require('./src/lm-client');

let mainWindow = null;
let contextMenuWindow = null;
let tray = null;
let lmClient = null;

// LM Studio configuration
const LM_CONFIG = {
  baseURL: 'http://localhost:1234/v1',
  modelName: 'qwen/qwen3-4b-2507' // Update this to match your LM Studio model
};

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
        // TODO: Open settings window
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

app.whenReady().then(() => {
  // Initialize LM Client
  lmClient = new LMClient(LM_CONFIG);

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

