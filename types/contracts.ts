/**
 * 🔷 CORE TYPE CONTRACTS
 * 
 * Centralized type definitions for KayraDeniz Code Assistant.
 * These types are used across vanilla JS (via JSDoc) and TypeScript/React.
 */

// ===== NIGHT ORDERS PROTOCOL =====

/**
 * Tool types supported by the system
 */
export type ToolType = 
  | 'fs.write'
  | 'fs.read'
  | 'fs.delete'
  | 'run_cmd'
  | 'terminal.exec';

/**
 * Tool arguments (flexible record)
 */
export interface ToolArgs {
  [key: string]: unknown;
}

/**
 * Explanation structure for teaching mode (Usta Modu)
 */
export interface Explanation {
  /** What are we doing? (min 30 chars) */
  goal: string;
  
  /** Why this approach? Technical details (min 50 chars) */
  rationale: string;
  
  /** Alternative approaches and why they weren't chosen */
  tradeoffs?: string;
  
  /** Show diff after execution */
  showDiff?: boolean;
  
  /** Checklist of important points */
  checklist?: string[];
  
  /** 🎓 EDUCATIONAL ENHANCEMENTS */
  
  /** Pedagogical insights for the user */
  teachingMoment?: TeachingMoment;
}

/**
 * Teaching moment structure - educational content
 */
export interface TeachingMoment {
  /** Concept being taught (e.g., "RESTful API Design", "State Management") */
  concept: string;
  
  /** Complexity level */
  complexity: 'basic' | 'intermediate' | 'advanced';
  
  /** Category of the teaching */
  category: 'architecture' | 'security' | 'performance' | 'testing' | 'design' | 'patterns' | 'best-practices';
  
  /** Short explanation (1-2 sentences, Turkish) */
  explanation?: string;
  
  /** Best practices for this step */
  bestPractices?: string[];
  
  /** Common mistakes to avoid */
  commonMistakes?: string[];
  
  /** Related concepts to explore */
  relatedConcepts?: string[];
  
  /** Relevance score (0-100, how important is this for the user) */
  relevance?: number;
  
  /** External learning resource */
  learnMoreUrl?: string;
}

/**
 * Probe definition for verification
 */
export type ProbeDefinition = string; // e.g., "probe:file client/index.html"

/**
 * Single step in Night Orders
 */
export interface Step {
  /** Step identifier (S1, S2, S3, etc.) */
  id: string;
  
  /** Tool to execute */
  tool: ToolType;
  
  /** Arguments for the tool */
  args: ToolArgs;
  
  /** Teaching explanation (Usta Modu) */
  explain?: Explanation;
  
  /** Verification probes to run after step */
  verify?: ProbeDefinition[];
}

/**
 * Complete Night Orders mission
 */
export interface NightOrders {
  /** Mission statement (min 10 chars) */
  mission: string;
  
  /** Acceptance criteria (at least 1 required) */
  acceptance: string[];
  
  /** Steps to execute (at least 1 required) */
  steps: Step[];
  
  /** Phase marker (for multi-phase projects) */
  isPhase2?: boolean;
  
  /** Phase number */
  phaseNumber?: number;
}

// ===== EVENT BUS =====

/**
 * Event types for the system
 */
export type EventType =
  | 'NARRATION_BEFORE'
  | 'NARRATION_AFTER'
  | 'NARRATION_VERIFY'
  | 'STEP_RESULT'
  | 'EXECUTION_COMPLETE'
  | 'PROBE_RESULTS'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_DENIED';

/**
 * Base event structure
 */
export interface EventBusEvent<T = unknown> {
  /** Event type */
  type: EventType;
  
  /** Event timestamp */
  timestamp: number;
  
  /** Event-specific data */
  data?: T;
}

/**
 * Narration BEFORE event
 */
export interface NarrationBeforeEvent extends EventBusEvent<{
  stepId: string;
  explain: Explanation;
}> {
  type: 'NARRATION_BEFORE';
  stepId: string;
  explain: Explanation;
}

/**
 * Narration AFTER event
 */
export interface NarrationAfterEvent extends EventBusEvent<{
  stepId: string;
  diff?: string;
  summary: string;
}> {
  type: 'NARRATION_AFTER';
  stepId: string;
  diff?: string;
  summary: string;
}

/**
 * Narration VERIFY event
 */
export interface NarrationVerifyEvent extends EventBusEvent<{
  stepId: string;
  probes: ProbeResult[];
}> {
  type: 'NARRATION_VERIFY';
  stepId: string;
  probes: ProbeResult[];
}

// ===== PROBE SYSTEM =====

/**
 * Probe types
 */
export type ProbeType = 'file' | 'http' | 'port' | 'lint' | 'test';

/**
 * Probe status
 */
export type ProbeStatus = 'pass' | 'fail' | 'skip';

/**
 * Probe result
 */
export interface ProbeResult {
  /** Probe type */
  type: ProbeType;
  
  /** Status of the probe */
  status: ProbeStatus;
  
  /** Target (file path, URL, port number, etc.) */
  target?: string;
  
  /** URL for HTTP probes */
  url?: string;
  
  /** Optional message */
  message?: string;
}

// ===== POLICY ENGINE =====

/**
 * Risk levels
 */
export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Policy violation
 */
export interface PolicyViolation {
  /** Rule name */
  rule: string;
  
  /** Violation message */
  message: string;
  
  /** Step ID where violation occurred */
  stepId?: string;
}

/**
 * Policy evaluation result
 */
export interface PolicyEvaluation {
  /** Whether operation is allowed */
  allow: boolean;
  
  /** Risk level */
  risk: RiskLevel;
  
  /** Reason for decision */
  reason: string;
  
  /** List of violations (if any) */
  violations?: PolicyViolation[];
}

// ===== APPROVAL SYSTEM =====

/**
 * Approval token
 */
export type ApprovalToken = string;

/**
 * Approval request
 */
export interface ApprovalRequest {
  /** Request ID */
  id: string;
  
  /** Proposal to approve */
  proposal: {
    step?: Step;
    description?: string;
  };
  
  /** Timestamp */
  createdAt: number;
}

/**
 * Approval result
 */
export interface ApprovalResult {
  /** Whether approved */
  approved: boolean;
  
  /** Approval token (if approved) */
  token?: ApprovalToken;
  
  /** Auto-approved flag */
  autoApproved?: boolean;
  
  /** Reason */
  reason?: string;
}

// ===== LEARNING SYSTEM (PR-3) =====

/**
 * Reflection entry in learning store
 */
export interface Reflection {
  /** Timestamp */
  timestamp: number;
  
  /** Mission name */
  mission: string;
  
  /** Step ID */
  step: string;
  
  /** Tool used */
  tool: string;
  
  /** Error message */
  error: string;
  
  /** Root cause */
  rootCause: string;
  
  /** Fix applied */
  fix: string;
  
  /** Result (PASS, FAIL, RETRY) */
  result: 'PASS' | 'FAIL' | 'RETRY';
  
  /** Pattern identifier */
  pattern?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Pattern in learning store
 */
export interface Pattern {
  /** Pattern identifier */
  id: string;
  
  /** Number of times seen */
  count: number;
  
  /** First occurrence */
  firstSeen: number;
  
  /** Last occurrence */
  lastSeen: number;
  
  /** Root cause description */
  rootCause: string;
  
  /** List of fixes */
  fixes: Array<{
    timestamp: number;
    fix: string;
    mission: string;
  }>;
}

/**
 * Learning statistics
 */
export interface LearningStats {
  /** Total reflections */
  totalReflections: number;
  
  /** Successful fixes */
  successfulFixes: number;
  
  /** Failed fixes */
  failedFixes: number;
  
  /** Total patterns */
  totalPatterns: number;
  
  /** Success rate (percentage) */
  successRate: string;
  
  /** Top patterns */
  topPatterns: Pattern[];
}

// ===== CRITIC AGENT =====

/**
 * Analysis result from CriticAgent
 */
export interface AnalysisResult {
  /** Root cause of failure */
  rootCause: string;
  
  /** Fix plan */
  fixPlan: Array<{
    tool: string;
    args: Record<string, unknown>;
    description: string;
  }>;
  
  /** Pattern identifier */
  pattern?: string;
  
  /** Failed step */
  failedStep?: string;
  
  /** Tool that failed */
  tool?: string;
  
  /** Standard error output */
  stderr?: string;
  
  /** Error message */
  error?: string;
}

/**
 * Fix result from CriticAgent
 */
export interface FixResult {
  /** Whether fix was successful */
  success: boolean;
  
  /** Number of attempts */
  attempts?: number;
  
  /** Duration in milliseconds */
  duration?: number;
  
  /** Error message (if failed) */
  error?: string;
}

// ===== PHASE TRACKING =====

/**
 * Phase context for tracking project phases
 */
export interface PhaseContext {
  /** Current phase number */
  currentPhase: number;
  
  /** Phase history */
  phaseHistory: Array<{
    phase: number;
    mission: string;
    timestamp: number;
    files: string[];
    success: boolean;
  }>;
  
  /** Files completed in this phase */
  completedFiles: Set<string>;
  
  /** Last mission executed */
  lastMission: string | null;
  
  /** Phase start time */
  phaseStartTime: number;
  
  /** Total phases */
  totalPhases: number;
}

// ===== NARRATION STATE (for React UI) =====

/**
 * Narration state machine states
 */
export type NarrationState = 'PLANNING' | 'EXECUTING' | 'VERIFYING' | 'REFLECTING';

/**
 * Step narration for UI display
 */
export interface StepNarration {
  /** Step ID */
  stepId: string;
  
  /** Explanation */
  explain?: Explanation;
  
  /** Changes made */
  diff?: string;
  
  /** Summary */
  summary?: string;
  
  /** Probe results */
  probes?: ProbeResult[];
  
  /** Timestamp */
  timestamp: number;
  
  /** Current state */
  state?: NarrationState;
}
