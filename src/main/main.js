const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const os = require('os');
const Store = require('electron-store');
const express = require('express');
const cors = require('cors');
const { glob } = require('glob');
const ElectronMCPClient = require('./mcp-client');
const AIManager = require('../ai/ai-manager');
const ContinueAgent = require('../ai/continue-agent');
// ===== CLAUDE AI + MCP INTEGRATION =====
const ClaudeAgent = require('./claude-agent');
const MCPManager = require('./mcp-manager');

// Fix Windows console encoding for Turkish characters
if (process.platform === 'win32') {
  // Set process encoding to UTF-8
  if (process.stdout && process.stdout.setEncoding) {
    process.stdout.setEncoding('utf8');
  }
  if (process.stderr && process.stderr.setEncoding) {
    process.stderr.setEncoding('utf8');
  }
}

const APP_DATA_ROOT = path.join(os.tmpdir(), 'kayradeniz-appdata');
const CACHE_DIR = path.join(APP_DATA_ROOT, 'cache');
const LOG_DIR = path.join(APP_DATA_ROOT, 'logs');
const DEFAULT_ICON_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAZklEQVRYCe2WwQ3AIAgE/f9n3dR2bZMQ1FKDagThFbVuKINPtNEc3oeAJ0AAJD2gm0BZ1mS6JlnQlTGWsm39tCqmMEykHLf0gblmKjAGVhU6XOrJGzmVb3rt8JCwqH/tngmbsMeKpS9G1Hu7Dj9/0CY0wW/9QH5AAAAAElFTkSuQmCC';

function ensureDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (error) {
    console.warn(`Klasör oluşturulamadı (${dirPath}):`, error);
  }
}

ensureDir(APP_DATA_ROOT);
ensureDir(CACHE_DIR);
ensureDir(LOG_DIR);

app.setPath('userData', APP_DATA_ROOT);
app.setPath('cache', CACHE_DIR);
app.setPath('logs', LOG_DIR);
app.commandLine.appendSwitch('disk-cache-dir', CACHE_DIR);
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

if (process.platform === 'win32') {
  app.setAppUserModelId('com.kayradeniz.kodcanavari');
}

// Store for app settings
const store = new Store();

let mainWindow;
let tray;
let resolvedIconPath = null;
let cachedNativeIcon = null;
let mcpClient = null; // MCP Client instance
let aiManager = null; // AI Manager instance
let continueAgent = null; // Continue Agent instance

// ===== CLAUDE AI + MCP INSTANCES =====
let claudeAgent = null; // Claude Agent instance
let mcpManager = null; // MCP Manager instance
let apiKeys = {
    openai: null,
    anthropic: null
}; // API keys stored in memory only

function ensureAppIcon() {
  if (resolvedIconPath && cachedNativeIcon && !cachedNativeIcon.isEmpty()) {
    return { path: resolvedIconPath, image: cachedNativeIcon };
  }

  const iconDir = path.join(__dirname, '../../assets');
  const iconPath = path.join(iconDir, 'icon.png');

  try {
    ensureDir(iconDir);
    if (!fs.existsSync(iconPath)) {
      fs.writeFileSync(iconPath, Buffer.from(DEFAULT_ICON_BASE64, 'base64'));
    }
    const iconBuffer = fs.readFileSync(iconPath);
    const iconImage = nativeImage.createFromBuffer(iconBuffer);
    if (!iconImage.isEmpty()) {
      resolvedIconPath = iconPath;
      cachedNativeIcon = iconImage;
      return { path: resolvedIconPath, image: cachedNativeIcon };
    }
  } catch (error) {
    console.warn('Varsayılan ikon oluşturulamadı:', error);
    resolvedIconPath = null;
    cachedNativeIcon = null;
  }

  return { path: null, image: null };
}

// Workaround for GPU driver crashes on some Windows setups
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');

// Enable live reload for development
if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '../node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit'
  });
}

function createWindow() {
  // Restore window size and position
  const windowBounds = store.get('windowBounds', {
    width: 1400,
    height: 900,
    x: undefined,
    y: undefined
  });

  const iconAssets = ensureAppIcon();
  const windowIcon = iconAssets.image;
  const windowOptions = {
    ...windowBounds,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    title: 'KayraDeniz Badaş Kod Canavarı',
    titleBarStyle: 'default',
    show: false,
    backgroundColor: '#1a1a1a'
  };

  // Only add icon if file exists
  if (windowIcon && !windowIcon.isEmpty()) {
    windowOptions.icon = windowIcon;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Load the app
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Focus window
    if (process.platform === 'darwin') {
      app.dock.show();
    }

    // Start tool server
    createToolServer();
  });

  // Save window bounds on close
  mainWindow.on('close', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Development tools - FORCE OPEN FOR DEBUGGING
  // if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  // }

  // Create application menu
  createMenu();

  // Create system tray
  createTray();
}

function createMenu() {
  const template = [
    {
      label: 'Dosya',
      submenu: [
        {
          label: 'Yeni Dosya',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu-new-file')
        },
        {
          label: 'Dosya Aç',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu-open-file')
        },
        {
          label: 'Klasör Aç',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => mainWindow.webContents.send('menu-open-folder')
        },
        { type: 'separator' },
        {
          label: 'Kaydet',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-save')
        },
        {
          label: 'Farklı Kaydet',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('menu-save-as')
        },
        { type: 'separator' },
        {
          label: 'Çıkış',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Düzenle',
      submenu: [
        { label: 'Geri Al', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Yinele', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Kes', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Kopyala', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Yapıştır', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Tümünü Seç', accelerator: 'CmdOrCtrl+A', role: 'selectall' }
      ]
    },
    {
      label: 'Görünüm',
      submenu: [
        { label: 'Yeniden Yükle', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Geliştirici Araçları', accelerator: 'F12', role: 'toggledevtools' },
        { type: 'separator' },
        { label: 'Tam Ekran', accelerator: 'F11', role: 'togglefullscreen' },
        { label: 'Yakınlaştır', accelerator: 'CmdOrCtrl+Plus', role: 'zoomin' },
        { label: 'Uzaklaştır', accelerator: 'CmdOrCtrl+-', role: 'zoomout' },
        { label: 'Gerçek Boyut', accelerator: 'CmdOrCtrl+0', role: 'resetzoom' }
      ]
    },
    {
      label: 'Yardım',
      submenu: [
        {
          label: 'Hakkında',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Hakkında',
              message: 'KayraDeniz Badaş Kod Canavarı',
              detail: 'Modern AI Kod Üretimi ve Dosya Yönetimi Uygulaması\nVersiyon: 1.0.0\n\n© 2025 KayraDeniz Badaş'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  try {
    if (process.platform === 'win32') {
      const iconAssets = ensureAppIcon();
      const trayIcon = iconAssets.image;
      if (!trayIcon || trayIcon.isEmpty()) {
        console.log('Tray icon could not be loaded, skipping tray creation');
        return;
      }
      tray = new Tray(trayIcon);
    }

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'KayraDeniz Kod Canavarı',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Göster',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        }
      },
      {
        label: 'Gizle',
        click: () => mainWindow.hide()
      },
      { type: 'separator' },
      {
        label: 'Çıkış',
        click: () => app.quit()
      }
    ]);

    tray.setToolTip('KayraDeniz Badaş Kod Canavarı');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      mainWindow.show();
      mainWindow.focus();
    });
  } catch (error) {
    console.error('Error creating tray:', error);
  }
}

// IPC handlers for file operations
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error opening external URL:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [
      { name: 'Tüm Dosyalar', extensions: ['*'] },
      { name: 'Metin Dosyaları', extensions: ['txt', 'md', 'json'] },
      { name: 'Kod Dosyaları', extensions: ['js', 'py', 'html', 'css', 'java', 'cpp', 'c'] }
    ],
    properties: ['openFile']
  });
  return result;
});

ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result;
});

ipcMain.handle('save-file-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Tüm Dosyalar', extensions: ['*'] },
      { name: 'Metin Dosyaları', extensions: ['txt'] },
      { name: 'JavaScript', extensions: ['js'] },
      { name: 'Python', extensions: ['py'] },
      { name: 'HTML', extensions: ['html'] },
      { name: 'CSS', extensions: ['css'] }
    ]
  });
  return result;
});

// File system operations
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fsPromises.readFile(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    // Ensure directory exists before writing file
    const dirPath = path.dirname(filePath);
    await fsPromises.mkdir(dirPath, { recursive: true });
    
    await fsPromises.writeFile(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-directory', async (event, dirPath) => {
  try {
    await fsPromises.mkdir(dirPath, { recursive: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const files = await fsPromises.readdir(dirPath, { withFileTypes: true });
    const result = [];

    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      let stats = null;

      try {
        stats = await fsPromises.stat(fullPath);
      } catch (error) {
        // Skip files we can't access
        continue;
      }

      result.push({
        name: file.name,
        path: fullPath,
        isDirectory: file.isDirectory(),
        isFile: file.isFile(),
        size: stats.size,
        modified: stats.mtime
      });
    }

    return { success: true, files: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Terminal operations
ipcMain.handle('run-command', async (event, command, cwd) => {
  const { spawn, exec } = require('child_process');
  const path = require('path');
  const os = require('os');

  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';

    // Set working directory
    const workingDir = cwd || process.cwd();

    // Enhanced environment with proper PATH
    const env = {
      ...process.env,
      PWD: workingDir
    };

    // Use exec for better command handling instead of spawn
    const options = {
      cwd: workingDir,
      env: env,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024, // 1MB buffer
      timeout: 300000, // 5 minute timeout (was 30s - too short for npm install/build)
      shell: isWindows ? 'powershell.exe' : true
    };

    // For Windows PowerShell, wrap command properly
    let finalCommand = command;
    if (isWindows) {
      // Handle special cases for file paths with spaces
      if (command.includes('"') && (command.includes('.py') || command.includes('.js') || command.includes('.exe'))) {
        finalCommand = command;
      } else if (command.startsWith('python ') && command.includes(' ')) {
        // Handle Python commands with file paths
        const parts = command.split(' ');
        if (parts.length >= 2 && !parts[1].startsWith('"')) {
          const pythonArgs = parts.slice(1).join(' ');
          if (pythonArgs.includes(' ') && !pythonArgs.startsWith('"')) {
            finalCommand = `python "${pythonArgs}"`;
          }
        }
      }
    }

    console.log(`Executing: ${finalCommand} in ${workingDir}`);

    exec(finalCommand, options, (error, stdout, stderr) => {
      if (error) {
        // Don't treat non-zero exit codes as errors if we have output
        const hasOutput = stdout || stderr;
        resolve({
          success: !error.killed && hasOutput,
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: error.code || (error.killed ? -1 : 1),
          error: error.killed ? 'Command timeout' : null
        });
      } else {
        resolve({
          success: true,
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: 0
        });
      }
    });
  });
});

// ✨ NEW: Streaming process for long-running commands (npm start, node server.js, etc.)
let activeProcesses = new Map(); // Store running processes by ID

ipcMain.handle('start-process', async (event, processId, command, cwd) => {
  const { spawn } = require('child_process');
  const isWindows = process.platform === 'win32';
  
  try {
    // Stop existing process with same ID if exists
    if (activeProcesses.has(processId)) {
      const oldProcess = activeProcesses.get(processId);
      oldProcess.kill();
      activeProcesses.delete(processId);
    }
    
    const workingDir = cwd || process.cwd();
    
    // Spawn process with shell
    const childProcess = spawn(command, [], {
      cwd: workingDir,
      shell: isWindows ? 'powershell.exe' : true,
      env: { ...process.env, PWD: workingDir }
    });
    
    // Store process
    activeProcesses.set(processId, childProcess);
    
    // Stream stdout
    childProcess.stdout.on('data', (data) => {
      event.sender.send('process-output', {
        processId,
        type: 'stdout',
        data: data.toString()
      });
    });
    
    // Stream stderr
    childProcess.stderr.on('data', (data) => {
      event.sender.send('process-output', {
        processId,
        type: 'stderr',
        data: data.toString()
      });
    });
    
    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      event.sender.send('process-exit', {
        processId,
        exitCode: code,
        signal
      });
      activeProcesses.delete(processId);
    });
    
    // Handle process errors
    childProcess.on('error', (error) => {
      event.sender.send('process-error', {
        processId,
        error: error.message
      });
      activeProcesses.delete(processId);
    });
    
    return { 
      success: true, 
      processId,
      message: 'Process started successfully'
    };
    
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// Stop a running process
ipcMain.handle('stop-process', async (event, processId) => {
  try {
    if (activeProcesses.has(processId)) {
      const process = activeProcesses.get(processId);
      process.kill('SIGTERM');
      activeProcesses.delete(processId);
      return { success: true, message: 'Process stopped' };
    }
    return { success: false, error: 'Process not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get list of active processes
ipcMain.handle('list-processes', async () => {
  return Array.from(activeProcesses.keys());
});

// ===== MCP TOOL HANDLERS =====

// MCP bağlantı durumunu kontrol et
ipcMain.handle('mcp-status', async () => {
  try {
    const connected = mcpClient ? mcpClient.isClientConnected() : false;
    const toolCount = mcpClient ? mcpClient.getAvailableTools().length : 0;
    return {
      connected: connected,
      toolCount: toolCount
    };
  } catch (error) {
    console.error('MCP status error:', error);
    return {
      connected: false,
      toolCount: 0,
      error: String(error.message || error)
    };
  }
});

// Mevcut tools'ları al
ipcMain.handle('mcp-list-tools', async () => {
  try {
    if (!mcpClient || !mcpClient.isClientConnected()) {
      throw new Error('MCP Client bağlı değil');
    }
    const tools = mcpClient.getAvailableTools();
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  } catch (error) {
    console.error('MCP list tools error:', error);
    throw error;
  }
});

// MCP test connection
ipcMain.handle('mcp-test', async () => {
  if (!mcpClient || !mcpClient.isClientConnected()) {
    throw new Error('MCP Client bağlı değil');
  }
  return await mcpClient.testConnection();
});

// Dosya oluştur (MCP)
ipcMain.handle('mcp-create-file', async (event, filePath, content, workingDirectory) => {
  if (!mcpClient || !mcpClient.isClientConnected()) {
    throw new Error('MCP Client bağlı değil');
  }
  return await mcpClient.createFile(filePath, content, workingDirectory);
});

// Dosya oku (MCP)
ipcMain.handle('mcp-read-file', async (event, filePath) => {
  if (!mcpClient || !mcpClient.isClientConnected()) {
    throw new Error('MCP Client bağlı değil');
  }
  return await mcpClient.readFile(filePath);
});

// Kod dosyası yaz (MCP)
ipcMain.handle('mcp-write-code', async (event, filePath, content, language, workingDirectory) => {
  if (!mcpClient || !mcpClient.isClientConnected()) {
    throw new Error('MCP Client bağlı değil');
  }
  return await mcpClient.writeCode(filePath, content, language, workingDirectory);
});

// Dosyaları listele (MCP)
ipcMain.handle('mcp-list-files', async (event, directoryPath) => {
  if (!mcpClient || !mcpClient.isClientConnected()) {
    throw new Error('MCP Client bağlı değil');
  }
  return await mcpClient.listFiles(directoryPath);
});

// Proje yapısı oluştur (MCP)
ipcMain.handle('mcp-generate-project', async (event, projectName, projectType, basePath, workingDirectory) => {
  if (!mcpClient || !mcpClient.isClientConnected()) {
    throw new Error('MCP Client bağlı değil');
  }
  return await mcpClient.generateProject(projectName, projectType, basePath, workingDirectory);
});

// Genel MCP tool çağırma
ipcMain.handle('mcp-call-tool', async (event, toolName, args) => {
  if (!mcpClient || !mcpClient.isClientConnected()) {
    throw new Error('MCP Client bağlı değil');
  }
  return await mcpClient.callTool(toolName, args);
});

// ========================================
// CLAUDE AI + MCP INTEGRATION IPC HANDLERS
// ========================================

// Initialize Claude Agent and MCP Manager
async function initializeClaudeAndMCP() {
    try {
        console.log('🚀 Initializing Claude Agent and MCP Manager...');
        
        // Initialize Claude Agent
        claudeAgent = new ClaudeAgent();
        console.log('✅ Claude Agent created');
        
        // Initialize MCP Manager with permission callback
        mcpManager = new MCPManager(async (toolName, args) => {
            // Permission callback - show dialog in renderer
            return await showToolPermissionDialog(toolName, args);
        });
        console.log('✅ MCP Manager created');
        
        // Link MCP Manager to Claude Agent
        claudeAgent.setMCPManager(mcpManager);
        
        // Try to connect to MCP servers (non-blocking)
        mcpManager.connectAll()
            .then(results => {
                console.log('🔌 MCP Connection results:', results);
            })
            .catch(error => {
                console.warn('⚠️ MCP connection failed (non-critical):', error.message);
            });
        
        console.log('✅ Claude + MCP initialization complete');
        
    } catch (error) {
        console.error('❌ Failed to initialize Claude + MCP:', error);
    }
}

// Show permission dialog for tool calls
async function showToolPermissionDialog(toolName, args) {
    return new Promise((resolve) => {
        if (!mainWindow) {
            resolve({ allowed: false, reason: 'No main window' });
            return;
        }
        
        // Send permission request to renderer
        mainWindow.webContents.send('mcp:request-permission', { toolName, args });
        
        // Wait for response with timeout
        const timeout = setTimeout(() => {
            ipcMain.removeListener('mcp:permission-response', responseHandler);
            resolve({ allowed: false, reason: 'Timeout' });
        }, 30000); // 30 seconds
        
        const responseHandler = (event, response) => {
            clearTimeout(timeout);
            ipcMain.removeListener('mcp:permission-response', responseHandler);
            resolve(response);
        };
        
        ipcMain.once('mcp:permission-response', responseHandler);
    });
}

// llm:ask - Unified LLM endpoint (OpenAI or Claude)
ipcMain.handle('llm:ask', async (event, request) => {
    const { provider, model, messages, toolsEnabled, systemPrompt, maxTokens, temperature } = request;
    
    try {
        if (provider === 'anthropic') {
            // Claude path
            if (!claudeAgent) {
                throw new Error('Claude Agent not initialized');
            }
            
            if (!apiKeys.anthropic) {
                throw new Error('Claude API key not set');
            }
            
            // Ensure API key is set
            if (!claudeAgent.getStatus().hasApiKey) {
                claudeAgent.setApiKey(apiKeys.anthropic);
            }
            
            // Call Claude with all options
            const response = await claudeAgent.askClaude(messages, {
                model: model || claudeAgent.currentModel,
                toolsEnabled: toolsEnabled || false,
                systemPrompt: systemPrompt || null,
                maxTokens: maxTokens || 4096,
                temperature: temperature || 0.7
            });
            
            return {
                success: true,
                provider: 'anthropic',
                model: model || claudeAgent.currentModel,
                response: response
            };
            
        } else if (provider === 'openai') {
            // OpenAI path (existing code agent)
            // Fallback to existing OpenAI implementation
            throw new Error('OpenAI provider - use existing code path');
            
        } else {
            throw new Error(`Unknown provider: ${provider}`);
        }
        
    } catch (error) {
        console.error('❌ llm:ask error:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

// llm:set-api-key - Set API key for a provider
ipcMain.handle('llm:set-api-key', async (event, { provider, apiKey }) => {
    try {
        if (provider === 'anthropic') {
            apiKeys.anthropic = apiKey;
            
            if (claudeAgent) {
                claudeAgent.setApiKey(apiKey);
            }
            
            console.log('✅ Claude API key set');
            return { success: true };
            
        } else if (provider === 'openai') {
            apiKeys.openai = apiKey;
            console.log('✅ OpenAI API key set');
            return { success: true };
            
        } else {
            throw new Error(`Unknown provider: ${provider}`);
        }
        
    } catch (error) {
        console.error('❌ set-api-key error:', error);
        return { success: false, error: error.message };
    }
});

// llm:get-models - Get available models for a provider
ipcMain.handle('llm:get-models', async (event, { provider }) => {
    try {
        if (provider === 'anthropic') {
            // Claude Agent should be initialized even without API key
            // getAvailableModels() just returns a static dictionary
            if (!claudeAgent) {
                console.warn('⚠️ Claude Agent not initialized, initializing now...');
                claudeAgent = new ClaudeAgent();
            }
            
            return {
                success: true,
                models: claudeAgent.getAvailableModels()
            };
            
        } else if (provider === 'openai') {
            // Return OpenAI models
            return {
                success: true,
                models: {
                    'gpt-4': 'GPT-4',
                    'gpt-4-turbo': 'GPT-4 Turbo',
                    'gpt-3.5-turbo': 'GPT-3.5 Turbo'
                }
            };
            
        } else {
            throw new Error(`Unknown provider: ${provider}`);
        }
        
    } catch (error) {
        console.error('❌ get-models error:', error);
        return { success: false, error: error.message };
    }
});

// llm:set-model - Set model for a provider
ipcMain.handle('llm:set-model', async (event, { provider, model }) => {
    try {
        if (provider === 'anthropic') {
            if (!claudeAgent) {
                console.warn('⚠️ Claude Agent not initialized, initializing now...');
                claudeAgent = new ClaudeAgent();
            }
            
            claudeAgent.setModel(model);
            console.log(`✅ Claude model set to: ${model}`);
            return { success: true };
            
        } else {
            // OpenAI model change handled elsewhere
            return { success: true };
        }
        
    } catch (error) {
        console.error('❌ set-model error:', error);
        return { success: false, error: error.message };
    }
});

// mcp:list-tools - List all available MCP tools
ipcMain.handle('mcp-new:list-tools', async () => {
    try {
        if (!mcpManager) {
            throw new Error('MCP Manager not initialized');
        }
        
        const tools = await mcpManager.listTools();
        
        return {
            success: true,
            tools: tools
        };
        
    } catch (error) {
        console.error('❌ mcp:list-tools error:', error);
        return {
            success: false,
            error: error.message,
            tools: []
        };
    }
});

// mcp:call-tool - Call an MCP tool (with permission check)
ipcMain.handle('mcp-new:call-tool', async (event, { toolName, args }) => {
    try {
        if (!mcpManager) {
            throw new Error('MCP Manager not initialized');
        }
        
        const result = await mcpManager.callTool(toolName, args);
        
        return {
            success: true,
            result: result
        };
        
    } catch (error) {
        console.error('❌ mcp:call-tool error:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

// mcp:get-status - Get MCP Manager status
ipcMain.handle('mcp-new:get-status', async () => {
    try {
        if (!mcpManager) {
            return {
                success: false,
                error: 'MCP Manager not initialized',
                status: {}
            };
        }
        
        const status = mcpManager.getStatus();
        
        return {
            success: true,
            status: status
        };
        
    } catch (error) {
        console.error('❌ mcp:get-status error:', error);
        return {
            success: false,
            error: error.message,
            status: {}
        };
    }
});

// mcp:get-log - Get MCP call log
ipcMain.handle('mcp-new:get-log', async () => {
    try {
        if (!mcpManager) {
            throw new Error('MCP Manager not initialized');
        }
        
        const log = mcpManager.getCallLog();
        
        return {
            success: true,
            log: log
        };
        
    } catch (error) {
        console.error('❌ mcp:get-log error:', error);
        return {
            success: false,
            error: error.message,
            log: []
        };
    }
});

// mcp:set-file-whitelist - Set file whitelist root
ipcMain.handle('mcp-new:set-file-whitelist', async (event, { rootPath }) => {
    try {
        if (!mcpManager) {
            throw new Error('MCP Manager not initialized');
        }
        
        mcpManager.setFileWhitelistRoot(rootPath);
        
        return { success: true };
        
    } catch (error) {
        console.error('❌ mcp:set-file-whitelist error:', error);
        return { success: false, error: error.message };
    }
});

// claude:get-status - Get Claude Agent status
ipcMain.handle('claude:get-status', async () => {
    try {
        if (!claudeAgent) {
            return {
                success: false,
                error: 'Claude Agent not initialized',
                status: {}
            };
        }
        
        const status = claudeAgent.getStatus();
        
        return {
            success: true,
            status: status
        };
        
    } catch (error) {
        console.error('❌ claude:get-status error:', error);
        return {
            success: false,
            error: error.message,
            status: {}
        };
    }
});

// claude:clear-history - Clear conversation history
ipcMain.handle('claude:clear-history', async () => {
    try {
        if (!claudeAgent) {
            throw new Error('Claude Agent not initialized');
        }
        
        claudeAgent.clearHistory();
        
        return { success: true };
        
    } catch (error) {
        console.error('❌ claude:clear-history error:', error);
        return { success: false, error: error.message };
    }
});

// ========================================
// END CLAUDE AI + MCP INTEGRATION
// ========================================

// App event handlers
app.whenReady().then(async () => {
  await createWindow();
  await initializeMCPClient();
  await initializeClaudeAndMCP(); // ✨ Initialize Claude + MCP
});

// MCP Client başlatma
async function initializeMCPClient() {
  try {
    console.log('MCP Client başlatılıyor...');
    mcpClient = new ElectronMCPClient();
    
    const connected = await mcpClient.connect();
    if (connected) {
      console.log('MCP Client başarıyla başlatıldı');
      
      // Test bağlantısı
      try {
        const testResult = await mcpClient.testConnection();
        console.log('MCP Test sonucu:', testResult);
      } catch (testError) {
        console.warn('MCP Test hatası:', testError);
      }
    } else {
      console.error('MCP Client başlatılamadı');
    }
  } catch (error) {
    console.error('MCP Client başlatma hatası:', error);
  }
}

app.on('window-all-closed', () => {
  stopToolServer();
  if (mcpClient) {
    mcpClient.disconnect();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopToolServer();
  if (mcpClient) {
    mcpClient.disconnect();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (navigationEvent, navigationURL) => {
    navigationEvent.preventDefault();
    shell.openExternal(navigationURL);
  });
});

// ===== TOOL SERVER =====
let toolServer = null;

function createToolServer() {
  if (toolServer) return;

  const serverApp = express();
  serverApp.use(cors());
  serverApp.use(express.json());

  // List directory contents
  serverApp.post('/tool/list_dir', async (req, res) => {
    try {
      const dirPath = req.body.dir || process.cwd();
      const files = await fsPromises.readdir(dirPath, { withFileTypes: true });
      const result = files.map(file => ({
        name: file.name,
        type: file.isDirectory() ? 'directory' : 'file',
        path: path.join(dirPath, file.name)
      }));
      res.json({ success: true, files: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Read file content
  serverApp.post('/tool/read_file', async (req, res) => {
    try {
      const filePath = req.body.file;
      if (!filePath) {
        return res.status(400).json({ success: false, error: 'File path required' });
      }
      const content = await fsPromises.readFile(filePath, 'utf8');
      res.json({ success: true, content });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Glob pattern search
  serverApp.post('/tool/glob', async (req, res) => {
    try {
      const { pattern, dir } = req.body;
      if (!pattern) {
        return res.status(400).json({ success: false, error: 'Pattern required' });
      }

      const searchDir = dir || process.cwd();
      const options = { cwd: searchDir, absolute: true };

      const files = await glob(pattern, options);
      res.json({ success: true, files });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Write file
  serverApp.post('/tool/write_file', async (req, res) => {
    try {
      const { path: filePath, content } = req.body;
      if (!filePath) {
        return res.status(400).json({ success: false, error: 'File path required' });
      }
      await fsPromises.writeFile(filePath, content, 'utf8');
      res.json({ success: true, message: 'File written successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Execute command
  serverApp.post('/tool/run_command', async (req, res) => {
    try {
      const { command, cwd } = req.body;
      if (!command) {
        return res.status(400).json({ success: false, error: 'Command required' });
      }

      const { spawn } = require('child_process');
      const workingDir = cwd || process.cwd();

      let output = '';
      const child = spawn('powershell', ['-Command', command], {
        cwd: workingDir,
        shell: true
      });

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        res.json({
          success: code === 0,
          output: output.trim(),
          exitCode: code
        });
      });

    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Set working directory
  serverApp.post('/tool/set_working_dir', (req, res) => {
    try {
      let payload = req.body;

      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch (parseError) {
          console.warn('set_working_dir payload parse error:', parseError);
        }
      }

      const candidates = [
        payload?.path,
        payload?.dir,
        payload?.directory,
        payload?.cwd
      ].filter(Boolean);

      let targetPath = candidates.length > 0 ? candidates[0] : null;

      if (Array.isArray(targetPath)) {
        targetPath = targetPath[0];
      }

      if (typeof targetPath !== 'string' || !targetPath.trim()) {
        return res.status(400).json({ success: false, error: 'Directory path required' });
      }

      targetPath = targetPath.trim();

      if (!path.isAbsolute(targetPath)) {
        targetPath = path.resolve(process.cwd(), targetPath);
      }

      if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
        return res.status(400).json({ success: false, error: 'Directory not found' });
      }

      process.chdir(targetPath);
      console.log('🔧 Tool server working directory set to:', process.cwd());
      res.json({ success: true, workingDir: process.cwd() });
    } catch (error) {
      console.error('set_working_dir error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Health check - sadece konsol için
  console.log('🔧 Tool services are available via MCP');

  // HTTP server gereksiz - MCP kullanıyoruz
  // toolServer = serverApp.listen(7777, 'localhost', () => {
  //   console.log('🔧 Tool server started on http://localhost:7777');
  // });

  // toolServer.on('error', (error) => {
  //   console.error('Tool server error:', error);
  //   toolServer = null;
  // });
}

// Stop tool server
function stopToolServer() {
  if (toolServer) {
    toolServer.close();
    toolServer = null;
    console.log('🔧 Tool server stopped');
  }
}

// ============================================
// AI MANAGER IPC HANDLERS (GitHub Copilot)
// ============================================

// AI Manager'ı başlat (GitHub Models API ile)
ipcMain.handle('ai-initialize', async (event, workspacePath) => {
  try {
    if (!aiManager) {
      const AIManagerClass = require('../ai/ai-manager');
      aiManager = new AIManagerClass();
    }
    
    const result = await aiManager.initialize(workspacePath);
    console.log('AI Manager initialization result:', result.success ? 'Success' : 'Failed');
    return result;
  } catch (error) {
    console.error('AI initialization error:', error);
    return { success: false, error: error.message };
  }
});

// AI ile sohbet et
ipcMain.handle('ai-chat', async (event, message, options = {}) => {
  try {
    if (!aiManager || !aiManager.isInitialized) {
      throw new Error('AI Manager not initialized');
    }
    
    const result = await aiManager.chat(message, options);
    return result;
  } catch (error) {
    console.error('AI chat error:', error);
    return { success: false, error: error.message };
  }
});

// Kod analizi
ipcMain.handle('ai-analyze-code', async (event, code, language, request) => {
  try {
    if (!aiManager || !aiManager.isInitialized) {
      throw new Error('AI Manager not initialized');
    }
    
    const result = await aiManager.analyzeCode(code, language, request);
    return result;
  } catch (error) {
    console.error('AI code analysis error:', error);
    return { success: false, error: error.message };
  }
});

// Kod üret
ipcMain.handle('ai-generate-code', async (event, prompt, language) => {
  try {
    if (!aiManager || !aiManager.isInitialized) {
      throw new Error('AI Manager not initialized');
    }
    
    const result = await aiManager.generateCode(prompt, language);
    return result;
  } catch (error) {
    console.error('AI code generation error:', error);
    return { success: false, error: error.message };
  }
});

// Workspace'i yenile
ipcMain.handle('ai-refresh-workspace', async (event, workspacePath) => {
  try {
    if (!aiManager) {
      throw new Error('AI Manager not initialized');
    }
    
    await aiManager.refreshWorkspace(workspacePath);
    return { success: true, message: 'Workspace refreshed' };
  } catch (error) {
    console.error('AI workspace refresh error:', error);
    return { success: false, error: error.message };
  }
});

// AI durumu
ipcMain.handle('ai-status', async (event) => {
  try {
    if (!aiManager) {
      return { 
        success: true, 
        status: { 
          initialized: false, 
          connected: false, 
          workspace: null, 
          cachedFiles: 0 
        } 
      };
    }
    
    const status = aiManager.getStatus();
    return { success: true, status };
  } catch (error) {
    console.error('AI status error:', error);
    return { success: false, error: error.message };
  }
});

// Model değiştir
ipcMain.handle('ai-set-model', async (event, modelName) => {
  try {
    if (!aiManager) {
      throw new Error('AI Manager not initialized');
    }
    
    const success = aiManager.setModel(modelName);
    return { success, currentModel: aiManager.currentModel };
  } catch (error) {
    console.error('AI set model error:', error);
    return { success: false, error: error.message };
  }
});

// Conversation history temizle
ipcMain.handle('ai-clear-history', async (event) => {
  try {
    // GitHub Models API stateless olduğu için history yok, sadece success dön
    return { success: true, message: 'New conversation started' };
  } catch (error) {
    console.error('AI clear history error:', error);
    return { success: false, error: error.message };
  }
});

// ===== CONTINUE AGENT IPC HANDLERS =====

// Continue agent'i başlat
ipcMain.handle('continue-initialize', async (event, workspacePath) => {
  try {
    if (!continueAgent) {
      const configPath = path.join(__dirname, '../../.continue/config.json');
      continueAgent = new ContinueAgent(configPath, workspacePath);
    }
    
    const result = await continueAgent.initialize();
    return result;
  } catch (error) {
    console.error('Continue initialize error:', error);
    return { success: false, error: error.message };
  }
});

// Continue agent prompt işle
ipcMain.handle('continue-process-prompt', async (event, prompt, context = {}) => {
  try {
    if (!continueAgent) {
      throw new Error('Continue agent not initialized');
    }
    
    const result = await continueAgent.processPrompt(prompt, context);
    return result;
  } catch (error) {
    console.error('Continue process prompt error:', error);
    return { success: false, error: error.message };
  }
});

// Continue agent durumu
ipcMain.handle('continue-status', async (event) => {
  try {
    if (!continueAgent) {
      return { initialized: false, running: false };
    }
    
    return continueAgent.getStatus();
  } catch (error) {
    console.error('Continue status error:', error);
    return { initialized: false, running: false, error: error.message };
  }
});

// Continue agent API key güncelle
ipcMain.handle('continue-update-api-key', async (event, apiKey) => {
  try {
    if (!continueAgent) {
      throw new Error('Continue agent not initialized');
    }
    
    await continueAgent.updateApiKey(apiKey);
    return { success: true };
  } catch (error) {
    console.error('Continue update API key error:', error);
    return { success: false, error: error.message };
  }
});

// Continue agent'i durdur
ipcMain.handle('continue-stop', async (event) => {
  try {
    if (continueAgent) {
      continueAgent.isRunning = false;
    }
    return { success: true };
  } catch (error) {
    console.error('Continue stop error:', error);
    return { success: false, error: error.message };
  }
});