# 🤖 AI Harness + MCP 통합 데모

> **AI Harness**와 **Model Context Protocol(MCP)**를 함께 학습하기 위한 스터디 프로젝트입니다.
> 4개의 AI 에이전트가 파이프라인으로 협력하여 리서치 보고서를 자동 생성합니다.

---

## 📚 목차

1. [핵심 개념](#-핵심-개념)
2. [시스템 아키텍처](#-시스템-아키텍처)
3. [MCP란 무엇인가](#-mcp란-무엇인가)
4. [AI Harness란 무엇인가](#-ai-harness란-무엇인가)
5. [구현 코드 설명](#-구현-코드-설명)
6. [실행 방법](#-실행-방법)
7. [파이프라인 흐름](#-파이프라인-흐름)
8. [학습 포인트](#-학습-포인트)
9. [확장 아이디어](#-확장-아이디어)

---

## 💡 핵심 개념

### AI Harness (AI 하네스)

```
하네스(Harness) = 마구(馬具) → 말을 제어하는 장비
AI 하네스        = 여러 AI를 묶어서 체계적으로 제어/운용하는 프레임워크
```

**쉽게 말하면**: 여러 AI 에이전트들이 각자 역할을 맡아 협력하는 시스템

### MCP (Model Context Protocol)

```
기존 방식:  AI ──→ Tool A (각각 커스텀 코드)
            AI ──→ Tool B (각각 커스텀 코드)

MCP 방식:   AI ──→ MCP Protocol ──→ Tool A
                                 ──→ Tool B
                                 ──→ Tool C
```

**쉽게 말하면**: AI와 외부 도구를 연결하는 **"USB 표준"** — Anthropic이 2024년 발표

---

## 🏗 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    AI Harness + MCP                      │
│                                                          │
│  사용자 쿼리                                              │
│      │                                                   │
│      ▼                                                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Orchestrator (지휘자)                │   │
│  │         파이프라인 순서 결정 & 컨텍스트 전달       │   │
│  └───┬────────────┬──────────────┬──────────────┬───┘   │
│      │            │              │              │        │
│      ▼            ▼              ▼              ▼        │
│  ┌────────┐  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
│  │  🔍    │  │  📊     │  │   ⚖️     │  │    ✨     │  │
│  │Resear- │  │Analyst  │  │  Critic  │  │Synthesizer│  │
│  │cher    │  │         │  │          │  │           │  │
│  └───┬────┘  └────┬────┘  └────┬─────┘  └─────┬─────┘  │
│      │            │              │              │        │
│      ▼            ▼              ▼              │        │
│  ┌───────┐  ┌──────────┐  ┌──────────┐         │        │
│  │  MCP  │  │   MCP    │  │   MCP    │         │        │
│  │web_   │  │analyze_  │  │fact_     │         │        │
│  │search │  │text      │  │check     │         │        │
│  └───────┘  └──────────┘  └──────────┘         │        │
│                                                  ▼        │
│                                           최종 보고서      │
└─────────────────────────────────────────────────────────┘
```

---

## 🔌 MCP란 무엇인가

### 핵심 구성 요소

| 개념 | 설명 | 이 프로젝트에서 |
|------|------|----------------|
| **Tools** | AI가 호출할 수 있는 함수 | `web_search`, `analyze_text`, `fact_check` |
| **Resources** | AI가 읽을 수 있는 데이터 | (추후 확장 가능) |
| **Prompts** | 재사용 가능한 프롬프트 | (추후 확장 가능) |

### MCP Tool 정의 방식

```typescript
// src/mcp/tools.ts
{
  name: "web_search",
  description: "주어진 쿼리로 웹을 검색합니다",  // ← AI가 이걸 보고 언제 쓸지 판단!
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "검색할 쿼리" }
    },
    required: ["query"]
  }
}
```

### MCP ↔ OpenAI 연동 흐름

```
1. MCP Tool 정의 (JSON Schema)
        ↓
2. OpenAI Function Calling 형식으로 변환
        ↓
3. OpenAI API 호출 시 tools 파라미터로 전달
        ↓
4. AI가 Tool 호출 결정 → finish_reason: "tool_calls"
        ↓
5. executeMCPTool() 실행 → 결과 반환
        ↓
6. 결과를 메시지 히스토리에 추가
        ↓
7. AI가 결과 보고 최종 응답 생성
```

### 통신 방식 비교

| 방식 | 사용 환경 | 특징 |
|------|-----------|------|
| **stdio** | 로컬 프로세스 | stdin/stdout, Claude Desktop |
| **SSE (HTTP)** | 원격/웹 | HTTP 기반, 이 프로젝트에서 사용 |

---

## 🎯 AI Harness란 무엇인가

### 주요 패턴

| 패턴 | 설명 | 이 프로젝트 |
|------|------|-------------|
| **Pipeline** | A→B→C 순서 처리 | ✅ 사용 |
| **Parallel** | 동시 실행 후 통합 | - |
| **Debate** | 서로 토론/검증 | - |
| **Supervisor** | 상위 AI가 하위 AI 감독 | - |
| **Reflexion** | 자기 반복 검증 | - |

### 에이전트 역할 분담

```typescript
// src/harness/agent.ts
const AGENT_CONFIGS = {
  researcher: {
    systemPrompt: "전문 리서처...",
    allowedTools: ["web_search"]         // ← 이 에이전트만 쓸 수 있는 MCP Tools
  },
  analyst: {
    systemPrompt: "데이터 분석 전문가...",
    allowedTools: ["analyze_text"]
  },
  critic: {
    systemPrompt: "비판적 사고 전문가...",
    allowedTools: ["fact_check"]
  },
  synthesizer: {
    systemPrompt: "최종 보고서 작성 전문가...",
    allowedTools: []                     // ← 도구 없이 종합만 담당
  }
}
```

### 컨텍스트 전달 메커니즘

```
Researcher 출력
    │
    ▼ (previousContext로 전달)
Analyst 입력 = "이전 에이전트 결과: [Researcher 출력]\n\n현재 작업: ..."
    │
    ▼ (researcher + analyst 출력 모두 전달)
Critic 입력  = "[리서처 결과]\n...\n[분석가 결과]\n...\n\n현재 작업: ..."
    │
    ▼ (모든 이전 출력 전달)
Synthesizer 입력 = "[리서치]\n...\n[분석]\n...\n[검증]\n...\n\n최종 보고서 작성"
```

---

## 📁 구현 코드 설명

### 프로젝트 구조

```
webapp/
├── src/
│   ├── server.ts              # 메인 서버 + 프론트엔드 UI
│   ├── mcp/
│   │   └── tools.ts           # MCP Tool 정의 & 실행기
│   ├── harness/
│   │   ├── types.ts           # 타입 정의
│   │   ├── agent.ts           # 단일 Agent 실행 로직
│   │   └── orchestrator.ts    # Harness 파이프라인 오케스트레이터
│   └── routes/
│       └── api.ts             # Hono API 라우트
├── ecosystem.config.cjs       # PM2 설정
├── package.json
└── tsconfig.json
```

### 핵심 파일별 역할

#### `src/mcp/tools.ts` — MCP 핵심

```typescript
// Tool 등록
export const MCP_TOOLS = [
  { name: "web_search", description: "...", inputSchema: {...} },
  { name: "analyze_text", description: "...", inputSchema: {...} },
  { name: "fact_check", description: "...", inputSchema: {...} }
];

// Tool 실행
export async function executeMCPTool(toolName, args) {
  switch(toolName) {
    case "web_search": return await callSearchAPI(args.query);
    case "analyze_text": return await analyzeText(args.text);
    case "fact_check": return await checkFact(args.claim);
  }
}

// OpenAI 형식으로 변환
export function convertToOpenAITools(mcpTools) {
  return mcpTools.map(tool => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.inputSchema }
  }));
}
```

#### `src/harness/agent.ts` — Agent 핵심 루프

```typescript
// Tool Calling 루프
while (iteration < maxIterations) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    tools: openAITools,    // MCP Tools를 OpenAI 형식으로 변환해서 전달
    tool_choice: "auto"    // AI가 자율적으로 결정
  });

  if (response.choices[0].finish_reason === "tool_calls") {
    // AI가 도구 호출을 결정한 경우
    const result = await executeMCPTool(toolName, toolArgs);
    messages.push({ role: "tool", content: result });
    continue;  // 결과 보고 다시 판단하게 루프 계속
  }
  
  if (response.choices[0].finish_reason === "stop") {
    // AI가 최종 응답 생성 완료
    return response.choices[0].message.content;
  }
}
```

#### `src/routes/api.ts` — SSE 스트리밍

```typescript
// Server-Sent Events로 실시간 전송
return new Response(
  new ReadableStream({
    async start(controller) {
      await runHarness(query, apiKey, (agentLog) => {
        // 에이전트 완료시마다 실시간 전송
        controller.enqueue(`event: agent_complete\ndata: ${JSON.stringify(agentLog)}\n\n`);
      });
      controller.close();
    }
  }),
  { headers: { "Content-Type": "text/event-stream" } }
);
```

---

## 🚀 실행 방법

### 사전 요구사항

- Node.js 18+
- OpenAI API Key

### 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 서버 실행 (PM2)
pm2 start ecosystem.config.cjs

# 3. 브라우저에서 접속
open http://localhost:3000
```

### API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/health` | 서버 상태 + MCP 도구 목록 |
| GET | `/api/tools` | MCP Tool 전체 목록 |
| POST | `/api/harness` | Harness 실행 (SSE) |

### 테스트 쿼리 예시

```bash
curl -X POST http://localhost:3000/api/harness \
  -H "Content-Type: application/json" \
  -d '{"query": "AI Harness의 미래 전망", "apiKey": "sk-..."}'
```

---

## 🔄 파이프라인 흐름

```
Step 1: Researcher
  → web_search("AI Harness와 MCP의 미래 전망") 호출
  → MCP가 검색 결과 반환
  → 리서치 요약 생성

Step 2: Analyst  
  → [Step 1 결과]를 컨텍스트로 받음
  → analyze_text(리서치 내용) 호출
  → 핵심 인사이트 추출

Step 3: Critic
  → [Step 1+2 결과]를 컨텍스트로 받음
  → fact_check(주요 주장들) 호출
  → 검증 및 보완점 제시

Step 4: Synthesizer
  → [Step 1+2+3 결과]를 컨텍스트로 받음
  → 도구 없이 종합
  → 최종 보고서 생성
```

---

## 📖 학습 포인트

### 1. MCP의 핵심 가치

```
문제: AI마다 다른 방식으로 도구 연동 → 파편화
해결: 표준화된 인터페이스로 "한번 만들면 어디서나 사용"

현실 비유:
  기존: TV 리모컨, 에어컨 리모컨, 선풍기 리모컨 (각각 따로)
  MCP:  만능 리모컨 하나로 모든 가전 제어
```

### 2. Tool Calling의 동작 원리

```
AI는 "언제 도구를 쓸지"를 description 보고 스스로 판단합니다.
→ description 작성이 매우 중요!

나쁜 예: description: "데이터 처리"  (모호함)
좋은 예: description: "최신 웹 정보가 필요할 때 검색. 현재 날씨, 최근 뉴스, 실시간 데이터 조회에 사용"
```

### 3. Agent 컨텍스트 전달

```
각 에이전트는 독립적이지만,
이전 에이전트의 결과를 "시스템 메시지 + 유저 메시지"로 받아
문맥을 유지하며 작업합니다.
```

### 4. SSE vs WebSocket

```
이 프로젝트에서 SSE를 선택한 이유:
✅ 서버→클라이언트 단방향으로 충분
✅ HTTP 기반으로 방화벽 친화적  
✅ 자동 재연결 지원
✅ 구현 단순함
```

### 5. 에이전트 역할 분리의 장점

```
단일 AI에게 모든 걸 시키면:
→ 지시가 길어질수록 품질 저하
→ 어디서 실패했는지 추적 어려움

역할 분리하면:
→ 각자 전문화 → 품질 향상
→ 단계별 디버깅 가능
→ 필요한 에이전트만 교체/수정 가능
```

---

## 🔮 확장 아이디어

### 단기 (바로 구현 가능)

- [ ] **실제 웹 검색** 연동 (Brave Search API, Tavily API)
- [ ] **Debate 패턴** 추가 (찬성봇 vs 반대봇)
- [ ] **Reflexion 패턴** (자기 검증 루프)
- [ ] 에이전트 수/순서 **동적 설정**

### 중기

- [ ] **실제 MCP 서버** 분리 (stdio 방식)
- [ ] **에이전트 메모리** 추가 (대화 히스토리 유지)
- [ ] **병렬 실행** 패턴 구현
- [ ] **Cloudflare D1**으로 실행 기록 저장

### 장기

- [ ] **Claude + GPT 혼합** 하네스 (모델별 특기 활용)
- [ ] **자율 계획** 에이전트 (사람이 파이프라인 설계 안해도 됨)
- [ ] **멀티모달** 지원 (이미지 분석 에이전트)

---

## 🛠 기술 스택

| 분류 | 기술 |
|------|------|
| **Runtime** | Node.js 18+ |
| **Framework** | Hono v4 |
| **AI SDK** | OpenAI Node.js SDK v4 |
| **MCP** | @modelcontextprotocol/sdk |
| **Language** | TypeScript |
| **Process Manager** | PM2 |
| **Frontend** | Vanilla JS + Tailwind CSS CDN |
| **Streaming** | Server-Sent Events (SSE) |

---

## 📝 스터디 메모

### 배운 것

1. **MCP = AI-Tool 연결 표준화** → 한번 만들면 어떤 AI에도 붙일 수 있다
2. **Harness = 오케스트레이션** → 누가 언제 뭘 할지 제어하는 지휘자
3. **Tool Calling Loop** → AI가 "충분하다"고 판단할 때까지 도구 계속 호출 가능
4. **Pipeline 패턴** → 단순하지만 강력, 각 단계 결과가 다음 단계 입력이 됨
5. **SSE로 실시간 UI** → 긴 작업도 단계별로 사용자에게 즉시 피드백 가능

### 더 공부할 것

- [ ] LangChain, LangGraph와의 비교
- [ ] AutoGPT, CrewAI 등 기존 프레임워크와 MCP의 관계
- [ ] MCP 공식 서버 저장소 탐색 (github.com/modelcontextprotocol/servers)
- [ ] Supervisor 패턴 구현

---

*이 프로젝트는 AI Harness와 MCP 학습을 위한 스터디 데모입니다.*
