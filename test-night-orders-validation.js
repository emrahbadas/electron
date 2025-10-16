/**
 * 🧪 Night Orders Validation Test
 * 
 * Test Zod + parseArgs validation
 */

const { validateNightOrders: zodValidate } = require('./src/renderer/schemas');
const { validateNightOrders: parseArgsValidate } = require('./src/renderer/utils/parseArgs');

console.log('🧪 Testing Night Orders Validation System...\n');

// ===== TEST 1: Valid Night Orders =====
console.log('📝 Test 1: Valid Night Orders');
const validOrders = {
    mission: 'Create a simple Node.js project',
    acceptance: ['build: exit 0', 'files: package.json exists'],
    steps: [
        {
            id: 'S1',
            tool: 'fs.write',
            args: {
                path: 'package.json',
                content: '{"name": "test", "version": "1.0.0"}'
            },
            explain: {
                goal: 'Create package.json for Node.js project initialization',
                rationale: 'Every Node.js project needs a package.json to manage dependencies and scripts'
            },
            verify: ['lint', 'build']
        }
    ]
};

try {
    const zodResult = zodValidate(validOrders);
    console.log('Zod validation:', zodResult.valid ? '✅ PASS' : '❌ FAIL', zodResult.errors || '');
    
    const parseResult = parseArgsValidate(validOrders);
    console.log('parseArgs validation: ✅ PASS');
    console.log('');
} catch (error) {
    console.log('❌ FAIL:', error.message);
    console.log('');
}

// ===== TEST 2: Missing Required Field =====
console.log('📝 Test 2: Missing required field (mission)');
const invalidOrders1 = {
    acceptance: ['build: exit 0'],
    steps: []
};

try {
    const zodResult = zodValidate(invalidOrders1);
    console.log('Zod validation:', zodResult.valid ? '✅ PASS' : '❌ FAIL (expected)');
    console.log('Errors:', zodResult.errors);
    console.log('');
} catch (error) {
    console.log('❌ Exception:', error.message);
    console.log('');
}

// ===== TEST 3: Invalid Tool Name =====
console.log('📝 Test 3: Invalid tool name');
const invalidOrders2 = {
    mission: 'Test invalid tool',
    acceptance: ['build: exit 0'],
    steps: [
        {
            id: 'S1',
            tool: 'invalid_tool',
            args: {}
        }
    ]
};

try {
    const zodResult = zodValidate(invalidOrders2);
    console.log('Zod validation:', zodResult.valid ? '✅ PASS' : '❌ FAIL (expected)');
    console.log('Errors:', zodResult.errors);
    console.log('');
} catch (error) {
    console.log('❌ Exception:', error.message);
    console.log('');
}

// ===== TEST 4: Missing Tool Arguments =====
console.log('📝 Test 4: Missing tool arguments (fs.write without content)');
const invalidOrders3 = {
    mission: 'Test missing args',
    acceptance: ['build: exit 0'],
    steps: [
        {
            id: 'S1',
            tool: 'fs.write',
            args: {
                path: 'file.txt'
                // Missing: content
            }
        }
    ]
};

try {
    const zodResult = zodValidate(invalidOrders3);
    console.log('Zod validation:', zodResult.valid ? '✅ PASS' : '❌ FAIL');
    
    if (zodResult.valid) {
        parseArgsValidate(invalidOrders3);
        console.log('parseArgs validation: ✅ PASS');
    }
} catch (error) {
    console.log('parseArgs validation: ❌ FAIL (expected)');
    console.log('Error:', error.message);
    console.log('');
}

// ===== TEST 5: Explain Too Short =====
console.log('📝 Test 5: Explain goal too short (<30 chars)');
const invalidOrders4 = {
    mission: 'Test explain validation',
    acceptance: ['build: exit 0'],
    steps: [
        {
            id: 'S1',
            tool: 'fs.write',
            args: {
                path: 'file.txt',
                content: 'test'
            },
            explain: {
                goal: 'Short',  // Too short
                rationale: 'This is a rationale that is long enough to pass validation'
            }
        }
    ]
};

try {
    const zodResult = zodValidate(invalidOrders4);
    console.log('Zod validation:', zodResult.valid ? '✅ PASS' : '❌ FAIL (expected)');
    console.log('Errors:', zodResult.errors);
    console.log('');
} catch (error) {
    console.log('❌ Exception:', error.message);
    console.log('');
}

// ===== TEST 6: Multi-Edit Tool =====
console.log('📝 Test 6: Multi-Edit tool with edits');
const multiEditOrders = {
    mission: 'Test multi-edit functionality',
    acceptance: ['build: exit 0'],
    steps: [
        {
            id: 'S1',
            tool: 'fs.multiEdit',
            args: {
                filepath: 'app.js',
                edits: [
                    {
                        old_string: 'const a = 1',
                        new_string: 'const a = 2'
                    },
                    {
                        old_string: 'oldFunction()',
                        new_string: 'newFunction()',
                        replace_all: true
                    }
                ]
            },
            explain: {
                goal: 'Update variables and function calls atomically',
                rationale: 'Using multi-edit ensures all changes apply together or none at all'
            }
        }
    ]
};

try {
    const zodResult = zodValidate(multiEditOrders);
    console.log('Zod validation:', zodResult.valid ? '✅ PASS' : '❌ FAIL');
    
    if (zodResult.valid) {
        parseArgsValidate(multiEditOrders);
        console.log('parseArgs validation: ✅ PASS');
    }
} catch (error) {
    console.log('❌ FAIL:', error.message);
}

console.log('\n✅ All tests completed!');
