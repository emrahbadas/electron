# KayraDeniz - Professional AI-Powered Code Editor

**KayraDeniz** is a modern, professional Electron-based code editor with integrated AI capabilities, built-in terminal, and advanced IDE features.

## ✨ Key Features

### 🎨 Professional IDE Features
- **Code Folding** - Collapse/expand code blocks with ▼/▶ icons
- **Minimap** - VS Code-style code overview on the right sidebar
- **Bracket Matching** - Automatic highlighting of matching brackets
- **Auto-Closing Brackets** - Smart bracket pair insertion and wrapping
- **Indent Guides** - Visual code structure indicators
- **Go to Line** - Quick navigation with Ctrl+G
- **Syntax Highlighting** - Code highlighting support

### 🤖 AI Integration
- **AI Chat Assistant** - Ask questions and get instant code help
- **Code Agent Mode** - AI-powered code generation and modification
- **MCP Integration** - Model Context Protocol support
- **GitHub Copilot Ready** - Compatible with Copilot integration

### 💻 Advanced Terminal
- **Streaming Terminal** - Real-time process output
- **ANSI Color Support** - Colored terminal output rendering
- **Multiple Terminals** - Manage multiple terminal sessions
- **Process Management** - Start, stop, and monitor background processes

### 📁 File Management
- **Multi-Tab Editor** - Work with multiple files simultaneously
- **File Tree** - Easy project navigation
- **Recent Files** - Quick access to recently opened files
- **Auto-Save** - Never lose your work

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/emrahbadas/electron.git
cd electron

# Install dependencies
npm install

# Start the application
npm start
```

## 📂 Project Structure

```
KayraDeniz-Kod-Canavari/
├── src/
│   ├── main/          # Electron main process
│   │   ├── main.js
│   │   └── mcp-client.js
│   ├── renderer/      # Electron renderer process
│   │   ├── app.js     # Main application logic
│   │   ├── index.html
│   │   └── styles.css
│   ├── ai/            # AI integration modules
│   └── github/        # GitHub integration
├── assets/            # Icons and images
├── package.json
└── README.md
```

## 🎯 Usage

### Basic Editing
1. Open files via File menu or drag & drop
2. Edit code with full IDE features
3. Use Ctrl+S to save changes

### AI Assistant
1. Click "Ask Mode" button
2. Type your question or code request
3. Get instant AI-powered responses

### Code Folding
1. Click ▼ icon next to code blocks
2. Fold/unfold functions, classes, loops
3. Navigate large files easily

### Terminal
1. Click terminal icon at bottom
2. Run commands with live output
3. Multiple terminal support

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save File |
| `Ctrl+N` | New File |
| `Ctrl+O` | Open File |
| `Ctrl+G` | Go to Line |
| `Ctrl+W` | Close Tab |
| `Tab` | Insert 2 spaces |

## 🛠️ Technologies

- **Electron** - Cross-platform desktop app framework
- **Node.js** - Backend runtime
- **HTML5/CSS3** - Modern web technologies
- **JavaScript** - Application logic
- **MCP (Model Context Protocol)** - AI integration
- **GitHub API** - Repository integration

## 📝 Development

### Build for Production
```bash
npm run build
```

### Package Application
```bash
npm run package
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- GitHub Repository: https://github.com/emrahbadas/electron
- Issues: https://github.com/emrahbadas/electron/issues

## 🙏 Acknowledgments

- VS Code for IDE inspiration
- Electron community for excellent documentation
- GitHub Copilot for AI integration patterns

---

**Note:** The "gezgin" folder and related files were part of an early test project for the AI agent functionality and are not part of the main application.
