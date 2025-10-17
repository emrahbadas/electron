/* eslint-disable no-inline-styles */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  NarrationState,
  NarrationBeforeEvent,
  NarrationAfterEvent,
  NarrationVerifyEvent,
  ProbeResult,
  TeachingMoment
} from '../../types/contracts';
import { getLegacyRunner } from '../adapters/legacy-runner';
import styles from './UstaModu.module.css';

// Extended StepNarration with phase tracking + teaching
interface StepNarration {
  stepId: string;
  phase: 'before' | 'after' | 'verify';
  timestamp: Date;
  goal?: string;
  rationale?: string;
  success?: boolean;
  output?: string;
  results?: ProbeResult[];
  teachingMoment?: TeachingMoment; // 🎓 NEW: Eğitim içeriği
}

interface UstaModuProps {
  maxMessages?: number;
  dedupWindowMs?: number;
  rateLimit?: number;
}

export const UstaModu: React.FC<UstaModuProps> = ({
  maxMessages = 50,
  dedupWindowMs = 2000,
  rateLimit = 50 // 🔧 Daha hızlı event işleme için azaltıldı
}) => {
  // State Management
  const [state, setState] = useState<NarrationState>('PLANNING');
  const [messages, setMessages] = useState<StepNarration[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 470, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Refs for optimization
  const messageHashMap = useRef(new Map<string, number>());
  const lastEventTime = useRef(0);
  const unsubscribers = useRef<(() => void)[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPerStepPhase = useRef(new Map<string, string>()); // "stepId|phase" -> lastPayloadDigest

  // 🎓 Payload digest for stronger deduplication
  const payloadDigest = useCallback((msg: StepNarration): string => {
    const base = {
      g: msg.goal || '',
      r: msg.rationale || '',
      o: msg.output || '',
      res: msg.results ? msg.results.map(p => `${p.type}:${p.status}`).join('|') : '',
      tm: msg.teachingMoment ? JSON.stringify(msg.teachingMoment) : ''
    };
    return JSON.stringify(base);
  }, []);

  // Dedupe helper - now with payload digest
  const generateHash = useCallback((msg: StepNarration): string => {
    const dig = payloadDigest(msg);
    return `${msg.stepId}-${msg.phase}-${dig}`;
  }, [payloadDigest]);

  // Rate limiter
  const shouldProcessEvent = useCallback((): boolean => {
    const now = Date.now();
    if (now - lastEventTime.current < rateLimit) {
      return false;
    }
    lastEventTime.current = now;
    return true;
  }, [rateLimit]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Add message with deduplication (STRENGTHENED)
  const addMessage = useCallback((msg: StepNarration) => {
    const hash = generateHash(msg);
    const now = Date.now();

    // 1) Zaman penceresinde aynı hash geldiyse at
    const lastSeen = messageHashMap.current.get(hash) || 0;
    if (now - lastSeen < dedupWindowMs) {
      // console.log('[UstaModu] Dedupe hash hit:', hash);
      return;
    }

    // 2) Aynı step+phase için son payloadDigest ile aynıysa at
    const key = `${msg.stepId}|${msg.phase}`;
    const dig = payloadDigest(msg);
    const lastDig = lastPerStepPhase.current.get(key);
    if (lastDig === dig) {
      // console.log('[UstaModu] Dedupe digest match:', key);
      return;
    }
    lastPerStepPhase.current.set(key, dig);

    messageHashMap.current.set(hash, now);

    setMessages(prev => {
      const updated = [...prev, msg];
      // Keep only last N messages
      if (updated.length > maxMessages) {
        return updated.slice(updated.length - maxMessages);
      }
      return updated;
    });

    setTimeout(scrollToBottom, 50);
  }, [generateHash, payloadDigest, dedupWindowMs, maxMessages, scrollToBottom]);

  // Event handlers
  const handleNarrationBefore = useCallback((event: NarrationBeforeEvent) => {
    console.log('[UstaModu] BEFORE event received:', event);
    if (!shouldProcessEvent()) {
      console.log('[UstaModu] BEFORE event rate-limited');
      return;
    }
    if (!event.data) {
      console.log('[UstaModu] BEFORE event has no data!');
      return;
    }

    setState('PLANNING');
    setCurrentStep(event.data.stepId);

    addMessage({
      stepId: event.data.stepId,
      phase: 'before',
      goal: event.data.explain?.goal,
      rationale: event.data.explain?.rationale,
      teachingMoment: event.data.explain?.teachingMoment, // 🎓 Eğitim içeriğini aktar
      timestamp: new Date(event.timestamp)
    });
  }, [shouldProcessEvent, addMessage]);

  const handleNarrationAfter = useCallback((event: NarrationAfterEvent) => {
    if (!shouldProcessEvent() || !event.data) return;

    setState('EXECUTING');

    addMessage({
      stepId: event.data.stepId,
      phase: 'after',
      success: true, // After event means it executed
      output: event.data.summary,
      timestamp: new Date(event.timestamp)
    });
  }, [shouldProcessEvent, addMessage]);

  const handleNarrationVerify = useCallback((event: NarrationVerifyEvent) => {
    if (!shouldProcessEvent() || !event.data) return;

    setState('VERIFYING');

    addMessage({
      stepId: event.data.stepId,
      phase: 'verify',
      results: event.data.probes,
      timestamp: new Date(event.timestamp)
    });

    // After verify, go to reflecting
    setTimeout(() => setState('REFLECTING'), 500);
    setTimeout(() => {
      setState('PLANNING');
      setCurrentStep(null);
    }, 1500);
  }, [shouldProcessEvent, addMessage]);

  // Dragging handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Check if clicking on header (use ref check instead of closest)
    const target = e.target as HTMLElement;
    const headerElement = containerRef.current?.querySelector(`.${styles.header}`);
    
    if (headerElement && (target === headerElement || headerElement.contains(target))) {
      // Don't drag if clicking on buttons
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        return;
      }
      
      setIsDragging(true);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = Math.max(0, Math.min(window.innerWidth - 450, e.clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y));
      setPosition({ x: newX, y: newY });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Toggle collapse
  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // Subscribe to events on mount
  useEffect(() => {
    const runner = getLegacyRunner();

    const unsub1 = runner.subscribeToEvents('NARRATION_BEFORE', handleNarrationBefore as any);
    const unsub2 = runner.subscribeToEvents('NARRATION_AFTER', handleNarrationAfter as any);
    const unsub3 = runner.subscribeToEvents('NARRATION_VERIFY', handleNarrationVerify as any);

    unsubscribers.current = [unsub1, unsub2, unsub3];

    console.log('[UstaModu] React component mounted, event listeners registered');
    setIsVisible(true);

    return () => {
      unsubscribers.current.forEach(unsub => unsub());
      console.log('[UstaModu] React component unmounted, cleanup complete');
    };
  }, [handleNarrationBefore, handleNarrationAfter, handleNarrationVerify]);

  // Dragging effect
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Cleanup old hashes periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      messageHashMap.current.forEach((timestamp, hash) => {
        if (now - timestamp > dedupWindowMs * 2) {
          messageHashMap.current.delete(hash);
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [dedupWindowMs]);

  // Render helpers
  const getStateColor = (): string => {
    switch (state) {
      case 'PLANNING': return '#3b82f6';
      case 'EXECUTING': return '#f59e0b';
      case 'VERIFYING': return '#8b5cf6';
      case 'REFLECTING': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStateLabel = (): string => {
    switch (state) {
      case 'PLANNING': return '📋 Planlama';
      case 'EXECUTING': return '⚡ Çalıştırma';
      case 'VERIFYING': return '🔍 Doğrulama';
      case 'REFLECTING': return '💡 Yansıma';
      default: return '⏸️ Beklemede';
    }
  };

  const formatTimestamp = (ts: Date): string => {
    return ts.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStateEmoji = (phase: 'before' | 'after' | 'verify'): string => {
    switch (phase) {
      case 'before': return '🎯';
      case 'after': return '⚡';
      case 'verify': return '🔍';
      default: return '📝';
    }
  };

  if (!isVisible) {
    return null;
  }

  const containerClass = `${styles.container} ${isDragging ? styles.dragging : ''} ${isCollapsed ? styles.collapsed : styles.expanded}`;
  const headerClass = `${styles.header} ${isCollapsed ? styles.collapsed : ''}`;

  // Dinamik renkleri ve pozisyonu CSS değişkenleri olarak ayarla
  const dynamicStyles = {
    '--state-color': getStateColor(),
    '--pos-x': `${position.x}px`,
    '--pos-y': `${position.y}px`
  } as React.CSSProperties;

  return (
    // @ts-ignore - CSS custom properties require inline style
    <div
      ref={containerRef}
      className={containerClass}
      onMouseDown={handleMouseDown}
      style={dynamicStyles}>
      {/* Header - Draggable */}
      <div className={headerClass}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>🎓</span>
          {!isCollapsed && (
            <div>
              <h3 className={styles.headerTitle}>Usta Modu</h3>
              <p className={styles.headerStatus}>
                {getStateLabel()}
              </p>
            </div>
          )}
        </div>
        <div className={styles.headerButtons}>
          <button
            type="button"
            onClick={toggleCollapse}
            className={`${styles.button} ${styles.collapseButton}`}
            title={isCollapsed ? 'Genişlet' : 'Küçült'}
          >
            {isCollapsed ? '📖' : '📕'}
          </button>
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setMessages([])}
              className={`${styles.button} ${styles.clearButton}`}
            >
              🗑️ Temizle
            </button>
          )}
        </div>
      </div>

      {/* Messages - Only show when not collapsed */}
      {!isCollapsed && (
        <div className={styles.messagesContainer}>
          {messages.length === 0 ? (
            <div className={styles.emptyState}>
              Henüz bir aktivite yok... 🌙
            </div>
          ) : (
            messages.map((msg, idx) => {
              const messageClass = `${styles.message} ${styles[msg.phase]} ${idx === messages.length - 1 ? '' : styles.faded}`;
              return (
                <div key={`${msg.stepId}-${idx}`} className={messageClass}>
                  {/* Step ID + Timestamp */}
                  <div className={styles.messageHeader}>
                    <span className={styles.stepId}>{msg.stepId}</span>
                    <span className={styles.timestamp}>{formatTimestamp(msg.timestamp)}</span>
                  </div>

                  {/* Before Phase */}
                  {msg.phase === 'before' && (
                    <>
                      <div className={styles.beforeContent}>
                        {getStateEmoji('before')} {msg.goal || 'Adım planlanıyor...'}
                      </div>
                      {msg.rationale && (
                        <div className={styles.rationale}>
                          💭 {msg.rationale}
                        </div>
                      )}
                      
                      {/* 🎓 TEACHING MOMENT CARD */}
                      {msg.teachingMoment && (
                        <div className={styles.teachingCard}>
                          <div className={styles.teachingHeader}>
                            <span className={styles.conceptBadge}>
                              💡 {msg.teachingMoment.concept}
                            </span>
                            <span className={styles.complexityBadge}>
                              {msg.teachingMoment.complexity === 'basic' && '🟢'}
                              {msg.teachingMoment.complexity === 'intermediate' && '🟡'}
                              {msg.teachingMoment.complexity === 'advanced' && '🔴'}
                              {' '}{msg.teachingMoment.complexity}
                            </span>
                          </div>
                          
                          {msg.teachingMoment.explanation && (
                            <p className={styles.teachingExplanation}>
                              {msg.teachingMoment.explanation}
                            </p>
                          )}
                          
                          {msg.teachingMoment.bestPractices && msg.teachingMoment.bestPractices.length > 0 && (
                            <div className={styles.bestPractices}>
                              <strong>✅ En İyi Uygulamalar:</strong>
                              <ul>
                                {msg.teachingMoment.bestPractices.map((bp, i) => (
                                  <li key={i}>{bp}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {msg.teachingMoment.commonMistakes && msg.teachingMoment.commonMistakes.length > 0 && (
                            <div className={styles.antipatterns}>
                              <strong>⚠️ Kaçınılması Gerekenler:</strong>
                              <ul>
                                {msg.teachingMoment.commonMistakes.map((cm, i) => (
                                  <li key={i}>{cm}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {msg.teachingMoment.relatedConcepts && msg.teachingMoment.relatedConcepts.length > 0 && (
                            <div className={styles.relatedConcepts}>
                              🔗 <strong>İlgili Konular:</strong> {msg.teachingMoment.relatedConcepts.join(', ')}
                            </div>
                          )}
                          
                          {msg.teachingMoment.learnMoreUrl && (
                            <a 
                              href={msg.teachingMoment.learnMoreUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={styles.learnMore}
                            >
                              📚 Daha fazla öğren →
                            </a>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* After Phase */}
                  {msg.phase === 'after' && (
                    <div className={`${styles.afterContent} ${msg.success ? styles.success : styles.error}`}>
                      {msg.success ? '✅' : '❌'}
                      <span>{msg.success ? 'Başarılı' : 'Hata'}</span>
                      {msg.output && (
                        <span className={styles.output}>
                          {msg.output}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Verify Phase */}
                  {msg.phase === 'verify' && msg.results && (
                    <div className={styles.verifyContent}>
                      {msg.results.map((result, i) => (
                        <span key={i} className={`${styles.probeResult} ${styles[result.status]}`}>
                          {result.type}: {result.status.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Footer Stats - Only show when not collapsed */}
      {!isCollapsed && (
        <div className={styles.footer}>
          <span>📊 Mesaj: {messages.length}/{maxMessages}</span>
          {currentStep && (
            <span>🎯 Aktif: {currentStep}</span>
          )}
          <span>⚡ Rate: {rateLimit}ms</span>
        </div>
      )}
    </div>
  );
};

export default UstaModu;
