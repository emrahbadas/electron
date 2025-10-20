/**
 * 🎼 AGENT HIERARCHY SYSTEM
 * 
 * VS Code Copilot tarzı katı orkestra sistemi.
 * Luma Supreme'in kararları ASLA override edilemez.
 * 
 * Inspired by: VS Code Copilot Orchestration Architecture
 * Author: KayraDeniz v2.1 Adaptive Evolution
 * Date: 2025-10-20
 */

/**
 * Agent Hierarchy Levels
 * - ORCHESTRATOR (Level 0): Supreme decision maker (Luma Supreme)
 * - SPECIALIST (Level 1): Domain experts (Generator, Executor)
 * - WORKER (Level 2): Tool executors (MCP Tools)
 */
const AGENT_LEVELS = {
    ORCHESTRATOR: 0,  // Luma Supreme
    SPECIALIST: 1,    // Generator, Executor, Analyzer
    WORKER: 2         // Tool Bridge, MCP Tools
};

/**
 * Agent Definitions with hierarchy metadata
 */
const AGENT_REGISTRY = {
    'LumaSupremeAgent': {
        level: AGENT_LEVELS.ORCHESTRATOR,
        canOverride: ['GeneratorAgent', 'ExecutorAgent', 'AnalyzerAgent', 'RouterAgent'],
        canBeOverridden: false, // ❌ ASLA OVERRIDE EDİLEMEZ
        description: 'Supreme cognitive orchestrator',
        decisionIsFinal: true
    },
    'GeneratorAgent': {
        level: AGENT_LEVELS.SPECIALIST,
        canOverride: ['ExecutorAgent'],
        canBeOverridden: ['LumaSupremeAgent'],
        description: 'Code generation specialist'
    },
    'ExecutorAgent': {
        level: AGENT_LEVELS.SPECIALIST,
        canOverride: [],
        canBeOverridden: ['LumaSupremeAgent', 'GeneratorAgent'],
        description: 'Execution specialist'
    },
    'RouterAgent': {
        level: AGENT_LEVELS.SPECIALIST,
        canOverride: [],
        canBeOverridden: ['LumaSupremeAgent'], // ❌ Luma tarafından override edilebilir
        description: 'Intent routing specialist'
    },
    'AnalyzerAgent': {
        level: AGENT_LEVELS.SPECIALIST,
        canOverride: [],
        canBeOverridden: ['LumaSupremeAgent'],
        description: 'Code analysis specialist'
    }
};

/**
 * Decision Chain Validator
 * 
 * Bir agent'ın kararını başka bir agent'ın override edip edemeyeceğini kontrol eder.
 * 
 * @param {string} decisionMaker - Kararı veren agent
 * @param {string} overrideAttempt - Override etmeye çalışan agent
 * @returns {boolean} Override edilebilir mi?
 */
function canOverrideDecision(decisionMaker, overrideAttempt) {
    const maker = AGENT_REGISTRY[decisionMaker];
    const attempter = AGENT_REGISTRY[overrideAttempt];
    
    if (!maker || !attempter) {
        console.warn(`⚠️ Unknown agent: ${decisionMaker} or ${overrideAttempt}`);
        return false;
    }
    
    // Rule 1: Orchestrator ASLA override edilemez
    if (maker.level === AGENT_LEVELS.ORCHESTRATOR) {
        console.log(`🚫 OVERRIDE REJECTED: ${decisionMaker} is ORCHESTRATOR (Level 0) - FINAL!`);
        return false;
    }
    
    // Rule 2: Aynı seviye override edemez
    if (maker.level === attempter.level) {
        console.log(`🚫 OVERRIDE REJECTED: Same hierarchy level (${maker.level})`);
        return false;
    }
    
    // Rule 3: Alt seviye üst seviyeyi override edemez
    if (attempter.level > maker.level) {
        console.log(`🚫 OVERRIDE REJECTED: ${overrideAttempt} (Level ${attempter.level}) cannot override ${decisionMaker} (Level ${maker.level})`);
        return false;
    }
    
    // Rule 4: Üst seviye alt seviyeyi override edebilir
    if (attempter.level < maker.level) {
        console.log(`✅ OVERRIDE ALLOWED: ${overrideAttempt} (Level ${attempter.level}) can override ${decisionMaker} (Level ${maker.level})`);
        return true;
    }
    
    return false;
}

/**
 * Decision Wrapper
 * 
 * Bir agent kararını hierarchy metadata ile sarmallar.
 * 
 * @param {string} agentName - Agent adı
 * @param {object} decision - Karar objesi
 * @returns {object} Hierarchy metadata ile zenginleştirilmiş karar
 */
function wrapDecision(agentName, decision) {
    const agentMeta = AGENT_REGISTRY[agentName];
    
    if (!agentMeta) {
        console.warn(`⚠️ Unknown agent: ${agentName}, using default hierarchy`);
        return {
            ...decision,
            _hierarchy: {
                agent: agentName,
                level: AGENT_LEVELS.WORKER,
                isFinal: false,
                timestamp: Date.now()
            }
        };
    }
    
    return {
        ...decision,
        _hierarchy: {
            agent: agentName,
            level: agentMeta.level,
            isFinal: agentMeta.decisionIsFinal || false,
            canBeOverridden: agentMeta.canBeOverridden,
            canOverride: agentMeta.canOverride,
            timestamp: Date.now()
        }
    };
}

/**
 * Validate Decision Override Attempt
 * 
 * Bir override denemesini doğrular ve izin veriliyorsa yeni kararı döndürür.
 * 
 * @param {object} existingDecision - Mevcut karar (hierarchy metadata ile)
 * @param {string} newAgentName - Yeni karar veren agent
 * @param {object} newDecision - Yeni karar
 * @returns {object} { allowed: boolean, decision: object, reason: string }
 */
function validateOverride(existingDecision, newAgentName, newDecision) {
    if (!existingDecision || !existingDecision._hierarchy) {
        // İlk karar, override değil
        return {
            allowed: true,
            decision: wrapDecision(newAgentName, newDecision),
            reason: 'First decision (no existing decision to override)'
        };
    }
    
    const existingAgent = existingDecision._hierarchy.agent;
    
    // Orchestrator (Luma) kararı ASLA override edilemez
    if (existingDecision._hierarchy.isFinal) {
        return {
            allowed: false,
            decision: existingDecision, // Eski kararı koru
            reason: `${existingAgent} decision is FINAL (Orchestrator level) - cannot be overridden`
        };
    }
    
    // Hierarchy kurallarına göre kontrol et
    const canOverride = canOverrideDecision(existingAgent, newAgentName);
    
    if (canOverride) {
        return {
            allowed: true,
            decision: wrapDecision(newAgentName, newDecision),
            reason: `${newAgentName} has higher authority than ${existingAgent}`
        };
    } else {
        return {
            allowed: false,
            decision: existingDecision, // Eski kararı koru
            reason: `${newAgentName} cannot override ${existingAgent} (hierarchy violation)`
        };
    }
}

/**
 * Get Agent Level Name
 * 
 * @param {number} level - Agent level
 * @returns {string} Level adı
 */
function getLevelName(level) {
    switch (level) {
        case AGENT_LEVELS.ORCHESTRATOR: return 'ORCHESTRATOR';
        case AGENT_LEVELS.SPECIALIST: return 'SPECIALIST';
        case AGENT_LEVELS.WORKER: return 'WORKER';
        default: return 'UNKNOWN';
    }
}

/**
 * Log Decision Chain
 * 
 * Karar zincirini görselleştirir.
 * 
 * @param {object[]} decisions - Karar dizisi
 */
function logDecisionChain(decisions) {
    console.log('\n🎼 ====== DECISION CHAIN ====== 🎼');
    
    decisions.forEach((decision, index) => {
        const meta = decision._hierarchy;
        if (!meta) {
            console.log(`${index + 1}. [UNKNOWN] Decision without hierarchy metadata`);
            return;
        }
        
        const levelName = getLevelName(meta.level);
        const finalBadge = meta.isFinal ? '🔒 FINAL' : '🔓';
        
        console.log(`${index + 1}. [${levelName}] ${meta.agent} ${finalBadge}`);
        console.log(`   Timestamp: ${new Date(meta.timestamp).toLocaleTimeString()}`);
        console.log(`   Can Override: ${meta.canOverride?.join(', ') || 'none'}`);
        console.log(`   Can Be Overridden: ${meta.canBeOverridden ? meta.canBeOverridden.join(', ') : 'false'}`);
    });
    
    console.log('🎼 ====== END CHAIN ====== 🎼\n');
}

// Export functions
module.exports = {
    AGENT_LEVELS,
    AGENT_REGISTRY,
    canOverrideDecision,
    wrapDecision,
    validateOverride,
    getLevelName,
    logDecisionChain
};
