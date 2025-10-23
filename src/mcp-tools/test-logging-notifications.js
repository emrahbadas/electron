/**
 * Test Logging and Notifications
 */

const { getLoggingManager } = require('./logging.js');
const { getNotificationsManager } = require('./notifications.js');

async function runTests() {
    console.log('🧪 Starting Logging & Notifications Tests...\n');
    
    let testsPassed = 0;
    let testsFailed = 0;
    
    try {
        const logger = getLoggingManager();
        const notifications = getNotificationsManager();
        
        // ========================================
        // LOGGING TESTS
        // ========================================
        
        // Test 1: Set log level
        console.log('Test 1: Set log level...');
        const setResult = await logger.setLevel({ level: 'debug' });
        
        if (setResult.success && setResult.level === 'debug') {
            console.log('✅ Test 1 PASSED: Log level set to debug');
            testsPassed++;
        } else {
            console.log('❌ Test 1 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // Test 2: Invalid log level
        console.log('Test 2: Invalid log level...');
        try {
            await logger.setLevel({ level: 'invalid' });
            console.log('❌ Test 2 FAILED: Should have thrown error');
            testsFailed++;
        } catch (error) {
            if (error.message.includes('Invalid log level')) {
                console.log('✅ Test 2 PASSED: Invalid level rejected');
                testsPassed++;
            } else {
                console.log('❌ Test 2 FAILED: Wrong error');
                testsFailed++;
            }
        }
        console.log('');
        
        // Test 3: Level filtering
        console.log('Test 3: Level filtering...');
        await logger.setLevel({ level: 'warning' });
        
        const debugEnabled = logger.isLevelEnabled('debug');
        const infoEnabled = logger.isLevelEnabled('info');
        const warningEnabled = logger.isLevelEnabled('warning');
        const errorEnabled = logger.isLevelEnabled('error');
        
        if (!debugEnabled && !infoEnabled && warningEnabled && errorEnabled) {
            console.log('✅ Test 3 PASSED: Level filtering works');
            console.log('   Debug: disabled, Info: disabled, Warning: enabled, Error: enabled');
            testsPassed++;
        } else {
            console.log('❌ Test 3 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // Test 4: Log methods
        console.log('Test 4: Log methods...');
        await logger.setLevel({ level: 'debug' });
        
        logger.debug('Debug message', { test: true });
        logger.info('Info message', { test: true });
        logger.warning('Warning message', { test: true });
        logger.error('Error message', { test: true });
        
        console.log('✅ Test 4 PASSED: All log methods work');
        testsPassed++;
        console.log('');
        
        // ========================================
        // NOTIFICATIONS TESTS
        // ========================================
        
        // Test 5: Send message
        console.log('Test 5: Send notification message...');
        const msgResult = await notifications.sendMessage({
            level: 'info',
            message: 'Test notification',
            metadata: { test: true }
        });
        
        if (msgResult.success && msgResult.messageId) {
            console.log('✅ Test 5 PASSED: Message sent');
            console.log(`   Message ID: ${msgResult.messageId}`);
            testsPassed++;
        } else {
            console.log('❌ Test 5 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // Test 6: Send initialized
        console.log('Test 6: Send initialized notification...');
        const initResult = await notifications.sendInitialized({
            clientInfo: { name: 'Test Client', version: '1.0.0' },
            serverCapabilities: { tools: true, prompts: true }
        });
        
        if (initResult.success && notifications.isInitialized()) {
            console.log('✅ Test 6 PASSED: Initialized notification sent');
            testsPassed++;
        } else {
            console.log('❌ Test 6 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // Test 7: Message queue
        console.log('Test 7: Message queue...');
        const messages = notifications.getMessages();
        
        if (messages.length > 0) {
            console.log('✅ Test 7 PASSED: Message queue works');
            console.log(`   Queue size: ${messages.length}`);
            testsPassed++;
        } else {
            console.log('❌ Test 7 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // Test 8: Progress notification
        console.log('Test 8: Progress notification...');
        const progressResult = await notifications.sendProgress({
            operationId: 'test-op',
            progress: 50,
            message: 'Halfway done'
        });
        
        if (progressResult.success && progressResult.progress === 50) {
            console.log('✅ Test 8 PASSED: Progress notification sent');
            testsPassed++;
        } else {
            console.log('❌ Test 8 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // Test 9: Error notification
        console.log('Test 9: Error notification...');
        const errorResult = await notifications.sendError({
            error: 'Test error',
            details: { code: 500 }
        });
        
        if (errorResult.success) {
            console.log('✅ Test 9 PASSED: Error notification sent');
            testsPassed++;
        } else {
            console.log('❌ Test 9 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // Test 10: Warning notification
        console.log('Test 10: Warning notification...');
        const warningResult = await notifications.sendWarning({
            warning: 'Test warning',
            details: { code: 400 }
        });
        
        if (warningResult.success) {
            console.log('✅ Test 10 PASSED: Warning notification sent');
            testsPassed++;
        } else {
            console.log('❌ Test 10 FAILED');
            testsFailed++;
        }
        console.log('');
        
        // ========================================
        // SUMMARY
        // ========================================
        console.log('='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Passed: ${testsPassed}`);
        console.log(`❌ Failed: ${testsFailed}`);
        console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
        console.log('='.repeat(60));
        
        if (testsFailed === 0) {
            console.log('\n🎉 ALL TESTS PASSED! Logging & Notifications working!');
        }
        
    } catch (error) {
        console.error('❌ TEST SUITE FAILED:', error);
        console.error(error.stack);
        testsFailed++;
    }
}

// Run tests
runTests().catch(console.error);
