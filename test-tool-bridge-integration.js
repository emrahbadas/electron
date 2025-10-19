/**
 * TOOL BRIDGE INTEGRATION TEST
 * 
 * Bu script Tool Bridge sisteminin gerçek bir proje senaryosunda
 * düzgün çalışıp çalışmadığını test eder.
 * 
 * Test senaryosu: Basit bir Node.js projesi oluşturma
 */

console.log('🧪 TOOL BRIDGE INTEGRATION TEST BAŞLIYOR...\n');

// Test workspace'i
const TEST_WORKSPACE = 'C:\\Users\\emrah badas\\OneDrive\\Desktop\\test-tool-bridge';

// Tool Bridge kontrolü
if (!window.toolBridge) {
    console.error('❌ HATA: Tool Bridge yüklenmemiş!');
    console.log('💡 Çözüm: Electron uygulamasını yeniden başlatın.');
    throw new Error('Tool Bridge not loaded');
}

if (!window.kodCanavari) {
    console.error('❌ HATA: kodCanavari yüklenmemiş!');
    throw new Error('kodCanavari not loaded');
}

console.log('✅ Tool Bridge yüklendi');
console.log('✅ kodCanavari yüklendi\n');

// Test fonksiyonu
async function runToolBridgeTests() {
    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    // TEST 1: fs.write - package.json oluşturma
    console.log('📝 TEST 1: fs.write - package.json oluşturma');
    try {
        const packageJson = {
            name: 'tool-bridge-test-project',
            version: '1.0.0',
            description: 'Tool Bridge integration test',
            main: 'index.js',
            scripts: {
                start: 'node index.js',
                test: 'echo "Test passed"'
            },
            author: 'KayraDeniz',
            license: 'MIT'
        };

        const result = await window.toolBridge.executeTool('fs.write', {
            path: `${TEST_WORKSPACE}/package.json`,
            content: JSON.stringify(packageJson, null, 2)
        });

        if (result.success) {
            console.log('✅ package.json oluşturuldu');
            results.passed++;
            results.tests.push({name: 'fs.write (package.json)', status: 'PASS'});
        } else {
            throw new Error(result.error || 'Unknown error');
        }
    } catch (error) {
        console.error('❌ HATA:', error.message);
        results.failed++;
        results.tests.push({name: 'fs.write (package.json)', status: 'FAIL', error: error.message});
    }

    // TEST 2: fs.write - index.js oluşturma
    console.log('\n📝 TEST 2: fs.write - index.js oluşturma');
    try {
        const indexContent = `// Tool Bridge Test Project
console.log('Hello from Tool Bridge Test!');

function add(a, b) {
    return a + b;
}

function multiply(a, b) {
    return a * b;
}

// Test
console.log('2 + 3 =', add(2, 3));
console.log('4 * 5 =', multiply(4, 5));

module.exports = { add, multiply };
`;

        const result = await window.toolBridge.executeTool('fs.write', {
            path: `${TEST_WORKSPACE}/index.js`,
            content: indexContent
        });

        if (result.success) {
            console.log('✅ index.js oluşturuldu');
            results.passed++;
            results.tests.push({name: 'fs.write (index.js)', status: 'PASS'});
        } else {
            throw new Error(result.error || 'Unknown error');
        }
    } catch (error) {
        console.error('❌ HATA:', error.message);
        results.failed++;
        results.tests.push({name: 'fs.write (index.js)', status: 'FAIL', error: error.message});
    }

    // TEST 3: fs.write - README.md oluşturma
    console.log('\n📝 TEST 3: fs.write - README.md oluşturma');
    try {
        const readmeContent = `# Tool Bridge Test Project

Bu proje **KayraDeniz Tool Bridge** sisteminin entegrasyon testidir.

## Özellikler

- ✅ Basit matematik fonksiyonları
- ✅ Node.js modül yapısı
- ✅ Test script'leri

## Kurulum

\`\`\`bash
npm install
\`\`\`

## Kullanım

\`\`\`bash
npm start
\`\`\`

## Test

\`\`\`bash
npm test
\`\`\`

## Geliştirici

- **KayraDeniz Kod Canavarı**
- Tool Bridge System v2.0
- Test Date: ${new Date().toLocaleDateString('tr-TR')}
`;

        const result = await window.toolBridge.executeTool('fs.write', {
            path: `${TEST_WORKSPACE}/README.md`,
            content: readmeContent
        });

        if (result.success) {
            console.log('✅ README.md oluşturuldu');
            results.passed++;
            results.tests.push({name: 'fs.write (README.md)', status: 'PASS'});
        } else {
            throw new Error(result.error || 'Unknown error');
        }
    } catch (error) {
        console.error('❌ HATA:', error.message);
        results.failed++;
        results.tests.push({name: 'fs.write (README.md)', status: 'FAIL', error: error.message});
    }

    // TEST 4: fs.read - package.json okuma
    console.log('\n📖 TEST 4: fs.read - package.json okuma');
    try {
        const result = await window.toolBridge.executeTool('fs.read', {
            path: `${TEST_WORKSPACE}/package.json`
        });

        if (result.success && result.data) {
            const parsed = JSON.parse(result.data);
            if (parsed.name === 'tool-bridge-test-project') {
                console.log('✅ package.json okundu ve doğrulandı');
                results.passed++;
                results.tests.push({name: 'fs.read (package.json)', status: 'PASS'});
            } else {
                throw new Error('Content mismatch');
            }
        } else {
            throw new Error(result.error || 'Read failed');
        }
    } catch (error) {
        console.error('❌ HATA:', error.message);
        results.failed++;
        results.tests.push({name: 'fs.read (package.json)', status: 'FAIL', error: error.message});
    }

    // TEST 5: fs.exists - dosya kontrolü
    console.log('\n🔍 TEST 5: fs.exists - dosya kontrolü');
    try {
        const result = await window.toolBridge.executeTool('fs.exists', {
            path: `${TEST_WORKSPACE}/index.js`
        });

        if (result.success && result.exists === true) {
            console.log('✅ index.js varlığı doğrulandı');
            results.passed++;
            results.tests.push({name: 'fs.exists (index.js)', status: 'PASS'});
        } else {
            throw new Error('File not found');
        }
    } catch (error) {
        console.error('❌ HATA:', error.message);
        results.failed++;
        results.tests.push({name: 'fs.exists (index.js)', status: 'FAIL', error: error.message});
    }

    // TEST 6: terminal.exec - npm test çalıştırma
    console.log('\n⚡ TEST 6: terminal.exec - npm test');
    try {
        const result = await window.toolBridge.executeTool('terminal.exec', {
            cmd: 'npm test',
            cwd: TEST_WORKSPACE
        });

        if (result.success) {
            console.log('✅ npm test çalıştırıldı');
            console.log('   Output:', result.output?.substring(0, 100) + '...');
            results.passed++;
            results.tests.push({name: 'terminal.exec (npm test)', status: 'PASS'});
        } else {
            throw new Error(result.error || 'Command failed');
        }
    } catch (error) {
        console.error('❌ HATA:', error.message);
        results.failed++;
        results.tests.push({name: 'terminal.exec (npm test)', status: 'FAIL', error: error.message});
    }

    // TEST 7: fs.multiEdit - Çoklu dosya düzenleme
    console.log('\n✏️ TEST 7: fs.multiEdit - Çoklu dosya düzenleme');
    try {
        const edits = [
            {
                path: `${TEST_WORKSPACE}/utils.js`,
                content: `// Utility functions
module.exports = {
    square: (n) => n * n,
    cube: (n) => n * n * n
};
`
            },
            {
                path: `${TEST_WORKSPACE}/constants.js`,
                content: `// Constants
module.exports = {
    PI: 3.14159,
    E: 2.71828
};
`
            }
        ];

        const result = await window.toolBridge.executeTool('fs.multiEdit', {
            edits: edits
        });

        if (result.success) {
            console.log('✅ Çoklu dosya oluşturuldu (utils.js, constants.js)');
            results.passed++;
            results.tests.push({name: 'fs.multiEdit (2 files)', status: 'PASS'});
        } else {
            throw new Error(result.error || 'Multi-edit failed');
        }
    } catch (error) {
        console.error('❌ HATA:', error.message);
        results.failed++;
        results.tests.push({name: 'fs.multiEdit', status: 'FAIL', error: error.message});
    }

    // TEST 8: Tool aliasing - fs.readFile → fs.read
    console.log('\n🔄 TEST 8: Tool aliasing - fs.readFile');
    try {
        const result = await window.toolBridge.executeTool('fs.readFile', {
            path: `${TEST_WORKSPACE}/README.md`
        });

        if (result.success && result.data) {
            console.log('✅ fs.readFile (alias) çalıştı → fs.read\'e yönlendirildi');
            results.passed++;
            results.tests.push({name: 'Tool aliasing (fs.readFile)', status: 'PASS'});
        } else {
            throw new Error('Alias failed');
        }
    } catch (error) {
        console.error('❌ HATA:', error.message);
        results.failed++;
        results.tests.push({name: 'Tool aliasing', status: 'FAIL', error: error.message});
    }

    // SONUÇ RAPORU
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SONUÇLARI');
    console.log('='.repeat(60));
    console.log(`✅ Başarılı: ${results.passed}`);
    console.log(`❌ Başarısız: ${results.failed}`);
    console.log(`📈 Başarı Oranı: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
    console.log('\n📋 Detaylı Sonuçlar:');
    results.tests.forEach((test, index) => {
        const icon = test.status === 'PASS' ? '✅' : '❌';
        console.log(`${index + 1}. ${icon} ${test.name} - ${test.status}`);
        if (test.error) {
            console.log(`   └─ Hata: ${test.error}`);
        }
    });
    console.log('='.repeat(60));

    // Tool Bridge log kontrolü
    console.log('\n📜 TOOL BRIDGE EXECUTION LOG:');
    const log = window.toolBridge.getLog();
    console.log(`Son ${log.length} işlem kaydedildi:`);
    log.slice(-5).forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.tool} - ${entry.success ? 'SUCCESS' : 'FAIL'}`);
    });

    return results;
}

// Test'i çalıştır
console.log('🚀 Test başlatılıyor...\n');
runToolBridgeTests()
    .then(results => {
        console.log('\n✨ Test tamamlandı!');
        if (results.failed === 0) {
            console.log('🎉 TÜM TESTLER BAŞARILI!');
        } else {
            console.log(`⚠️ ${results.failed} test başarısız oldu.`);
        }
    })
    .catch(error => {
        console.error('\n💥 Test sırasında kritik hata:', error);
    });
