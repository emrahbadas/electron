// Test the agent system without UI dependencies
console.log('Testing agent functionality...');

// Simulate what happens when agent mode is triggered
const mockApp = {
    settings: { apiKey: 'test-key' }, // You'll need a real key

    addChatMessage: function (type, message) {
        console.log(`[${type.toUpperCase()}]: ${message}`);
    },

    addAgentStep: function (message, status) {
        console.log(`Agent Step [${status}]: ${message}`);
    },

    async callTool(toolBase, name, args) {
        try {
            console.log(`Calling tool: ${name} with args:`, args);

            const response = await fetch(`${toolBase}/${name}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(args || {})
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`${name} failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log(`Tool ${name} result:`, result);
            return result;
        } catch (error) {
            console.error(`Tool call failed for ${name}:`, error);
            this.addChatMessage('system', `🔧 Tool server bağlantısı başarısız. Tool server'ı başlatmak için terminalde: \`node tools-server.js\``);
            return {
                error: `Tool server connection failed. Please start the tool server with: node tools-server.js`,
                files: ['README.md', 'package.json', 'src/']
            };
        }
    }
};

// Test direct tool call
async function testDirectToolCall() {
    console.log('\n=== Testing Direct Tool Call ===');
    const result = await mockApp.callTool('http://localhost:7777/tool', 'list_dir', { dir: '.' });
    console.log('Direct tool call result:', result);
}

testDirectToolCall().catch(console.error);