import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  NarrationState,
  StepNarration,
  NarrationBeforeEvent,
  NarrationAfterEvent,
  NarrationVerifyEvent
} from '@types/contracts';
import { getLegacyRunner } from '@adapters/legacy-runner';

interface UstaMosuProps {
  maxMessages?: number;
  dedupWindowMs?: number;
  rateLimit?: number;
}

export const UstaModu: React.FC<UstaMosuProps> = ({
  maxMessages = 50,
  dedupWindowMs = 2000,
  rateLimit = 100
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

  // Dedupe helper
  const generateHash = useCallback((msg: StepNarration): string => {
    return `${msg.stepId}-${msg.phase}-${msg.goal?.substring(0, 50)}`;
  }, []);

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

  // Add message with deduplication
  const addMessage = useCallback((msg: StepNarration) => {
    const hash = generateHash(msg);
    const lastSeenTime = messageHashMap.current.get(hash) || 0;
    const now = Date.now();

    if (now - lastSeenTime < dedupWindowMs) {
      console.log('[UstaModu] Dedupe skipped:', hash);
      return;
    }

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
  }, [generateHash, dedupWindowMs, maxMessages, scrollToBottom]);

  // Event handlers
  const handleNarrationBefore = useCallback((event: NarrationBeforeEvent) => {
    if (!shouldProcessEvent()) return;

    setState('PLANNING');
    setCurrentStep(event.data.stepId);

    addMessage({
      stepId: event.data.stepId,
      phase: 'before',
      goal: event.data.goal,
      rationale: event.data.rationale,
      timestamp: event.timestamp
    });
  }, [shouldProcessEvent, addMessage]);

  const handleNarrationAfter = useCallback((event: NarrationAfterEvent) => {
    if (!shouldProcessEvent()) return;

    setState('EXECUTING');

    addMessage({
      stepId: event.data.stepId,
      phase: 'after',
      success: event.data.success,
      output: event.data.output,
      timestamp: event.timestamp
    });
  }, [shouldProcessEvent, addMessage]);

  const handleNarrationVerify = useCallback((event: NarrationVerifyEvent) => {
    if (!shouldProcessEvent()) return;

    setState('VERIFYING');

    addMessage({
      stepId: event.data.stepId,
      phase: 'verify',
      results: event.data.results,
      timestamp: event.timestamp
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
    if ((e.target as HTMLElement).closest('.header')) {
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

    const unsub1 = runner.subscribeToEvents('NARRATION_BEFORE', handleNarrationBefore);
    const unsub2 = runner.subscribeToEvents('NARRATION_AFTER', handleNarrationAfter);
    const unsub3 = runner.subscribeToEvents('NARRATION_VERIFY', handleNarrationVerify);

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
    return new Date(ts).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className="usta-modu-container" 
      onMouseDown={handleMouseDown}
      style={{ 
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isCollapsed ? '200px' : '450px',
        height: isCollapsed ? 'auto' : 'auto',
        maxHeight: isCollapsed ? 'none' : '600px',
        backgroundColor: '#1a1a2e',
        borderRadius: '12px',
        boxShadow: isDragging ? '0 12px 48px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.4)',
        border: `2px solid ${getStateColor()}`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        cursor: isDragging ? 'grabbing' : 'default',
        transition: isDragging ? 'none' : 'width 0.3s ease, box-shadow 0.2s ease',
        userSelect: 'none'
      }}>
      {/* Header - Draggable */}
      <div 
        className="header"
        style={{
          padding: '12px 16px',
          borderBottom: isCollapsed ? 'none' : `2px solid ${getStateColor()}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#16213e',
          cursor: 'grab',
          borderRadius: '10px 10px 0 0'
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '24px',
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            🎓
          </span>
          {!isCollapsed && (
            <div>
              <h3 style={{ 
                margin: 0, 
                color: '#fff',
                fontSize: '16px',
                fontWeight: 600
              }}>
                Usta Modu
              </h3>
              <p style={{
                margin: '4px 0 0 0',
                color: getStateColor(),
                fontSize: '12px',
                fontWeight: 500
              }}>
                {getStateLabel()}
              </p>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={toggleCollapse}
            style={{
              padding: '6px 10px',
              backgroundColor: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
            title={isCollapsed ? 'Genişlet' : 'Küçült'}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366f1'}
          >
            {isCollapsed ? '📖' : '📕'}
          </button>
          {!isCollapsed && (
            <button
              onClick={() => setMessages([])}
              style={{
                padding: '6px 12px',
                backgroundColor: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
            >
              🗑️ Temizle
            </button>
          )}
        </div>
      </div>

      {/* Messages - Only show when not collapsed */}
      {!isCollapsed && (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {messages.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '14px',
              padding: '32px',
              fontStyle: 'italic'
            }}>
              Henüz bir aktivite yok... 🌙
            </div>
          ) : (
            messages.map((msg, idx) => (
            <div
              key={`${msg.stepId}-${idx}`}
              style={{
                padding: '12px',
                backgroundColor: msg.phase === 'before' ? '#1e3a5f' : 
                                msg.phase === 'after' ? '#2d1f3f' : '#1f2937',
                borderRadius: '8px',
                borderLeft: `4px solid ${
                  msg.phase === 'before' ? '#3b82f6' :
                  msg.phase === 'after' ? '#f59e0b' : '#8b5cf6'
                }`,
                animation: 'slideIn 0.3s ease-out',
                opacity: idx === messages.length - 1 ? 1 : 0.7
              }}
            >
              {/* Step ID + Timestamp */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <span style={{
                  color: '#a5b4fc',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'monospace'
                }}>
                  {msg.stepId}
                </span>
                <span style={{
                  color: '#6b7280',
                  fontSize: '11px'
                }}>
                  {formatTimestamp(msg.timestamp)}
                </span>
              </div>

              {/* Before Phase */}
              {msg.phase === 'before' && (
                <>
                  <div style={{ 
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 500,
                    marginBottom: '6px'
                  }}>
                    🎯 {msg.goal}
                  </div>
                  {msg.rationale && (
                    <div style={{
                      color: '#9ca3af',
                      fontSize: '12px',
                      fontStyle: 'italic',
                      paddingLeft: '8px',
                      borderLeft: '2px solid #374151'
                    }}>
                      💭 {msg.rationale}
                    </div>
                  )}
                </>
              )}

              {/* After Phase */}
              {msg.phase === 'after' && (
                <div style={{ 
                  color: msg.success ? '#10b981' : '#ef4444',
                  fontSize: '13px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {msg.success ? '✅' : '❌'}
                  <span>{msg.success ? 'Başarılı' : 'Hata'}</span>
                  {msg.output && (
                    <span style={{
                      color: '#9ca3af',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '250px'
                    }}>
                      {msg.output}
                    </span>
                  )}
                </div>
              )}

              {/* Verify Phase */}
              {msg.phase === 'verify' && msg.results && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px'
                }}>
                  {msg.results.map((result, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: result.status === 'PASS' ? '#065f46' :
                                       result.status === 'FAIL' ? '#7f1d1d' : '#374151',
                        color: '#fff'
                      }}
                    >
                      {result.type}: {result.status}
                    </span>
                  ))}
                </div>
              )}
            </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Footer Stats - Only show when not collapsed */}
      {!isCollapsed && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #374151',
          backgroundColor: '#16213e',
          borderRadius: '0 0 10px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#9ca3af'
        }}>
          <span>📊 Mesaj: {messages.length}/{maxMessages}</span>
          {currentStep && (
            <span>🎯 Aktif: {currentStep}</span>
          )}
          <span>⚡ Rate: {rateLimit}ms</span>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
        }

        .usta-modu-container::-webkit-scrollbar {
          width: 6px;
        }

        .usta-modu-container::-webkit-scrollbar-track {
          background: #1a1a2e;
        }

        .usta-modu-container::-webkit-scrollbar-thumb {
          background: ${getStateColor()};
          border-radius: 3px;
        }

        .usta-modu-container::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </div>
  );
};

export default UstaModu;
