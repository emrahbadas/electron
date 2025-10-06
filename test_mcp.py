#!/usr/bin/env python3
"""
MCP Server test script
Basit JSON-RPC test
"""
import json
import subprocess
import sys
import os

def test_mcp_server():
    # Server path
    server_path = os.path.join(os.path.dirname(__file__), 'src', 'mcp-tools', 'server.py')
    
    print(f"Testing MCP server: {server_path}")
    
    # Start server process
    process = subprocess.Popen(
        ['python', server_path],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=os.path.dirname(__file__)
    )
    
    # Test 1: List tools
    print("\n=== Test 1: List Tools ===")
    list_request = {
        "jsonrpc": "2.0",
        "method": "list_tools",
        "id": 1
    }
    
    process.stdin.write(json.dumps(list_request) + '\n')
    process.stdin.flush()
    
    response_line = process.stdout.readline()
    if response_line:
        response = json.loads(response_line.strip())
        print("Response:", json.dumps(response, indent=2, ensure_ascii=False))
    
    # Test 2: Hello World
    print("\n=== Test 2: Hello World ===")
    hello_request = {
        "jsonrpc": "2.0",
        "method": "call_tool",
        "params": {
            "name": "hello_world",
            "arguments": {
                "message": "Test from Python!"
            }
        },
        "id": 2
    }
    
    process.stdin.write(json.dumps(hello_request) + '\n')
    process.stdin.flush()
    
    response_line = process.stdout.readline()
    if response_line:
        response = json.loads(response_line.strip())
        print("Response:", json.dumps(response, indent=2, ensure_ascii=False))
    
    # Test 3: Create file
    print("\n=== Test 3: Create File ===")
    create_request = {
        "jsonrpc": "2.0",
        "method": "call_tool",
        "params": {
            "name": "create_file",
            "arguments": {
                "file_path": "test_output.txt",
                "content": "Bu bir test dosyasıdır!\nMCP Server çalışıyor!"
            }
        },
        "id": 3
    }
    
    process.stdin.write(json.dumps(create_request) + '\n')
    process.stdin.flush()
    
    response_line = process.stdout.readline()
    if response_line:
        response = json.loads(response_line.strip())
        print("Response:", json.dumps(response, indent=2, ensure_ascii=False))
    
    # Cleanup
    process.terminate()
    
    # Check if file was created
    if os.path.exists('test_output.txt'):
        print("\n✅ Test dosyası başarıyla oluşturuldu!")
        with open('test_output.txt', 'r', encoding='utf-8') as f:
            print("İçerik:", f.read())
        os.remove('test_output.txt')
    else:
        print("\n❌ Test dosyası oluşturulamadı")

if __name__ == "__main__":
    test_mcp_server()