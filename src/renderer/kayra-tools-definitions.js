/**
 * KayraDeniz Tool Definitions - Continue.dev Pattern
 * Temel tool tanımları ve implementations
 */

import { KayraToolNames, ToolCategories, ToolPermissions } from './kayra-tools-architecture.js';

// ===== TOOL DEFINITIONS =====

export const readFileToolDefinition = {
    name: KayraToolNames.ReadFile,
    displayTitle: "Dosya Oku",
    description: "Belirtilen dosyanın içeriğini okur ve gösterir",
    category: ToolCategories.FILE,
    permission: ToolPermissions.ALLOWED,
    isInstant: true,
    parameters: {
        type: "object",
        required: ["filepath"],
        properties: {
            filepath: {
                type: "string",
                description: "Okunacak dosyanın çalışma dizinine göre göreli yolu"
            }
        }
    },
    examples: [
        {
            input: { filepath: "src/main.js" },
            expected: "Dosya içeriği başarıyla okundu"
        }
    ]
};

export const writeFileToolDefinition = {
    name: KayraToolNames.WriteFile,
    displayTitle: "Dosya Yaz",
    description: "Belirtilen dosyaya içerik yazar veya dosyayı günceller",
    category: ToolCategories.FILE,
    permission: ToolPermissions.PROTECTED,
    isInstant: true,
    parameters: {
        type: "object",
        required: ["filepath", "content"],
        properties: {
            filepath: {
                type: "string",
                description: "Yazılacak dosyanın çalışma dizinine göre göreli yolu"
            },
            content: {
                type: "string",
                description: "Dosyaya yazılacak içerik"
            }
        }
    },
    examples: [
        {
            input: { filepath: "test.txt", content: "Hello World" },
            expected: "Dosya başarıyla oluşturuldu/güncellendi"
        }
    ]
};

export const runCommandToolDefinition = {
    name: KayraToolNames.RunCommand,
    displayTitle: "Komut Çalıştır",
    description: "Terminal/cmd komutlarını çalıştırır ve sonuçları döner",
    category: ToolCategories.TERMINAL,
    permission: ToolPermissions.PROTECTED,
    isInstant: false,
    parameters: {
        type: "object",
        required: ["command"],
        properties: {
            command: {
                type: "string",
                description: "Çalıştırılacak terminal komutu"
            },
            workingDir: {
                type: "string",
                description: "Komutun çalıştırılacağı dizin (opsiyonel)"
            }
        }
    },
    examples: [
        {
            input: { command: "npm --version" },
            expected: "Komut başarıyla çalıştırıldı"
        }
    ]
};

export const listDirectoryToolDefinition = {
    name: KayraToolNames.ListDirectory,
    displayTitle: "Dizin Listele",
    description: "Belirtilen dizindeki dosya ve klasörleri listeler",
    category: ToolCategories.FILE,
    permission: ToolPermissions.ALLOWED,
    isInstant: true,
    parameters: {
        type: "object",
        required: [],
        properties: {
            path: {
                type: "string",
                description: "Listelenecek dizin yolu (boş ise mevcut dizin)"
            }
        }
    },
    examples: [
        {
            input: { path: "src" },
            expected: "Dizin içeriği listelendi"
        }
    ]
};

export const createProjectToolDefinition = {
    name: KayraToolNames.CreateProject,
    displayTitle: "Proje Oluştur",
    description: "Yeni proje yapısı oluşturur ve temel dosyaları hazırlar",
    category: ToolCategories.PROJECT,
    permission: ToolPermissions.PROTECTED,
    isInstant: false,
    parameters: {
        type: "object",
        required: ["projectName", "projectType"],
        properties: {
            projectName: {
                type: "string",
                description: "Proje adı"
            },
            projectType: {
                type: "string",
                description: "Proje türü (react, node, python, html vb.)"
            },
            description: {
                type: "string",
                description: "Proje açıklaması"
            }
        }
    },
    examples: [
        {
            input: { projectName: "my-app", projectType: "react", description: "Modern React uygulaması" },
            expected: "Proje başarıyla oluşturuldu"
        }
    ]
};

// ===== TOOL IMPLEMENTATIONS =====

export const readFileToolImpl = async (args, extras) => {
    const { filepath } = args;
    
    try {
        const content = await extras.fileSystem.readFile(filepath);
        
        return [{
            name: `Dosya: ${filepath}`,
            description: `${filepath} dosyası okundu`,
            content: content,
            type: "file",
            metadata: { 
                filepath, 
                size: content.length,
                lines: content.split('\n').length
            }
        }];
        
    } catch (error) {
        throw new Error(`Dosya okunamadı: ${error.message}`);
    }
};

export const writeFileToolImpl = async (args, extras) => {
    const { filepath, content } = args;
    
    try {
        const success = await extras.fileSystem.writeFile(filepath, content);
        
        if (success) {
            extras.ui.showNotification(`✅ ${filepath} dosyası oluşturuldu/güncellendi`, 'success');
        }
        
        return [{
            name: `Dosya Yazıldı: ${filepath}`,
            description: `${filepath} dosyasına içerik yazıldı`,
            content: `Dosya başarıyla oluşturuldu/güncellendi.\nBoyut: ${content.length} karakter`,
            type: "file",
            metadata: { 
                filepath, 
                size: content.length,
                operation: "write"
            }
        }];
        
    } catch (error) {
        throw new Error(`Dosya yazılamadı: ${error.message}`);
    }
};

export const runCommandToolImpl = async (args, extras) => {
    const { command, workingDir } = args;
    
    try {
        // Working directory ayarla
        if (workingDir) {
            extras.workingDirectory = workingDir;
        }
        
        const output = await extras.terminal.execute(command);
        
        return [{
            name: `Komut: ${command}`,
            description: `Terminal komutu çalıştırıldı`,
            content: output,
            type: "command",
            metadata: { 
                command,
                workingDir: workingDir || extras.workingDirectory,
                timestamp: new Date().toISOString()
            }
        }];
        
    } catch (error) {
        throw new Error(`Komut çalıştırılamadı: ${error.message}`);
    }
};

export const listDirectoryToolImpl = async (args, extras) => {
    const { path } = args;
    const targetPath = path || extras.workingDirectory;
    
    try {
        // Bu implementation'ı terminal komutu ile yapalım
        const isWindows = process.platform === 'win32';
        const command = isWindows ? `dir "${targetPath}"` : `ls -la "${targetPath}"`;
        
        const output = await extras.terminal.execute(command);
        
        return [{
            name: `Dizin: ${targetPath}`,
            description: `${targetPath} dizinin içeriği`,
            content: output,
            type: "file",
            metadata: { 
                path: targetPath,
                operation: "list"
            }
        }];
        
    } catch (error) {
        throw new Error(`Dizin listelenemedi: ${error.message}`);
    }
};

export const createProjectToolImpl = async (args, extras) => {
    const { projectName, projectType, description } = args;
    
    try {
        extras.ui.showProgress(`Proje oluşturuluyor: ${projectName}`);
        
        const results = [];
        
        // Proje klasörü oluştur
        await extras.fileSystem.createDirectory(projectName);
        
        // Proje türüne göre dosyalar oluştur
        const projectFiles = generateProjectFiles(projectName, projectType, description);
        
        for (const [filepath, content] of Object.entries(projectFiles)) {
            await extras.fileSystem.writeFile(`${projectName}/${filepath}`, content);
            
            results.push({
                name: `Oluşturulan: ${filepath}`,
                description: `${projectType} projesi için ${filepath} dosyası`,
                content: `Dosya boyutu: ${content.length} karakter`,
                type: "file",
                metadata: { filepath, projectType }
            });
        }
        
        extras.ui.showNotification(`✅ ${projectName} projesi başarıyla oluşturuldu`, 'success');
        
        return results;
        
    } catch (error) {
        throw new Error(`Proje oluşturulamadı: ${error.message}`);
    }
};

// Helper function for project file generation
function generateProjectFiles(projectName, projectType, description) {
    const files = {};
    
    // README.md (her projede ortak)
    files['README.md'] = `# ${projectName}

${description || 'KayraDeniz Kod Canavarı tarafından oluşturulan proje'}

## Kurulum

\`\`\`bash
npm install
\`\`\`

## Çalıştırma

\`\`\`bash
npm start
\`\`\`
`;

    // Proje türüne göre özel dosyalar
    switch (projectType) {
        case 'react':
            files['package.json'] = JSON.stringify({
                name: projectName,
                version: "1.0.0",
                scripts: {
                    start: "react-scripts start",
                    build: "react-scripts build"
                },
                dependencies: {
                    react: "^18.0.0",
                    "react-dom": "^18.0.0",
                    "react-scripts": "5.0.1"
                }
            }, null, 2);
            
            files['src/App.js'] = `import React from 'react';

function App() {
  return (
    <div className="App">
      <h1>${projectName}</h1>
      <p>${description}</p>
    </div>
  );
}

export default App;`;

            files['src/index.js'] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`;

            files['public/index.html'] = `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
</head>
<body>
    <div id="root"></div>
</body>
</html>`;
            break;
            
        case 'node':
            files['package.json'] = JSON.stringify({
                name: projectName,
                version: "1.0.0",
                main: "index.js",
                scripts: {
                    start: "node index.js",
                    dev: "nodemon index.js"
                },
                dependencies: {
                    express: "^4.18.0"
                }
            }, null, 2);
            
            files['index.js'] = `const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
    res.json({ 
        message: 'Merhaba ${projectName}!',
        description: '${description}'
    });
});

app.listen(port, () => {
    console.log(\`🚀 ${projectName} http://localhost:\${port} adresinde çalışıyor\`);
});`;
            break;
            
        default:
            files['index.html'] = `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
</head>
<body>
    <h1>${projectName}</h1>
    <p>${description}</p>
</body>
</html>`;
    }
    
    return files;
}