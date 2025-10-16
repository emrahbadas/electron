import React, { useState, useEffect } from 'react';
import styles from './LearningDashboard.module.css';

/**
 * 📊 LEARNING DASHBOARD
 * 
 * Visualizes learned patterns from Learning Store
 * - Pattern list with frequency
 * - Success rate chart
 * - Reflection timeline
 */

interface Pattern {
    id: string;
    count: number;
    firstSeen: number;
    lastSeen: number;
    rootCause: string;
    fixes: Array<{
        timestamp: number;
        fix: string;
        mission: string;
    }>;
}

interface Stats {
    totalReflections: number;
    successfulFixes: number;
    failedFixes: number;
    totalPatterns: number;
    successRate: string;
    topPatterns: Pattern[];
}

interface Reflection {
    timestamp: number;
    mission: string;
    step: string;
    tool: string;
    error: string;
    rootCause: string;
    fix: string;
    result: 'PASS' | 'FAIL';
    pattern: string | null;
}

export const LearningDashboard: React.FC = () => {
    const [stats, setStats] = useState<Stats | null>(null);
    const [reflections, setReflections] = useState<Reflection[]>([]);
    const [selectedPattern, setSelectedPattern] = useState<Pattern | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        loadData();
        
        // Refresh every 5 seconds
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        try {
            // Access Learning Store from window (set by app.js)
            const learningStore = (window as any).kodCanavari?.learningStore;
            
            if (!learningStore) {
                console.warn('Learning Store not available yet');
                return;
            }

            const newStats = learningStore.getStats();
            const newReflections = learningStore.loadReflections(20); // Last 20
            
            setStats(newStats);
            setReflections(newReflections);
        } catch (error) {
            console.error('Failed to load learning data:', error);
        }
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatRelativeTime = (timestamp: number) => {
        const minutes = Math.floor((Date.now() - timestamp) / 1000 / 60);
        if (minutes < 1) return 'az önce';
        if (minutes < 60) return `${minutes} dakika önce`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} saat önce`;
        const days = Math.floor(hours / 24);
        return `${days} gün önce`;
    };

    if (!isExpanded) {
        return (
            <div className={styles.minimized} onClick={() => setIsExpanded(true)}>
                <span className={styles.icon}>🧠</span>
                <span className={styles.label}>Learning</span>
                {stats && (
                    <span className={styles.badge}>{stats.totalPatterns}</span>
                )}
            </div>
        );
    }

    return (
        <div className={styles.dashboard}>
            <div className={styles.header}>
                <h2>
                    <span className={styles.icon}>🧠</span>
                    Learning Dashboard
                </h2>
                <button 
                    className={styles.closeBtn}
                    onClick={() => setIsExpanded(false)}
                >
                    ✕
                </button>
            </div>

            {!stats ? (
                <div className={styles.loading}>
                    <div className={styles.spinner}></div>
                    <p>Loading learning data...</p>
                </div>
            ) : (
                <>
                    {/* Stats Overview */}
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{stats.totalReflections}</div>
                            <div className={styles.statLabel}>Total Reflections</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{stats.successfulFixes}</div>
                            <div className={styles.statLabel}>Successful Fixes</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{stats.totalPatterns}</div>
                            <div className={styles.statLabel}>Learned Patterns</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statValue}>{stats.successRate}%</div>
                            <div className={styles.statLabel}>Success Rate</div>
                        </div>
                    </div>

                    {/* Top Patterns */}
                    <div className={styles.section}>
                        <h3>📈 Top Patterns</h3>
                        {stats.topPatterns.length === 0 ? (
                            <p className={styles.emptyState}>No patterns learned yet. System will learn from FAIL→PASS cycles.</p>
                        ) : (
                            <div className={styles.patternList}>
                                {stats.topPatterns.map((pattern) => (
                                    <div 
                                        key={pattern.id}
                                        className={`${styles.patternCard} ${selectedPattern?.id === pattern.id ? styles.selected : ''}`}
                                        onClick={() => setSelectedPattern(pattern)}
                                    >
                                        <div className={styles.patternHeader}>
                                            <span className={styles.patternId}>{pattern.id}</span>
                                            <span className={styles.patternCount}>
                                                {pattern.count}x
                                            </span>
                                        </div>
                                        <div className={styles.patternRoot}>
                                            <strong>Root Cause:</strong> {pattern.rootCause}
                                        </div>
                                        <div className={styles.patternFix}>
                                            <strong>Fix:</strong> {pattern.fixes[0].fix}
                                        </div>
                                        <div className={styles.patternMeta}>
                                            Last seen: {formatRelativeTime(pattern.lastSeen)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pattern Details */}
                    {selectedPattern && (
                        <div className={styles.section}>
                            <h3>🔍 Pattern Details: {selectedPattern.id}</h3>
                            <div className={styles.patternDetails}>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Occurrences:</span>
                                    <span className={styles.detailValue}>{selectedPattern.count}</span>
                                </div>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>First Seen:</span>
                                    <span className={styles.detailValue}>{formatDate(selectedPattern.firstSeen)}</span>
                                </div>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Last Seen:</span>
                                    <span className={styles.detailValue}>{formatDate(selectedPattern.lastSeen)}</span>
                                </div>
                                
                                <h4>📝 All Fixes ({selectedPattern.fixes.length})</h4>
                                <div className={styles.fixHistory}>
                                    {selectedPattern.fixes.map((fix, index) => (
                                        <div key={index} className={styles.fixCard}>
                                            <div className={styles.fixMission}>{fix.mission}</div>
                                            <div className={styles.fixContent}>{fix.fix}</div>
                                            <div className={styles.fixDate}>{formatDate(fix.timestamp)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recent Reflections Timeline */}
                    <div className={styles.section}>
                        <h3>⏱️ Recent Reflections</h3>
                        {reflections.length === 0 ? (
                            <p className={styles.emptyState}>No reflections yet.</p>
                        ) : (
                            <div className={styles.timeline}>
                                {reflections.map((reflection, index) => (
                                    <div 
                                        key={index}
                                        className={`${styles.timelineItem} ${styles[reflection.result.toLowerCase()]}`}
                                    >
                                        <div className={styles.timelineIcon}>
                                            {reflection.result === 'PASS' ? '✅' : '❌'}
                                        </div>
                                        <div className={styles.timelineContent}>
                                            <div className={styles.timelineHeader}>
                                                <span className={styles.timelineMission}>{reflection.mission}</span>
                                                <span className={styles.timelineDate}>{formatRelativeTime(reflection.timestamp)}</span>
                                            </div>
                                            <div className={styles.timelineStep}>
                                                {reflection.step} • {reflection.tool}
                                            </div>
                                            {reflection.error && (
                                                <div className={styles.timelineError}>
                                                    ❌ {reflection.error}
                                                </div>
                                            )}
                                            {reflection.fix && (
                                                <div className={styles.timelineFix}>
                                                    🔧 {reflection.fix}
                                                </div>
                                            )}
                                            {reflection.pattern && (
                                                <div className={styles.timelinePattern}>
                                                    🏷️ Pattern: {reflection.pattern}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className={styles.actions}>
                        <button 
                            className={styles.refreshBtn}
                            onClick={loadData}
                        >
                            🔄 Refresh
                        </button>
                        <button 
                            className={styles.exportBtn}
                            onClick={() => {
                                const data = JSON.stringify({ stats, reflections }, null, 2);
                                const blob = new Blob([data], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `learning-data-${Date.now()}.json`;
                                a.click();
                            }}
                        >
                            💾 Export Data
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
