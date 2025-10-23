/**
 * MCP Prompts Implementation
 * 
 * Exposes reusable prompt templates (Night Orders, Refactor Plans, etc.)
 * according to MCP specification.
 * 
 * MCP Spec: https://spec.modelcontextprotocol.io/specification/server/prompts/
 */

class PromptsManager {
    constructor() {
        this.prompts = this.initializePrompts();
    }

    /**
     * Initialize all available prompts
     */
    initializePrompts() {
        return {
            'night_orders': {
                name: 'night_orders',
                description: 'Generate Night Orders JSON for autonomous code generation',
                arguments: [
                    {
                        name: 'mission',
                        description: 'The mission/goal to accomplish (e.g., "Create a blog platform")',
                        required: true
                    },
                    {
                        name: 'context',
                        description: 'Additional context about the project, tech stack, or constraints',
                        required: false
                    },
                    {
                        name: 'acceptance',
                        description: 'Acceptance criteria (e.g., "build: exit 0, lint: pass")',
                        required: false
                    }
                ]
            },
            'refactor_plan': {
                name: 'refactor_plan',
                description: 'Generate a refactoring plan for existing code',
                arguments: [
                    {
                        name: 'file_path',
                        description: 'Path to the file that needs refactoring',
                        required: true
                    },
                    {
                        name: 'issues',
                        description: 'List of issues to fix (e.g., "duplicate code, poor naming, no error handling")',
                        required: true
                    },
                    {
                        name: 'constraints',
                        description: 'Refactoring constraints (e.g., "keep API compatible, no breaking changes")',
                        required: false
                    }
                ]
            },
            'repair_plan': {
                name: 'repair_plan',
                description: 'Generate a repair plan for build/test failures',
                arguments: [
                    {
                        name: 'error_message',
                        description: 'The error message or stack trace',
                        required: true
                    },
                    {
                        name: 'file_path',
                        description: 'Path to the file with the error',
                        required: false
                    },
                    {
                        name: 'context',
                        description: 'Additional context about when/how the error occurred',
                        required: false
                    }
                ]
            },
            'code_review': {
                name: 'code_review',
                description: 'Generate a comprehensive code review',
                arguments: [
                    {
                        name: 'file_path',
                        description: 'Path to the file to review',
                        required: true
                    },
                    {
                        name: 'focus_areas',
                        description: 'Specific areas to focus on (e.g., "security, performance, maintainability")',
                        required: false
                    }
                ]
            },
            'test_generation': {
                name: 'test_generation',
                description: 'Generate test cases for a function or module',
                arguments: [
                    {
                        name: 'file_path',
                        description: 'Path to the file containing code to test',
                        required: true
                    },
                    {
                        name: 'function_name',
                        description: 'Specific function to generate tests for',
                        required: false
                    },
                    {
                        name: 'test_framework',
                        description: 'Testing framework to use (e.g., "jest", "mocha", "pytest")',
                        required: false
                    }
                ]
            },
            'architecture_design': {
                name: 'architecture_design',
                description: 'Design system architecture for a new feature or project',
                arguments: [
                    {
                        name: 'feature_description',
                        description: 'Description of the feature or project to design',
                        required: true
                    },
                    {
                        name: 'tech_stack',
                        description: 'Technology stack (e.g., "React, Node.js, PostgreSQL")',
                        required: false
                    },
                    {
                        name: 'constraints',
                        description: 'Design constraints (e.g., "must scale to 1M users, budget $X/month")',
                        required: false
                    }
                ]
            }
        };
    }

    /**
     * List all available prompts
     * MCP Method: prompts/list
     */
    async list(params = {}) {
        const { cursor } = params;
        
        const promptList = Object.values(this.prompts);
        
        // Pagination support (optional)
        const pageSize = 50;
        const startIndex = cursor ? parseInt(cursor, 10) : 0;
        const endIndex = startIndex + pageSize;
        
        const paginatedPrompts = promptList.slice(startIndex, endIndex);
        const nextCursor = endIndex < promptList.length ? endIndex.toString() : undefined;
        
        return {
            prompts: paginatedPrompts.map(p => ({
                name: p.name,
                description: p.description,
                arguments: p.arguments
            })),
            nextCursor
        };
    }

    /**
     * Get a specific prompt with generated content
     * MCP Method: prompts/get
     */
    async get(params) {
        const { name, arguments: args = {} } = params;
        
        if (!name) {
            throw new Error('Invalid parameter: name is required');
        }
        
        const prompt = this.prompts[name];
        
        if (!prompt) {
            throw new Error(`Prompt not found: ${name}`);
        }
        
        // Validate required arguments
        for (const arg of prompt.arguments) {
            if (arg.required && !args[arg.name]) {
                throw new Error(`Missing required argument: ${arg.name}`);
            }
        }
        
        // Generate prompt content based on template
        const content = this.generatePromptContent(name, args);
        
        return {
            description: prompt.description,
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: content
                    }
                }
            ]
        };
    }

    /**
     * Generate prompt content based on template and arguments
     */
    generatePromptContent(promptName, args) {
        switch (promptName) {
            case 'night_orders':
                return this.generateNightOrdersPrompt(args);
            
            case 'refactor_plan':
                return this.generateRefactorPlanPrompt(args);
            
            case 'repair_plan':
                return this.generateRepairPlanPrompt(args);
            
            case 'code_review':
                return this.generateCodeReviewPrompt(args);
            
            case 'test_generation':
                return this.generateTestGenerationPrompt(args);
            
            case 'architecture_design':
                return this.generateArchitectureDesignPrompt(args);
            
            default:
                throw new Error(`Unknown prompt template: ${promptName}`);
        }
    }

    /**
     * Generate Night Orders prompt
     */
    generateNightOrdersPrompt(args) {
        const { mission, context = '', acceptance = 'build: exit 0' } = args;
        
        return `# Night Orders Generation Request

**Mission:** ${mission}

${context ? `**Context:** ${context}\n` : ''}
**Acceptance Criteria:** ${acceptance}

---

Please generate a Night Orders JSON with the following structure:

\`\`\`json
{
  "mission": "${mission}",
  "acceptance": ["${acceptance.split(',').map(s => s.trim()).join('", "')}"],
  "steps": [
    {
      "id": "S1",
      "tool": "fs.write|run_cmd|fs.read",
      "args": { "path": "file.js", "content": "..." },
      "explain": {
        "goal": "What are we doing (30+ chars)",
        "rationale": "Why this approach (50+ chars)"
      },
      "verify": ["lint", "build", "probe"]
    }
  ]
}
\`\`\`

**Requirements:**
1. Each step MUST have a unique ID (S1, S2, S3...)
2. Each step MUST have an "explain" field with "goal" (30+ chars) and "rationale" (50+ chars)
3. Use appropriate tools: fs.write (file creation), run_cmd (commands), fs.read (file reading)
4. Include verification steps where appropriate
5. Steps should be actionable and atomic
6. NO placeholders or TODO comments in generated content

**Context about the project:**
${context || 'No additional context provided'}

Generate the complete Night Orders JSON now.`;
    }

    /**
     * Generate Refactor Plan prompt
     */
    generateRefactorPlanPrompt(args) {
        const { file_path, issues, constraints = '' } = args;
        
        return `# Code Refactoring Plan Request

**File to Refactor:** ${file_path}

**Issues to Fix:**
${issues}

${constraints ? `**Constraints:** ${constraints}\n` : ''}
---

Please analyze the code and generate a detailed refactoring plan with:

1. **Issue Analysis:** For each issue, explain the root cause
2. **Proposed Changes:** Specific code changes to make
3. **Risk Assessment:** Potential breaking changes or side effects
4. **Testing Strategy:** How to verify the refactoring is successful
5. **Implementation Steps:** Ordered list of changes to apply

**Output Format:**
\`\`\`markdown
## Refactoring Plan: ${file_path}

### Issue 1: [Name]
- **Root Cause:** ...
- **Proposed Change:** ...
- **Risk:** Low/Medium/High
- **Tests:** ...

### Implementation Steps:
1. Step 1...
2. Step 2...

### Verification:
- [ ] All tests pass
- [ ] No breaking changes
- [ ] Code quality improved
\`\`\`

Generate the complete refactoring plan now.`;
    }

    /**
     * Generate Repair Plan prompt
     */
    generateRepairPlanPrompt(args) {
        const { error_message, file_path = '', context = '' } = args;
        
        return `# Error Repair Plan Request

**Error Message:**
\`\`\`
${error_message}
\`\`\`

${file_path ? `**File:** ${file_path}\n` : ''}
${context ? `**Context:** ${context}\n` : ''}
---

Please analyze this error and generate a repair plan with:

1. **Error Analysis:** What caused this error?
2. **Root Cause:** Why did it happen?
3. **Fix Strategy:** What needs to be changed?
4. **Prevention:** How to prevent this in the future?
5. **Implementation:** Specific code changes

**Output Format:**
\`\`\`markdown
## Error Repair Plan

### Error Analysis
- **Type:** [Runtime/Compile/Test]
- **Severity:** [Critical/High/Medium/Low]
- **Impact:** ...

### Root Cause
...

### Fix Strategy
1. Change X to Y
2. Add error handling for Z
3. ...

### Prevention
- Add test case for this scenario
- Update validation logic
- Document edge case

### Code Changes
\`\`\`diff
- old code
+ new code
\`\`\`
\`\`\`

Generate the complete repair plan now.`;
    }

    /**
     * Generate Code Review prompt
     */
    generateCodeReviewPrompt(args) {
        const { file_path, focus_areas = 'general code quality' } = args;
        
        return `# Code Review Request

**File to Review:** ${file_path}

**Focus Areas:** ${focus_areas}

---

Please conduct a comprehensive code review covering:

1. **Code Quality:** Readability, maintainability, naming conventions
2. **Performance:** Inefficient algorithms, unnecessary operations
3. **Security:** Potential vulnerabilities, input validation
4. **Error Handling:** Missing error cases, proper exception handling
5. **Testing:** Test coverage, edge cases
6. **Documentation:** Comments, JSDoc, README updates needed

**Output Format:**
\`\`\`markdown
## Code Review: ${file_path}

### Summary
- **Overall Quality:** [Excellent/Good/Fair/Poor]
- **Major Issues:** X
- **Minor Issues:** Y
- **Suggestions:** Z

### Detailed Findings

#### 🔴 Critical Issues
1. [Issue] - Line X: ...

#### 🟡 Warnings
1. [Warning] - Line Y: ...

#### 💡 Suggestions
1. [Suggestion] - Line Z: ...

### Recommendations
- [ ] Priority 1: Fix critical security issue
- [ ] Priority 2: Improve error handling
- [ ] Priority 3: Add unit tests

### Code Examples
\`\`\`javascript
// Current code (problematic)
...

// Suggested improvement
...
\`\`\`
\`\`\`

Generate the complete code review now.`;
    }

    /**
     * Generate Test Generation prompt
     */
    generateTestGenerationPrompt(args) {
        const { file_path, function_name = '', test_framework = 'auto-detect' } = args;
        
        return `# Test Case Generation Request

**File to Test:** ${file_path}
${function_name ? `**Function:** ${function_name}\n` : ''}
**Test Framework:** ${test_framework}

---

Please generate comprehensive test cases covering:

1. **Happy Path:** Normal usage scenarios
2. **Edge Cases:** Boundary conditions, empty inputs, null values
3. **Error Cases:** Invalid inputs, exceptions
4. **Integration:** How it interacts with other components

**Output Format:**
\`\`\`javascript
describe('${function_name || 'Module'}', () => {
    // Setup
    beforeEach(() => {
        // ...
    });

    // Happy path tests
    test('should handle normal input correctly', () => {
        // ...
    });

    // Edge case tests
    test('should handle empty input', () => {
        // ...
    });

    // Error case tests
    test('should throw error for invalid input', () => {
        // ...
    });

    // Cleanup
    afterEach(() => {
        // ...
    });
});
\`\`\`

Generate the complete test suite now.`;
    }

    /**
     * Generate Architecture Design prompt
     */
    generateArchitectureDesignPrompt(args) {
        const { feature_description, tech_stack = 'flexible', constraints = '' } = args;
        
        return `# System Architecture Design Request

**Feature/Project:** ${feature_description}

**Tech Stack:** ${tech_stack}
${constraints ? `**Constraints:** ${constraints}\n` : ''}
---

Please design a comprehensive system architecture including:

1. **High-Level Architecture:** Components and their interactions
2. **Data Model:** Entities, relationships, schemas
3. **API Design:** Endpoints, request/response formats
4. **Infrastructure:** Deployment, scaling, monitoring
5. **Security:** Authentication, authorization, data protection
6. **Performance:** Caching, optimization strategies

**Output Format:**
\`\`\`markdown
## System Architecture: ${feature_description}

### Overview
[Brief description of the system]

### Architecture Diagram
\`\`\`
[ASCII diagram or description]
\`\`\`

### Components
1. **Frontend:** ...
2. **Backend:** ...
3. **Database:** ...
4. **Cache:** ...

### Data Model
\`\`\`sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    ...
);
\`\`\`

### API Endpoints
- POST /api/resource - Create resource
- GET /api/resource/:id - Get resource
- ...

### Infrastructure
- **Deployment:** Docker + Kubernetes
- **Scaling:** Horizontal scaling with load balancer
- **Monitoring:** Prometheus + Grafana

### Security Considerations
- JWT authentication
- HTTPS only
- Rate limiting

### Performance Optimization
- Redis caching
- Database indexing
- CDN for static assets
\`\`\`

Generate the complete architecture design now.`;
    }
}

// Export
module.exports = { PromptsManager };
