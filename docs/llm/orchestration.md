# LLM Orchestration Architecture

## Overview

This document defines the AI integration architecture for CTOProjects, providing a blueprint for seamless LLM orchestration across multiple providers, learning modes, and operational contexts. The design prioritizes reliability, cost efficiency, safety, and observability while maintaining flexibility for future enhancements.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Provider Selection Strategy](#provider-selection-strategy)
3. [Abstraction Layer](#abstraction-layer)
4. [Learning Modes & Prompt Templates](#learning-modes--prompt-templates)
5. [Context Assembly](#context-assembly)
6. [Caching & Grounding Strategies](#caching--grounding-strategies)
7. [Streaming Responses](#streaming-responses)
8. [Fallback Handling](#fallback-handling)
9. [Guardrails & Safety](#guardrails--safety)
10. [Token Budgeting](#token-budgeting)
11. [Observability](#observability)

---

## Architecture Overview

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway / Client                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│              LLM Orchestration Service                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Request Router & Validation                            │   │
│  └────────────────┬──────────────────────────────────────┬─┘   │
│                   │                                        │     │
│  ┌────────────────▼──────────────┐  ┌──────────────────▼──┐   │
│  │  Context Assembly Layer       │  │  Prompt Templates    │   │
│  │  - Material Enrichment        │  │  - System Prompts    │   │
│  │  - Vector Search              │  │  - Learning Modes    │   │
│  │  - Knowledge Graph            │  │  - Format Specs      │   │
│  └─────────────────────────────┬─┘  └────────────┬────────┘   │
│                               │                  │              │
│  ┌────────────────────────────▼──────────────────▼──────────┐  │
│  │         Token Budget Manager & Optimizer                │  │
│  │  - Token Counting                                        │  │
│  │  - Model Selection                                       │  │
│  │  - Request Queueing                                      │  │
│  └────────────────┬──────────────────────────────────────┬──┘  │
│                   │                                        │    │
│  ┌────────────────▼──────────────┐  ┌──────────────────▼──┐   │
│  │  Provider Abstraction Layer    │  │  Cache Layer        │   │
│  │  - OpenAI                      │  │  - Query Cache      │   │
│  │  - Anthropic                   │  │  - Response Cache   │   │
│  │  - Azure OpenAI                │  │  - TTL Management   │   │
│  │  - Local Models (LLaMA, etc)   │  │  - Invalidation     │   │
│  └────────────────┬───────────────┘  └────────────────────┘   │
│                   │                                              │
│  ┌────────────────▼──────────────────────────────────────────┐ │
│  │     Streaming & Response Handler                         │ │
│  │  - Stream Buffering                                       │ │
│  │  - Fallback Triggering                                    │ │
│  │  - Response Formatting                                    │ │
│  └────────────────┬───────────────────────────────────────────┘ │
│                   │                                              │
│  ┌────────────────▼──────────────┐  ┌──────────────────────┐   │
│  │  Safety & Guardrails          │  │  Observability Hub   │   │
│  │  - Input Validation           │  │  - Metrics Export    │   │
│  │  - Output Filtering           │  │  - Trace Logging     │   │
│  │  - Cost Monitoring            │  │  - Error Tracking    │   │
│  │  - Rate Limiting              │  │  - Usage Analytics   │   │
│  └────────────────────────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principles

- **Provider Agnostic**: Abstract away provider differences for seamless switching
- **Cost-Optimized**: Intelligent model selection and token management
- **Resilient**: Built-in fallback chains and graceful degradation
- **Observable**: Comprehensive logging and metrics at every layer
- **Safe**: Multiple layers of guardrails for content and cost control

---

## Provider Selection Strategy

### Supported Providers

| Provider | Model Tier | Strengths | Primary Use | Cost | Latency |
|----------|-----------|----------|-----------|------|---------|
| OpenAI | GPT-4 Turbo | Reasoning, complex tasks | Premium analysis | $$ | Medium |
| OpenAI | GPT-3.5 | Speed, cost-effectiveness | General purpose | $ | Low |
| Anthropic | Claude 3 Opus | Long context, safety | Analysis, documentation | $$ | Medium |
| Anthropic | Claude 3 Sonnet | Balanced performance | General purpose | $$ | Low |
| Azure OpenAI | GPT-4, 3.5 | Enterprise support | Enterprise deployments | $$$ | Low-Medium |
| Local | LLaMA 2, Mistral | Privacy, no costs | Development, testing | Free | Variable |

### Selection Logic

```
Provider Selection Decision Tree:

1. Check User Preferences
   ├─ If pinned provider → Use that provider
   └─ If tier specified → Filter by tier

2. Evaluate Token Budget
   ├─ If tokens required > daily budget → Defer/Reject
   ├─ If tokens required > hourly budget → Queue request
   └─ Otherwise → Continue

3. Check Availability
   ├─ If primary provider rate-limited → Try next in chain
   ├─ If primary provider error → Log and fallback
   └─ Otherwise → Use primary

4. Optimize for Task
   ├─ Long context (>16K) → Use models supporting it (Claude, GPT-4 Turbo)
   ├─ Reasoning required → Prefer GPT-4 or Claude Opus
   ├─ Speed critical → Use GPT-3.5 or Sonnet
   ├─ Cost critical → Use GPT-3.5
   └─ Privacy critical → Use local model

5. Round-Robin Fallback
   └─ If all preferred fail → Use next available in rotation
```

### Configuration

```yaml
providers:
  primary:
    - provider: openai
      model: gpt-4-turbo
      tier: premium
      rate_limit:
        requests_per_minute: 90
        tokens_per_minute: 2000000
      fallback_to: openai-35
      
    - provider: openai
      model: gpt-3.5-turbo
      tier: standard
      id: openai-35
      fallback_to: anthropic-sonnet
      
    - provider: anthropic
      model: claude-3-sonnet
      tier: standard
      id: anthropic-sonnet
      fallback_to: local-llama
      
    - provider: local
      model: llama-2-70b
      id: local-llama
      tier: free
      endpoint: http://localhost:8000
```

---

## Abstraction Layer

### Provider Adapter Interface

All providers implement a unified interface:

```typescript
interface LLMProvider {
  // Metadata
  getName(): string;
  getMaxTokens(): number;
  getSupportedModes(): LearningMode[];
  
  // Core Completion
  complete(
    request: CompletionRequest
  ): Promise<CompletionResponse>;
  
  stream(
    request: CompletionRequest
  ): AsyncIterable<StreamChunk>;
  
  // Batch Operations
  batchComplete(
    requests: CompletionRequest[]
  ): Promise<CompletionResponse[]>;
  
  // Health & Status
  getHealth(): Promise<ProviderHealth>;
  isAvailable(): Promise<boolean>;
}

interface CompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  context: ContextAssembly;
  learningMode: LearningMode;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  metadata?: Record<string, any>;
}

interface CompletionResponse {
  content: string;
  model: string;
  provider: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  finishReason: 'stop' | 'length' | 'error' | 'timeout';
  duration: number; // milliseconds
  cached: boolean;
}

interface StreamChunk {
  delta: string; // Incremental content
  index: number;
  tokensUsed?: number;
}
```

### Adapter Implementation Requirements

Each provider adapter must:

1. **Translate request formats** to provider APIs
2. **Normalize responses** to common format
3. **Handle rate limits** and backoff strategies
4. **Implement token counting** for accurate budgeting
5. **Map error codes** to standardized exceptions
6. **Support streaming** with consistent chunk format
7. **Provide health checks** and circuit breaker integration

### Example: OpenAI Adapter

```typescript
class OpenAIAdapter implements LLMProvider {
  private client: OpenAI;
  private tokenCounter: TokenCounter;
  
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const estimatedTokens = this.tokenCounter.estimate(
        request.systemPrompt + request.userPrompt
      );
      
      if (estimatedTokens > this.getMaxTokens()) {
        throw new TokenLimitExceededError();
      }
      
      const response = await this.client.chat.completions.create({
        model: request.learningMode.modelHint || 'gpt-4-turbo',
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: this.formatPrompt(request) }
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        top_p: request.topP ?? 1.0,
      });
      
      return {
        content: response.choices[0].message.content,
        model: response.model,
        provider: 'openai',
        tokensUsed: {
          prompt: response.usage.prompt_tokens,
          completion: response.usage.completion_tokens,
          total: response.usage.total_tokens,
        },
        finishReason: response.choices[0].finish_reason as any,
        duration: Date.now() - startTime,
        cached: false,
      };
    } catch (error) {
      if (error.code === 'rate_limit_exceeded') {
        throw new RateLimitError();
      }
      throw new ProviderError(`OpenAI error: ${error.message}`);
    }
  }
  
  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      ...completionParams,
      stream: true,
    });
    
    let index = 0;
    for await (const chunk of stream) {
      const delta = chunk.choices[0].delta.content || '';
      if (delta) {
        yield {
          delta,
          index: index++,
        };
      }
    }
  }
}
```

---

## Learning Modes & Prompt Templates

### Defined Learning Modes

Learning modes represent different interaction patterns and cognitive tasks:

#### 1. **Interactive Learning** (Socratic Method)
- **Purpose**: Guided discovery through questioning
- **Use Case**: Teaching, skill development, conceptual understanding
- **Characteristics**: Multi-turn, iterative feedback, explanation-focused

#### 2. **Quick Reference** (Information Retrieval)
- **Purpose**: Fast, factual information lookup
- **Use Case**: Definitions, syntax, quick answers
- **Characteristics**: Single-turn, concise responses, high accuracy

#### 3. **Analysis & Insights** (Deep Reasoning)
- **Purpose**: Complex problem-solving and data interpretation
- **Use Case**: Decision support, technical analysis, strategy
- **Characteristics**: Multi-turn, reasoning chains, evidence-based

#### 4. **Code Generation** (Synthesis)
- **Purpose**: Generate working code from specifications
- **Use Case**: Implementation, debugging, refactoring
- **Characteristics**: Code-focused, executable output, language-specific

#### 5. **Documentation** (Structured Writing)
- **Purpose**: Generate structured, professional documentation
- **Use Case**: API docs, guides, reports
- **Characteristics**: Formatted output, metadata-rich, style-consistent

#### 6. **Creative Writing** (Open-ended)
- **Purpose**: Generate creative content with flexibility
- **Use Case**: Content generation, brainstorming, storytelling
- **Characteristics**: High creativity, variable output, style-guided

### Prompt Template Structure

Each learning mode has a configurable prompt template:

```yaml
learning_modes:
  interactive_learning:
    system_prompt: |
      You are a patient and knowledgeable educator. Your role is to help 
      learners understand concepts through guided discovery.
      
      Guidelines:
      - Ask probing questions to check understanding
      - Provide hints before full explanations
      - Encourage critical thinking
      - Adapt complexity to learner's level
      - Use analogies and real-world examples
      
    parameters:
      temperature: 0.6  # Consistent but somewhat creative
      max_tokens: 1500
      top_p: 0.9
    
    response_format: |
      ## Key Question
      [Ask a leading question]
      
      ## Hint
      [Provide a subtle hint]
      
      ## Explanation
      [If needed, explain the concept]
      
      ## Practice
      [Suggest a follow-up exercise]
  
  quick_reference:
    system_prompt: |
      You are a concise information retriever. Provide accurate, direct answers.
      
      Guidelines:
      - Be brief and to the point
      - Prioritize accuracy over explanation
      - Use formatting for clarity (lists, tables, code blocks)
      - Include relevant examples if helpful
      
    parameters:
      temperature: 0.2  # Very consistent, factual
      max_tokens: 500
      top_p: 1.0
    
    response_format: |
      [Direct answer or definition]
      
      **Example:** [If applicable]
      **Related:** [Links to related topics]
  
  analysis_insights:
    system_prompt: |
      You are a strategic analyst. Help users understand complex situations
      by breaking down problems and identifying key insights.
      
      Guidelines:
      - Structure analysis logically (causes, effects, implications)
      - Support claims with evidence or reasoning
      - Consider multiple perspectives
      - Highlight key trade-offs
      
    parameters:
      temperature: 0.7
      max_tokens: 2000
      top_p: 0.95
    
    response_format: |
      ## Problem Statement
      [Clarify the issue]
      
      ## Root Cause Analysis
      [Identify underlying factors]
      
      ## Key Insights
      - [Insight 1]
      - [Insight 2]
      - [Insight 3]
      
      ## Recommendations
      [Actionable next steps]
  
  code_generation:
    system_prompt: |
      You are an expert programmer. Generate clean, efficient, well-commented code.
      
      Guidelines:
      - Follow language best practices
      - Include error handling
      - Add meaningful comments
      - Optimize for readability first, performance second
      
    parameters:
      temperature: 0.3  # Deterministic, prefer standard patterns
      max_tokens: 3000
      top_p: 0.8
    
    response_format: |
      ## Solution
      [Explanation of approach]
      
      ```[language]
      [Complete, working code]
      ```
      
      ## Key Points
      - [Explanation point 1]
      - [Explanation point 2]
  
  documentation:
    system_prompt: |
      You are a technical writer. Generate clear, professional documentation.
      
      Guidelines:
      - Use clear hierarchy and structure
      - Include examples and use cases
      - Define technical terms
      - Maintain consistent style and tone
      
    parameters:
      temperature: 0.4
      max_tokens: 3000
      top_p: 0.8
    
    response_format: |
      # [Title]
      
      ## Overview
      [Brief description]
      
      ## Table of Contents
      [Auto-generated or manual]
      
      ## Sections
      [Content with proper headings]
      
      ## Examples
      [Usage examples or scenarios]
  
  creative_writing:
    system_prompt: |
      You are a creative writer. Generate engaging, original content that
      captures the user's vision.
      
      Guidelines:
      - Be expressive and use vivid language
      - Adapt style to the specified genre or tone
      - Maintain narrative consistency
      - Create engaging narratives
      
    parameters:
      temperature: 0.9  # High creativity
      max_tokens: 2500
      top_p: 1.0
    
    response_format: |
      [Creative content]
      
      ## Writing Notes
      [Style notes, tone, or intent achieved]
```

### Prompt Template Manager

```typescript
class PromptTemplateManager {
  private templates: Map<LearningMode, PromptTemplate>;
  private cache: Map<string, RenderedTemplate>;
  
  render(
    mode: LearningMode,
    context: ContextAssembly,
    userInput: string
  ): RenderedTemplate {
    const template = this.templates.get(mode);
    
    // Build system prompt with context grounding
    const systemPrompt = template.systemPrompt + 
      this.buildContextGround(context);
    
    // Format user input according to mode
    const userPrompt = template.formatUserInput(userInput);
    
    return {
      systemPrompt,
      userPrompt,
      parameters: template.parameters,
      responseFormat: template.responseFormat,
    };
  }
  
  private buildContextGround(context: ContextAssembly): string {
    if (!context.materials.length) return '';
    
    return `
    
## Reference Context

The following materials have been provided as reference:
${context.materials.map(m => `- ${m.title}`).join('\n')}

Use this context to ground your response in the user's specific domain.
    `;
  }
}
```

---

## Context Assembly

### Context Sources

```
User Request
    ↓
┌─────────────────────────────────────┐
│  Context Assembly Pipeline          │
├─────────────────────────────────────┤
│ 1. Extract Material References      │ → Uploaded files, documents
│ 2. Semantic Search                  │ → Vector DB query
│ 3. Knowledge Graph Navigation       │ → Relationship extraction
│ 4. Conversation History             │ → Previous turns
│ 5. User Profile & Preferences       │ → Personalization
│ 6. System Context                   │ → Time, config, state
└─────────────────────────────────────┘
    ↓
Context Assembly Object
    ↓
Integrated into Prompt
```

### Context Structure

```typescript
interface ContextAssembly {
  materials: UploadedMaterial[];
  semanticSearchResults: SearchResult[];
  knowledgeGraphNodes: GraphNode[];
  conversationHistory: ConversationTurn[];
  userProfile: UserProfile;
  systemContext: SystemContext;
  metadata: {
    assemblyTime: number;
    sourceCount: number;
    totalTokens: number;
  };
}

interface UploadedMaterial {
  id: string;
  title: string;
  content: string;
  format: 'text' | 'markdown' | 'code' | 'json';
  uploadedAt: Date;
  relevance: number; // 0-1
}

interface SearchResult {
  content: string;
  source: string;
  relevance: number;
  distance: number; // Vector distance
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, any>;
  relationships: GraphEdge[];
}

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokens: number;
}
```

### Context Assembly Algorithm

```typescript
class ContextAssembler {
  private vectorDb: VectorDatabase;
  private knowledgeGraph: KnowledgeGraph;
  private cache: LRUCache;
  
  async assemble(
    query: string,
    userMaterials: UploadedMaterial[],
    conversationId: string
  ): Promise<ContextAssembly> {
    const cacheKey = this.getCacheKey(query, userMaterials);
    
    // Check context cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // Parallel assembly
    const [semanticResults, graphNodes, history, profile] = await Promise.all([
      // 1. Semantic search
      this.vectorDb.search(query, {
        topK: 5,
        threshold: 0.7,
        filters: { userMaterials }
      }),
      
      // 2. Knowledge graph navigation
      this.knowledgeGraph.queryRelated(query, {
        maxDepth: 2,
        topK: 10
      }),
      
      // 3. Retrieve conversation history
      this.getConversationHistory(conversationId, limit: 10),
      
      // 4. Get user profile
      this.getUserProfile(userId),
    ]);
    
    // Rank and filter context
    const assembly = {
      materials: this.rankMaterials(userMaterials),
      semanticSearchResults: this.filterByRelevance(semanticResults, 0.7),
      knowledgeGraphNodes: graphNodes.slice(0, 5),
      conversationHistory: history.slice(-5), // Last 5 turns
      userProfile: profile,
      systemContext: this.buildSystemContext(),
      metadata: {
        assemblyTime: Date.now() - startTime,
        sourceCount: semanticResults.length + graphNodes.length,
        totalTokens: this.estimateTokens(assembly),
      }
    };
    
    // Cache result
    this.cache.set(cacheKey, assembly);
    
    return assembly;
  }
  
  private rankMaterials(materials: UploadedMaterial[]): UploadedMaterial[] {
    return materials.sort((a, b) => {
      // Favor recent, relevant materials
      const recencyA = this.getRecencyScore(a.uploadedAt);
      const scoreA = a.relevance * recencyA;
      const scoreB = b.relevance * this.getRecencyScore(b.uploadedAt);
      return scoreB - scoreA;
    });
  }
}
```

### Prompt Integration

Context is integrated into prompts strategically:

```
[System Prompt]

## Materials You Can Reference
- Material 1: [Title/Summary]
- Material 2: [Title/Summary]

## Previous Context
Q: [Recent question]
A: [Your previous answer]

[User's Current Request]
```

---

## Caching & Grounding Strategies

### Multi-Layer Cache Architecture

```
┌────────────────────────────────────────────┐
│         Query/Response Cache (L1)          │
│  - Fast lookup by hash of request          │
│  - TTL: 1 hour (configurable)              │
│  - Size: 10K entries                       │
└────────────────────────────────────────────┘
                     ↓ Miss
┌────────────────────────────────────────────┐
│         Semantic Cache (L2)                │
│  - Vector similarity matching              │
│  - TTL: 24 hours                           │
│  - Threshold: 0.95 similarity              │
│  - Size: 100K entries                      │
└────────────────────────────────────────────┘
                     ↓ Miss
┌────────────────────────────────────────────┐
│       Knowledge Base Cache (L3)            │
│  - Materialized views of frequently        │
│    accessed knowledge                      │
│  - TTL: 7 days                             │
│  - Pre-computed summaries                  │
└────────────────────────────────────────────┘
```

### Cache Implementation

```typescript
interface CacheEntry {
  requestHash: string;
  response: CompletionResponse;
  vectorSignature: number[]; // For semantic matching
  timestamp: Date;
  hitCount: number;
  evictionScore: number; // For LRU
}

class CacheLayer {
  private l1Cache: Map<string, CacheEntry>; // Fast hash lookup
  private l2VectorIndex: VectorIndex; // Semantic matching
  private l3Database: PersistentStore; // Long-term storage
  
  async get(request: CompletionRequest): Promise<CacheEntry | null> {
    // L1: Exact match
    const exactHash = this.hashRequest(request);
    if (this.l1Cache.has(exactHash)) {
      const entry = this.l1Cache.get(exactHash)!;
      entry.hitCount++;
      entry.evictionScore = this.calculateScore(entry);
      return entry;
    }
    
    // L2: Semantic similarity
    const vectorSig = this.vectorize(request);
    const similarMatches = await this.l2VectorIndex.search(vectorSig, {
      topK: 1,
      threshold: 0.95
    });
    
    if (similarMatches.length > 0) {
      return similarMatches[0];
    }
    
    // L3: Check long-term cache
    return await this.l3Database.findSimilar(request, {
      threshold: 0.90
    });
  }
  
  async set(request: CompletionRequest, response: CompletionResponse): void {
    const entry: CacheEntry = {
      requestHash: this.hashRequest(request),
      response,
      vectorSignature: this.vectorize(request),
      timestamp: new Date(),
      hitCount: 0,
      evictionScore: 1.0,
    };
    
    // Store in all layers
    this.l1Cache.set(entry.requestHash, entry);
    await this.l2VectorIndex.insert(entry);
    await this.l3Database.store(entry);
    
    // Trigger eviction if needed
    this.evictIfNecessary();
  }
  
  private calculateScore(entry: CacheEntry): number {
    const age = (Date.now() - entry.timestamp.getTime()) / 1000;
    const recency = Math.exp(-age / 3600); // 1 hour half-life
    return entry.hitCount * recency;
  }
}
```

### Grounding Strategies

Grounding ensures responses are anchored in provided materials:

#### Strategy 1: Direct Citation
```
User asks: "What is the main architecture?"
Response: According to section 3 of your uploaded document, the main 
architecture consists of three layers...
```

#### Strategy 2: Material-Aware Filtering
```typescript
class GroundingFilter {
  filterResponse(
    response: string,
    materials: UploadedMaterial[],
    mode: 'strict' | 'moderate' | 'loose'
  ): string {
    if (mode === 'strict') {
      // Ensure every claim references a material
      return this.enforceFullCitation(response, materials);
    } else if (mode === 'moderate') {
      // Flag unsourced claims
      return this.flagUnsourced(response, materials);
    }
    // 'loose' mode: no filtering
    return response;
  }
  
  private enforceFullCitation(
    response: string,
    materials: UploadedMaterial[]
  ): string {
    const sentences = response.split(/(?<=[.!?])\s+/);
    const grounded = sentences.map(sentence => {
      const hasReference = materials.some(m => 
        this.isReferencedIn(sentence, m)
      );
      if (!hasReference) {
        return `[UNGROUNDED: ${sentence}]`;
      }
      return sentence;
    });
    return grounded.join(' ');
  }
}
```

#### Strategy 3: Relevance Ranking
- Prioritize recent materials
- Boost materials matching query intent
- Reduce weight of low-relevance sources

---

## Streaming Responses

### Streaming Pipeline

```typescript
interface StreamingRequest extends CompletionRequest {
  onChunk?: (chunk: StreamChunk) => void;
  bufferSize?: number; // Chunk batching
  timeout?: number; // Per-chunk timeout
}

class StreamingResponseHandler {
  async *streamCompletion(
    request: StreamingRequest
  ): AsyncIterable<StreamChunk> {
    const provider = this.selectProvider(request);
    const buffer: StreamChunk[] = [];
    const bufferSize = request.bufferSize || 1; // Buffer chunks?
    
    try {
      for await (const chunk of provider.stream(request)) {
        buffer.push(chunk);
        
        if (buffer.length >= bufferSize) {
          // Flush buffer
          for (const bufferedChunk of buffer) {
            this.recordMetric('stream.chunk', {
              tokens: bufferedChunk.tokensUsed || 0,
              provider: provider.getName(),
            });
            
            if (request.onChunk) {
              request.onChunk(bufferedChunk);
            }
            
            yield bufferedChunk;
          }
          buffer.length = 0;
        }
      }
      
      // Flush remaining
      for (const chunk of buffer) {
        yield chunk;
      }
    } catch (error) {
      // Streaming error handling
      this.handleStreamError(error, request);
      throw error;
    }
  }
  
  private handleStreamError(error: Error, request: StreamingRequest): void {
    if (error.message.includes('timeout')) {
      // Switch to fallback provider for remaining response
      this.triggerFallback(request);
    } else if (error.message.includes('rate_limit')) {
      // Queue request and retry
      this.queueForRetry(request);
    } else {
      this.logError(error, request);
    }
  }
}
```

### Client-Side Streaming

```typescript
// Example usage
async function callLLMStream(query: string) {
  const stream = orchestrator.streamCompletion({
    userPrompt: query,
    learningMode: 'analysis_insights',
    context: assembledContext,
    onChunk: (chunk) => {
      // Update UI in real-time
      updateResponsePreview(chunk.delta);
      updateTokenCounter(chunk.tokensUsed);
    }
  });
  
  let fullResponse = '';
  for await (const chunk of stream) {
    fullResponse += chunk.delta;
  }
  
  return fullResponse;
}
```

---

## Fallback Handling

### Fallback Chain Configuration

```yaml
fallback_chains:
  premium_reasoning:
    providers:
      - openai-gpt4-turbo
      - anthropic-claude-opus
      - openai-gpt35
      - local-llama
    
    retry_config:
      max_attempts: 3
      backoff_strategy: exponential
      initial_delay_ms: 500
      max_delay_ms: 30000
  
  quick_response:
    providers:
      - openai-gpt35
      - anthropic-claude-sonnet
      - local-mistral
    
    retry_config:
      max_attempts: 2
      backoff_strategy: linear
      initial_delay_ms: 100
      max_delay_ms: 5000

  cost_optimized:
    providers:
      - openai-gpt35
      - local-llama
    
    retry_config:
      max_attempts: 2
      backoff_strategy: immediate
```

### Fallback Logic

```typescript
class FallbackOrchestrator {
  private circuit: CircuitBreaker;
  
  async executeWithFallback(
    request: CompletionRequest,
    chain: FallbackChain
  ): Promise<CompletionResponse> {
    const errors: ProviderError[] = [];
    
    for (let attempt = 0; attempt < chain.providers.length; attempt++) {
      const provider = chain.providers[attempt];
      
      // Check circuit breaker
      if (this.circuit.isOpen(provider)) {
        this.logFallback('Circuit breaker open', provider);
        continue;
      }
      
      try {
        this.recordAttempt(provider, attempt);
        const response = await this.executeWithTimeout(
          () => provider.complete(request),
          request.timeout || 30000
        );
        
        this.circuit.recordSuccess(provider);
        return response;
      } catch (error) {
        errors.push({
          provider: provider.getName(),
          error: error.message,
          timestamp: Date.now(),
        });
        
        this.circuit.recordFailure(provider);
        this.logFallback(`Provider failed, trying next: ${error.message}`, provider);
        
        // Apply backoff before next attempt
        await this.applyBackoff(chain.retryConfig, attempt);
      }
    }
    
    // All providers failed
    throw new AllProvidersFailedError(errors);
  }
  
  private applyBackoff(config: RetryConfig, attempt: number): Promise<void> {
    let delay: number;
    
    switch (config.backoff_strategy) {
      case 'exponential':
        delay = config.initial_delay_ms * Math.pow(2, attempt);
        break;
      case 'linear':
        delay = config.initial_delay_ms * (attempt + 1);
        break;
      case 'immediate':
        return Promise.resolve();
    }
    
    delay = Math.min(delay, config.max_delay_ms);
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private state: Map<string, 'closed' | 'open' | 'half-open'>;
  private failures: Map<string, number>;
  private lastFailureTime: Map<string, number>;
  
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RECOVERY_TIME_MS = 60000; // 1 minute
  
  recordFailure(provider: string): void {
    const count = (this.failures.get(provider) || 0) + 1;
    this.failures.set(provider, count);
    this.lastFailureTime.set(provider, Date.now());
    
    if (count >= this.FAILURE_THRESHOLD) {
      this.state.set(provider, 'open');
      console.warn(`Circuit breaker OPEN for ${provider}`);
    }
  }
  
  recordSuccess(provider: string): void {
    this.failures.set(provider, 0);
    if (this.state.get(provider) === 'half-open') {
      this.state.set(provider, 'closed');
      console.info(`Circuit breaker CLOSED for ${provider}`);
    }
  }
  
  isOpen(provider: string): boolean {
    const state = this.state.get(provider) || 'closed';
    
    if (state === 'closed') return false;
    
    if (state === 'open') {
      // Check if recovery time has passed
      const lastFailure = this.lastFailureTime.get(provider) || 0;
      if (Date.now() - lastFailure > this.RECOVERY_TIME_MS) {
        this.state.set(provider, 'half-open');
        return false; // Try once more
      }
      return true;
    }
    
    return false; // half-open, allow attempt
  }
}
```

---

## Guardrails & Safety

### Input Validation & Filtering

```typescript
class InputGuardrail {
  private patterns: {
    injectionDetection: RegExp;
    maliciousURLs: RegExp;
    PII: RegExp;
  };
  
  async validate(input: string): Promise<ValidationResult> {
    const issues: Issue[] = [];
    
    // 1. Check for prompt injection
    if (this.patterns.injectionDetection.test(input)) {
      issues.push({
        type: 'prompt_injection',
        severity: 'high',
        message: 'Potential prompt injection detected'
      });
    }
    
    // 2. Detect malicious URLs
    const urls = this.extractURLs(input);
    for (const url of urls) {
      if (await this.isMalicious(url)) {
        issues.push({
          type: 'malicious_url',
          severity: 'high',
          message: `Suspicious URL: ${url}`
        });
      }
    }
    
    // 3. Check for PII
    const piiMatches = input.match(this.patterns.PII);
    if (piiMatches) {
      issues.push({
        type: 'pii_detected',
        severity: 'medium',
        message: `Personally identifiable information detected: ${piiMatches[0]}`
      });
    }
    
    // 4. Validate length
    const tokenCount = this.countTokens(input);
    if (tokenCount > 4000) {
      issues.push({
        type: 'input_too_long',
        severity: 'low',
        message: 'Input exceeds recommended length'
      });
    }
    
    return {
      isValid: issues.filter(i => i.severity === 'high').length === 0,
      issues,
      cleaned: this.sanitize(input, issues),
    };
  }
  
  private sanitize(input: string, issues: Issue[]): string {
    let cleaned = input;
    
    for (const issue of issues) {
      if (issue.type === 'malicious_url') {
        cleaned = cleaned.replace(issue.details.url, '[URL REMOVED]');
      } else if (issue.type === 'pii_detected') {
        cleaned = cleaned.replace(issue.details.match, '[PII REDACTED]');
      }
    }
    
    return cleaned;
  }
}
```

### Output Filtering & Content Moderation

```typescript
class OutputGuardrail {
  private moderationService: ContentModeration;
  
  async filterResponse(response: string): Promise<FilteredResponse> {
    const issues: Issue[] = [];
    
    // 1. Check for harmful content
    const moderation = await this.moderationService.moderate(response);
    if (moderation.flagged) {
      issues.push({
        type: 'harmful_content',
        severity: 'high',
        message: `Content flagged for: ${moderation.categories.join(', ')}`
      });
    }
    
    // 2. Check for leaked secrets
    if (this.containsSecrets(response)) {
      issues.push({
        type: 'secret_leaked',
        severity: 'critical',
        message: 'Response contains potential API keys or credentials'
      });
    }
    
    // 3. Validate code safety
    if (this.containsCode(response)) {
      const codeIssues = this.validateCode(response);
      issues.push(...codeIssues);
    }
    
    return {
      isClean: issues.filter(i => i.severity === 'high').length === 0,
      issues,
      filtered: this.applyFilters(response, issues),
    };
  }
  
  private applyFilters(response: string, issues: Issue[]): string {
    let filtered = response;
    
    for (const issue of issues) {
      if (issue.severity === 'critical') {
        // Replace entire section
        filtered = '[CONTENT FILTERED - ' + issue.message + ']';
      } else if (issue.type === 'secret_leaked') {
        // Redact secret
        filtered = filtered.replace(
          issue.details.secret,
          '[SECRET REDACTED]'
        );
      }
    }
    
    return filtered;
  }
  
  private validateCode(response: string): Issue[] {
    const issues: Issue[] = [];
    const codeBlocks = this.extractCodeBlocks(response);
    
    for (const block of codeBlocks) {
      // Check for dangerous operations
      if (this.hasDangerousOps(block.code)) {
        issues.push({
          type: 'dangerous_code',
          severity: 'high',
          message: 'Code contains potentially dangerous operations'
        });
      }
    }
    
    return issues;
  }
}
```

### Cost Control Guardrails

```typescript
class CostGuardrail {
  private budgetManager: BudgetManager;
  
  async validateCost(request: CompletionRequest): Promise<CostValidation> {
    const estimatedTokens = this.estimateTokens(request);
    const estimatedCost = this.calculateCost(estimatedTokens, request.provider);
    
    const budget = await this.budgetManager.getCurrentBudget();
    
    return {
      estimatedTokens,
      estimatedCost,
      remainingBudget: budget.remaining,
      allowed: estimatedCost <= budget.remaining,
      warning: estimatedCost > budget.remaining * 0.8,
    };
  }
  
  async enforceLimit(request: CompletionRequest): Promise<void> {
    const validation = await this.validateCost(request);
    
    if (!validation.allowed) {
      throw new BudgetExceededError(
        `Request would exceed budget. Cost: $${validation.estimatedCost}, Remaining: $${validation.remainingBudget}`
      );
    }
    
    if (validation.warning) {
      this.logWarning(
        `Warning: Request will consume 80%+ of remaining budget`
      );
    }
  }
}
```

---

## Token Budgeting

### Budget Management System

```typescript
interface TokenBudget {
  daily: number;
  hourly: number;
  perRequest: number;
}

interface BudgetState {
  totalUsedToday: number;
  totalUsedThisHour: number;
  requestsToday: number;
  lastResetTime: Date;
  tiers: BudgetTier[];
}

interface BudgetTier {
  model: string;
  costPerMillionInputTokens: number;
  costPerMillionOutputTokens: number;
  priority: number; // Lower = higher priority
}

class TokenBudgetManager {
  private state: BudgetState;
  private config: TokenBudget;
  
  async allocate(request: CompletionRequest): Promise<Allocation> {
    await this.updateState();
    
    const estimated = this.estimateTokens(request);
    const cost = this.calculateCost(estimated, request.provider);
    
    // Check daily limit
    if (this.state.totalUsedToday + estimated.total > this.config.daily) {
      return {
        allowed: false,
        reason: 'Daily token limit exceeded',
        wouldExceed: {
          limit: this.config.daily,
          current: this.state.totalUsedToday,
          requested: estimated.total,
        }
      };
    }
    
    // Check hourly limit
    if (this.state.totalUsedThisHour + estimated.total > this.config.hourly) {
      return {
        allowed: false,
        reason: 'Hourly token limit exceeded',
        action: 'queue_request',
        queueUntil: this.calculateQueueTime(),
      };
    }
    
    // Check per-request limit
    if (estimated.total > this.config.perRequest) {
      return {
        allowed: false,
        reason: 'Single request exceeds token limit',
        suggestion: 'Break request into smaller parts or increase limit'
      };
    }
    
    return {
      allowed: true,
      allocation: {
        inputTokens: estimated.prompt,
        outputTokens: estimated.completion,
        cost,
        model: request.provider,
      }
    };
  }
  
  async consumeTokens(
    completion: CompletionResponse
  ): Promise<void> {
    const cost = this.calculateCost(completion.tokensUsed, completion.provider);
    
    this.state.totalUsedToday += completion.tokensUsed.total;
    this.state.totalUsedThisHour += completion.tokensUsed.total;
    this.state.requestsToday++;
    
    this.recordMetric('tokens.consumed', {
      total: completion.tokensUsed.total,
      input: completion.tokensUsed.prompt,
      output: completion.tokensUsed.completion,
      cost,
      model: completion.model,
    });
  }
  
  private async updateState(): Promise<void> {
    const now = new Date();
    
    // Reset hourly if needed
    if (this.isNewHour(this.state.lastResetTime, now)) {
      this.state.totalUsedThisHour = 0;
    }
    
    // Reset daily if needed
    if (this.isNewDay(this.state.lastResetTime, now)) {
      this.state.totalUsedToday = 0;
      this.state.requestsToday = 0;
    }
    
    this.state.lastResetTime = now;
  }
  
  getRemainingBudget(): RemainingBudget {
    return {
      daily: {
        remaining: this.config.daily - this.state.totalUsedToday,
        percentage: ((this.config.daily - this.state.totalUsedToday) / this.config.daily) * 100,
      },
      hourly: {
        remaining: this.config.hourly - this.state.totalUsedThisHour,
        percentage: ((this.config.hourly - this.state.totalUsedThisHour) / this.config.hourly) * 100,
      }
    };
  }
}
```

### Token Estimation

```typescript
class TokenEstimator {
  private providers: Map<string, TokenCounter>;
  
  estimateTokens(request: CompletionRequest): EstimatedTokens {
    const counter = this.getCounterForProvider(request.provider);
    
    return {
      prompt: counter.count(
        request.systemPrompt + 
        request.userPrompt +
        this.serializeContext(request.context)
      ),
      completion: this.estimateCompletionTokens(request),
      total: 0, // Updated below
    };
  }
  
  private estimateCompletionTokens(request: CompletionRequest): number {
    const maxTokens = request.maxTokens || 2000;
    
    // Conservative estimate: use maxTokens as ceiling
    // Typical completion is 60-70% of max for chat models
    return Math.floor(maxTokens * 0.65);
  }
  
  private serializeContext(context: ContextAssembly): string {
    return (
      context.materials.map(m => m.content).join('\n') +
      context.semanticSearchResults.map(r => r.content).join('\n') +
      context.conversationHistory.map(t => t.content).join('\n')
    );
  }
}
```

### Budget Configuration

```yaml
token_budgets:
  default:
    daily: 1000000  # 1M tokens/day
    hourly: 100000  # 100K tokens/hour
    perRequest: 10000
    costLimit:
      daily: 100    # $100/day
      hourly: 10    # $10/hour
  
  premium_user:
    daily: 10000000  # 10M tokens/day
    hourly: 1000000  # 1M tokens/hour
    perRequest: 50000
    costLimit:
      daily: 1000
      hourly: 100
  
  enterprise:
    daily: unlimited
    hourly: unlimited
    perRequest: unlimited
    costLimit:
      daily: custom
      hourly: custom

model_costs:
  openai:
    gpt-4-turbo:
      inputPer1MTokens: 10
      outputPer1MTokens: 30
    gpt-3.5-turbo:
      inputPer1MTokens: 0.5
      outputPer1MTokens: 1.5
  
  anthropic:
    claude-3-opus:
      inputPer1MTokens: 15
      outputPer1MTokens: 75
    claude-3-sonnet:
      inputPer1MTokens: 3
      outputPer1MTokens: 15
```

---

## Observability

### Metrics Collection

```typescript
interface RequestMetrics {
  requestId: string;
  timestamp: Date;
  userId: string;
  
  // Request details
  learningMode: LearningMode;
  provider: string;
  model: string;
  
  // Timing
  requestDuration: number; // Total latency
  providerLatency: number; // Provider response time
  contextAssemblyTime: number;
  tokenCountingTime: number;
  
  // Tokens
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  
  // Cost
  estimatedCost: number;
  actualCost: number;
  
  // Quality
  cacheHit: boolean;
  fallbacksUsed: number;
  completionReason: string; // 'stop' | 'length' | 'error'
  
  // Safety
  inputValidationIssues: number;
  outputFilteringIssues: number;
  
  // Status
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

class MetricsCollector {
  private buffer: RequestMetrics[] = [];
  private readonly FLUSH_INTERVAL = 60000; // 1 minute
  private readonly BUFFER_SIZE = 1000;
  
  collect(metrics: RequestMetrics): void {
    this.buffer.push(metrics);
    
    // Auto-flush if buffer full or interval elapsed
    if (this.buffer.length >= this.BUFFER_SIZE) {
      this.flush();
    }
  }
  
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    const batch = this.buffer.splice(0);
    
    // Send to observability platform
    await this.sendToBackend(batch);
    
    // Update local aggregates
    this.updateAggregates(batch);
  }
  
  private updateAggregates(batch: RequestMetrics[]): void {
    // Calculate running stats
    const avgLatency = batch.reduce((sum, m) => sum + m.requestDuration, 0) / batch.length;
    const cacheHitRate = batch.filter(m => m.cacheHit).length / batch.length;
    const errorRate = batch.filter(m => !m.success).length / batch.length;
    
    this.recordGauge('request.latency.avg', avgLatency);
    this.recordGauge('cache.hit_rate', cacheHitRate);
    this.recordGauge('request.error_rate', errorRate);
  }
}
```

### Structured Logging

```typescript
interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  component: string;
  message: string;
  context: {
    requestId?: string;
    userId?: string;
    provider?: string;
    model?: string;
  };
  data: Record<string, any>;
  error?: {
    type: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private handlers: LogHandler[];
  
  log(entry: LogEntry): void {
    // Add default context
    entry.timestamp = new Date();
    
    for (const handler of this.handlers) {
      handler.handle(entry);
    }
  }
  
  info(message: string, data?: any, context?: LogContext): void {
    this.log({
      level: 'info',
      component: this.component,
      message,
      context: context || {},
      data: data || {},
    });
  }
  
  error(message: string, error: Error, data?: any, context?: LogContext): void {
    this.log({
      level: 'error',
      component: this.component,
      message,
      context: context || {},
      data: data || {},
      error: {
        type: error.constructor.name,
        message: error.message,
        stack: error.stack,
      }
    });
  }
}
```

### Tracing & Distributed Tracing

```typescript
interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  operation: string;
  status: 'ok' | 'error';
  attributes: Record<string, any>;
  events: SpanEvent[];
}

class TracingManager {
  private tracer: Tracer;
  
  startSpan(operation: string, attributes?: Record<string, any>): Span {
    return this.tracer.startSpan({
      operation,
      attributes: {
        ...attributes,
        timestamp: new Date(),
      }
    });
  }
  
  endSpan(span: Span, status: 'ok' | 'error', message?: string): void {
    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    span.status = status;
    
    if (message) {
      span.events.push({
        name: status === 'ok' ? 'completed' : 'failed',
        message,
        timestamp: new Date(),
      });
    }
    
    this.tracer.exportSpan(span);
  }
}
```

### Dashboard & Alerts

Key metrics to expose:

1. **Performance**
   - Average response latency (by provider, mode)
   - P50, P95, P99 latencies
   - Streaming chunk delivery rate
   - Cache hit rate

2. **Usage**
   - Tokens consumed (daily, hourly)
   - Requests per minute
   - Cost trend
   - Model distribution

3. **Quality**
   - Success rate
   - Fallback frequency
   - Content moderation flags
   - Error rate by provider

4. **Safety**
   - Input validation issues
   - Output filtering issues
   - Cost anomalies
   - Budget utilization

Alert Conditions:
- Error rate > 5%
- Average latency > 5 seconds
- Cache hit rate < 20%
- Budget consumption > 80%
- Provider circuit breaker open

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Implement abstraction layer with 2 providers (OpenAI, Local)
- [ ] Basic context assembly pipeline
- [ ] Simple prompt templates (3-4 modes)
- [ ] Request/response caching (L1)
- [ ] Token estimation and basic budgeting

### Phase 2: Robustness (Weeks 3-4)
- [ ] Add Anthropic and Azure providers
- [ ] Implement fallback chain with circuit breaker
- [ ] Enhance guardrails (input/output filtering)
- [ ] Multi-layer caching (L2/L3)
- [ ] Streaming support

### Phase 3: Intelligence (Weeks 5-6)
- [ ] Semantic caching with vector search
- [ ] Knowledge graph integration
- [ ] Advanced context assembly
- [ ] All learning modes (6 total)
- [ ] Prompt optimization

### Phase 4: Operations (Weeks 7-8)
- [ ] Comprehensive metrics collection
- [ ] Distributed tracing
- [ ] Structured logging
- [ ] Dashboard and alerts
- [ ] Performance tuning

### Phase 5: Scale (Ongoing)
- [ ] Auto-scaling based on load
- [ ] Cost optimization algorithms
- [ ] Model fine-tuning pipeline
- [ ] Advanced monitoring and analytics

---

## Configuration Example

```yaml
# config/llm-orchestration.yaml

orchestrator:
  cache_enabled: true
  fallback_enabled: true
  streaming_enabled: true

providers:
  primary_chain:
    - type: openai
      model: gpt-4-turbo
      api_key: ${OPENAI_API_KEY}
      timeout: 30000
      rate_limits:
        rpm: 90
        tpm: 2000000
    
    - type: anthropic
      model: claude-3-opus
      api_key: ${ANTHROPIC_API_KEY}
      timeout: 30000
      rate_limits:
        rpm: 50
        tpm: 1000000

budgets:
  default_user:
    daily_tokens: 1000000
    hourly_tokens: 100000
    daily_cost: 100
    hourly_cost: 10

guardrails:
  input_validation: true
  output_moderation: true
  secret_detection: true
  injection_detection: true
  rate_limiting: true

caching:
  l1:
    enabled: true
    ttl: 3600
    max_entries: 10000
  l2:
    enabled: true
    ttl: 86400
    max_entries: 100000
    backend: redis
  l3:
    enabled: true
    ttl: 604800
    backend: postgres

observability:
  metrics:
    enabled: true
    export_interval: 60000
    backend: prometheus
  
  logging:
    level: info
    structured: true
    backend: elasticsearch
  
  tracing:
    enabled: true
    sample_rate: 0.1
    backend: jaeger
```

---

## Success Criteria

For the AI services team to consider this architecture production-ready:

✅ **Functionality**
- All 6 learning modes fully operational
- Seamless provider fallback with <100ms overhead
- Streaming responses working with <50ms chunk latency
- Caching improving hit rate to >30%

✅ **Reliability**
- 99.5% uptime with fallback chains
- Circuit breaker preventing cascading failures
- Automatic retry with exponential backoff

✅ **Safety**
- All PII automatically redacted from logs
- Input/output validation preventing injection
- Cost guardrails preventing budget overruns

✅ **Performance**
- Average latency <2 seconds
- P99 latency <5 seconds
- Token counting overhead <50ms

✅ **Cost Efficiency**
- Intelligent model selection reducing costs by 20%
- Cache hit rate >30% reducing API calls
- Budget enforcement preventing surprises

✅ **Observability**
- <1s trace collection latency
- Comprehensive error categorization
- Automated alerting for anomalies

---

## References & Resources

- [LLM API Documentation](./llm-apis.md)
- [Provider Integration Guide](./provider-integration.md)
- [Context Assembly Details](./context-assembly.md)
- [Safety & Compliance](./safety-compliance.md)
- [Performance Tuning](./performance-tuning.md)
