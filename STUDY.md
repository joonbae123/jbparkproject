# AI Harness + MCP 설계 스터디 노트

> 이 문서는 직접 구현한 데모 앱의 설계를 **있는 그대로** 기록한 스터디 노트입니다.  
> "어떤 AI를, 어떤 역할로, 왜 그렇게 설계했는가"를 중심으로 설명합니다.

---

## 1. 전체 구조 한눈에 보기

```
사용자 쿼리 입력
      │
      ▼
┌─────────────────────────────────────────────────────┐
│                  오케스트레이터                        │
│              (orchestrator.ts - TypeScript 코드)      │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │              피드백 루프                       │    │
│  │                                              │    │
│  │  🔍 Researcher ──► 📊 Analyst ──► ⚖️ Critic  │    │
│  │       ▲                              │       │    │
│  │       │         반려(점수 미달)        │       │    │
│  │       └──────────────────────────────┘       │    │
│  │                      │                       │    │
│  │               승인(점수 달성)                 │    │
│  └──────────────────────┼───────────────────────┘    │
│                         ▼                             │
│                  ✨ Synthesizer                        │
└─────────────────────────────────────────────────────┘
      │
      ▼
최종 보고서 + 반려/재시도 리포트
```

---

## 2. 사용한 AI 모델: 딱 하나, GPT-4o-mini

### 왜 GPT-4o-mini 하나만 사용했나?

이 데모는 **"역할이 다른 AI 여러 개"가 아니라 "역할이 다른 프롬프트 여러 개"** 를 실험합니다.

```
흔한 오해:
  에이전트 4개 = AI 모델 4개 (GPT, Claude, Gemini, Llama...)

실제 구현:
  에이전트 4개 = GPT-4o-mini 하나 × 시스템 프롬프트 4가지
```

**GPT-4o-mini를 선택한 이유:**

| 이유 | 설명 |
|------|------|
| 비용 | gpt-4o 대비 약 15배 저렴. 에이전트 4개 × 재시도 = 많은 API 호출 |
| 속도 | 응답이 빠름. 4개 에이전트 순차 실행 시 체감 속도가 중요 |
| 품질 | Tool Calling(도구 호출)과 JSON 출력을 안정적으로 지원 |
| 목적 | 이 데모의 목적은 모델 성능 비교가 아니라 **구조 학습** |

### OpenAI API 호출 방식: SDK 아닌 직접 fetch

```typescript
// src/harness/agent.ts

async function callOpenAI(apiKey: string, projectId: string, body: object) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      ...(projectId ? { "OpenAI-Project": projectId } : {})
    },
    body: JSON.stringify(body)
  });
  // 응답 텍스트를 직접 파싱
  const text = await res.text();
  if (!res.ok) { /* 에러 처리 */ }
  return JSON.parse(text);
}
```

**SDK 대신 fetch를 쓴 이유:**  
openai Node.js SDK 4.x에서 특정 환경(sandbox)에 `401 status code (no body)` 버그가 발생했습니다.  
SDK 내부에서 응답 body를 파싱하지 못하는 문제였고, `fetch`로 직접 호출하면 raw text를 먼저 받아 정확한 에러 메시지를 얻을 수 있어서 우회했습니다.

---

## 3. 에이전트 설계: 4개의 역할

각 에이전트는 **시스템 프롬프트 + 허용된 MCP 도구 목록**으로 정의됩니다.  
같은 GPT-4o-mini라도 시스템 프롬프트가 다르면 완전히 다른 방식으로 응답합니다.

### 에이전트 1: 🔍 Researcher (리서처)

```typescript
// src/harness/agent.ts - AGENT_CONFIGS

researcher: {
  name: "리서처 에이전트",
  systemPrompt: `당신은 전문 리서처입니다.
주어진 주제에 대해 web_search 도구를 적극적으로 활용하여 관련 정보를 수집하세요.
수집한 정보를 명확하고 구조적으로 정리해주세요.`,
  allowedTools: ["web_search"]   // ← 이 도구만 사용 가능
}
```

**역할**: 주제에 대한 원시 정보(raw data) 수집  
**도구**: `web_search` (MCP Tool)  
**왜 이 도구만?**: 정보 수집 단계에서 분석이나 검증을 섞으면 편향이 생김. 수집은 수집만.  
**출력**: 검색 결과 기반 구조화된 정보 요약

**재시도 시 동작:**  
Critic이 반려하면 이전 반려 피드백이 프롬프트에 추가됩니다.

```typescript
`다음 주제에 대해 리서치하세요: "${query}"
${previousFeedback ? `\n[이전 반려 피드백 - 반드시 반영하세요]\n${previousFeedback}` : ""}`
```

---

### 에이전트 2: 📊 Analyst (분석가)

```typescript
analyst: {
  name: "분석가 에이전트",
  systemPrompt: `당신은 데이터 분석 전문가입니다.
이전 리서처가 수집한 정보를 analyze_text 도구로 분석하고,
핵심 인사이트와 패턴을 추출하세요.
데이터 기반의 객관적인 분석을 제공하세요.`,
  allowedTools: ["analyze_text"]
}
```

**역할**: Researcher 출력을 받아 구조적 분석 수행  
**도구**: `analyze_text` (MCP Tool) — 키워드 추출, 감정 분석, 주제 분류  
**입력**: Researcher 출력 (최대 1,500자로 잘라서 전달)  
**왜 잘라서 전달?**: 컨텍스트 윈도우 낭비 방지 + 토큰 비용 절약

```typescript
// orchestrator.ts
const trimContext = (text: string, maxLen = 1500) =>
  text.length > maxLen ? text.slice(0, maxLen) + "\n...(이하 생략)" : text;
```

---

### 에이전트 3: ⚖️ Critic (비평가 / 판정관)

**이 에이전트가 핵심입니다.** 두 가지 모드로 동작합니다.

#### 모드 A: 일반 실행 (`runAgent`)
```typescript
critic: {
  systemPrompt: `당신은 비판적 사고 전문가입니다.
fact_check 도구를 사용하여 주요 주장들을 검증하세요.
논리적 허점이나 개선점을 지적하고, 균형잡힌 시각을 제공하세요.`,
  allowedTools: ["fact_check"]
}
```

#### 모드 B: 판정 전용 (`runCriticJudgement`)
피드백 루프를 위해 별도로 만든 함수입니다.  
일반 텍스트가 아닌 **반드시 JSON으로만 응답**하도록 강제합니다.

```typescript
// agent.ts - runCriticJudgement()

const systemPrompt = `당신은 엄격한 품질 관리 비평가입니다.
판정 기준:
- 점수 ${targetScore}점 이상: 승인 (approved)
- 점수 ${targetScore - 1}점 이하: 반려 (rejected)

반드시 이 JSON 형식으로만 응답 (다른 텍스트 금지):
{
  "verdict": "approved" 또는 "rejected",
  "score": 0~100 사이 숫자,
  "reason": "판정 이유 한 문장",
  "issues": ["문제점1", "문제점2"],
  "suggestions": ["개선제안1", "개선제안2"]
}`;
```

**왜 판정 함수를 분리했나?**

| 일반 runAgent | runCriticJudgement |
|------------|-------------------|
| 자유로운 텍스트 출력 | 반드시 JSON 출력 |
| 분석/비평 서술 | 승인/반려 판정만 |
| 다음 에이전트 입력으로 사용 | 오케스트레이터가 파싱하여 루프 제어 |

JSON 파싱 실패 시 fallback 처리도 있습니다:
```typescript
const fallbackJudgement: CriticJudgement = {
  verdict: "approved",   // 파싱 실패 시 기본 승인 (무한루프 방지)
  score: 60,
  reason: "판정 오류로 기본 승인 처리",
  ...
};
```

**temperature를 낮게 설정한 이유:**
```typescript
// 판정은 일관성이 중요 → temperature 낮게
{ model: "gpt-4o-mini", temperature: 0.3, max_tokens: 1000 }

// 리서치/분석은 창의성 필요 → temperature 기본값
{ model: "gpt-4o-mini", temperature: 0.7, max_tokens: 2000 }
```

---

### 에이전트 4: ✨ Synthesizer (종합가)

```typescript
synthesizer: {
  systemPrompt: `당신은 최종 보고서 작성 전문가입니다.
이전 모든 에이전트들의 작업을 종합하여 명확하고 실용적인 최종 보고서를 작성하세요.
보고서 형식: 요약 → 주요 발견사항 → 인사이트 → 결론`,
  allowedTools: []   // ← 도구 없음. 종합만 수행.
}
```

**역할**: Researcher + Analyst + Critic 출력 3개를 받아 최종 보고서 작성  
**도구**: 없음  
**왜 도구가 없나?**: 이 단계는 새 정보 수집이 아니라 **기존 정보 종합**. 도구 호출은 불필요한 비용.

강제 종료(목표 점수 미달) 시 특이사항을 보고서에 명시합니다:
```typescript
const forcedNote = forcedStop
  ? `\n⚠️ 주의: 목표 점수(${cfg.targetScore}점)에 도달하지 못한 채 강제 종료된 결과입니다.`
  : "";
```

---

## 4. MCP (Model Context Protocol) 설계

### MCP가 필요한 이유

AI 모델은 기본적으로 **학습된 지식만** 사용합니다.  
실시간 정보, 외부 데이터베이스, 파일 시스템 등에 접근하려면 "도구"가 필요합니다.

MCP는 이 도구들을 **표준 인터페이스**로 정의하는 규격입니다.

```
MCP 없이:
  AI → (학습 데이터만 사용) → 응답

MCP 있으면:
  AI → "web_search 도구 필요" → MCP Client → MCP Server → 실제 검색 → 결과 반환
  AI → (검색 결과 포함) → 응답
```

### 이 데모의 MCP Tool 3개

```typescript
// src/mcp/tools.ts

// 1. web_search: 웹 검색 시뮬레이션
// → Researcher 전용. 실제 환경에서는 Brave API, Tavily 등과 연결.

// 2. analyze_text: 텍스트 분석
// → Analyst 전용. 키워드 추출, 감정 분석, 주제 분류.

// 3. fact_check: 팩트 체크
// → Critic 전용. 주장의 신뢰도 평가.
```

**⚠️ 주의: 이 데모의 MCP Tools는 시뮬레이션입니다**

```typescript
case "web_search": {
  // 실제: Brave Search API, Tavily API 등 호출
  // 데모: 쿼리를 받아서 템플릿 문자열 반환 (구조 학습 목적)
  return {
    content: `[웹 검색 결과: "${query}"]
검색 결과 1: ${query}에 관한 최근 연구에 따르면...`
  };
}
```

실제 프로덕션에서는 이 부분만 실제 API 호출로 교체하면 됩니다.

### AI가 도구를 "스스로 선택"하는 원리

OpenAI의 Function Calling 기능을 활용합니다.

```typescript
// 1. 도구 목록을 OpenAI 형식으로 변환해서 전달
const response = await callOpenAI(apiKey, projectId, {
  model: "gpt-4o-mini",
  messages: [...],
  tools: openAITools,     // ← 사용 가능한 도구 목록
  tool_choice: "auto"     // ← AI가 알아서 필요한 도구 선택
});

// 2. AI가 도구 호출을 결정하면
if (choice.finish_reason === "tool_calls") {
  // 3. 실제로 도구 실행
  const result = await executeMCPTool(toolName, args);
  // 4. 결과를 대화에 추가하고 다시 AI에 전달
  messages.push({ role: "tool", content: result.content });
  // 5. AI가 결과를 보고 최종 응답 or 다음 도구 호출 결정
}
```

### Tool Loop (도구 반복 호출)

AI가 한 번에 원하는 정보를 얻지 못하면 **같은 도구를 여러 번** 호출할 수 있습니다.

```
while (iteration < 3) {
  응답 받기
  → 도구 호출 결정? → 도구 실행 → 결과 추가 → 다시 요청
  → 최종 텍스트 응답? → 루프 탈출
}
```

실제 로그에서 Critic이 `fact_check`를 여러 번 호출하는 것을 볼 수 있습니다:
```
[비평가] MCP Tool 호출: fact_check { claim: 'AI 시장 규모...' }
[비평가] MCP Tool 호출: fact_check { claim: 'MCP 도입 사례...' }
[비평가] MCP Tool 호출: fact_check { claim: '연평균 성장률...' }
```

---

## 5. 오케스트레이터 설계

### 오케스트레이터 vs AI 오케스트레이터

이 데모의 오케스트레이터는 **TypeScript 코드**입니다. AI가 아닙니다.

```typescript
// orchestrator.ts - 코드가 순서를 결정함

while (!approved && attempt < effectiveMax) {
  const researchLog  = await runAgent("researcher", ...);  // 1. 항상 리서처 먼저
  const analysisLog  = await runAgent("analyst", ...);     // 2. 항상 분석가 다음
  const { judgement } = await runCriticJudgement(...);     // 3. 항상 비평가 마지막

  if (judgement.score >= targetScore) {
    approved = true;   // 승인 → 루프 탈출
  } else {
    retryEvents.push({ ... });  // 반려 기록
  }
}
await runAgent("synthesizer", ...);  // 4. 항상 마지막
```

**AI 오케스트레이터와의 차이:**

| 구분 | 코드 오케스트레이터 (현재) | AI 오케스트레이터 (업그레이드) |
|------|------------------------|---------------------------|
| 순서 결정 | 항상 고정 (Researcher→Analyst→Critic) | AI가 상황에 따라 동적 결정 |
| 유연성 | 낮음 | 높음 |
| 예측 가능성 | 높음 | 낮음 |
| 구현 난이도 | 쉬움 | 어려움 |
| 비용 | 낮음 (에이전트 비용만) | 높음 (오케스트레이터 AI 비용 추가) |

현재 구조로도 핵심 학습 목표인 "에이전트 간 피드백"은 충분히 구현됩니다.

### 피드백 데이터 전달 구조

반려 시 비평가의 피드백이 다음 리서처에게 전달됩니다:

```typescript
// 반려되면 피드백 구성
previousFeedback = `
반려 이유: ${judgement.reason}
현재 점수: ${judgement.score}점 (목표: ${cfg.targetScore}점 이상 필요)
문제점:
  1. ${judgement.issues[0]}
  2. ${judgement.issues[1]}
개선 제안:
  1. ${judgement.suggestions[0]}
  2. ${judgement.suggestions[1]}
`.trim();

// 다음 루프에서 Researcher 프롬프트에 포함
`다음 주제에 대해 리서치하세요: "${query}"
[이전 반려 피드백 - 반드시 반영하세요]
${previousFeedback}`
```

이것이 "AI들이 서로 의견을 주고받는" 핵심 메커니즘입니다.  
실제로 에이전트들이 실시간 대화를 하는 게 아니라, **이전 결과물과 피드백을 다음 프롬프트에 삽입**하는 방식입니다.

---

## 6. 실시간 스트리밍: SSE 선택 이유

에이전트 4개가 순서대로 실행되면 전체에 **60~120초**가 걸립니다.  
결과를 한 번에 보여주면 사용자는 그냥 기다려야 합니다.

SSE(Server-Sent Events)를 사용하면 에이전트 하나가 완료될 때마다 즉시 UI에 표시됩니다.

```typescript
// api.ts - SSE 스트림

return new Response(new ReadableStream({
  async start(controller) {
    const sendEvent = (event: string, data: unknown) => {
      controller.enqueue(encoder.encode(
        `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
      ));
    };

    const result = await runHarness(query, apiKey,
      (agentLog, retryEvent) => {
        if (retryEvent) sendEvent("retry_event", retryEvent);  // 반려 즉시 전송
        sendEvent("agent_complete", agentLog);                  // 완료 즉시 전송
      }
    );

    sendEvent("complete", result);  // 전체 완료
  }
}), { headers: { "Content-Type": "text/event-stream" } });
```

**왜 WebSocket이 아닌 SSE?**

| 구분 | SSE | WebSocket |
|------|-----|-----------|
| 방향 | 서버 → 클라이언트 (단방향) | 양방향 |
| 이 용도 적합성 | ✅ 진행 상황 전송만 필요 | ❌ 양방향 불필요 |
| 구현 복잡도 | 간단 | 복잡 |
| Cloudflare Workers 지원 | ✅ | 제한적 |

---

## 7. 설정 가능한 두 가지 파라미터

### 옵션 A: 최대 재시도 횟수 (`maxRetry`)

```typescript
// 0 = 무제한 (안전장치 10회)
// 1~10 = 지정 횟수
const effectiveMax = cfg.maxRetry === 0 ? ABSOLUTE_MAX : cfg.maxRetry;

// 종료 조건
if (attempt >= effectiveMax) {
  forcedStop = true;  // 강제 종료
  approved = true;    // 루프 탈출
}
```

**왜 무제한에도 안전장치를 뒀나?**  
Critic 기준이 매우 높거나 쿼리가 불명확하면 영원히 반려될 수 있습니다.  
OpenAI API는 호출당 비용이 발생하므로 무한루프 = 의도치 않은 비용 폭발입니다.

### 옵션 B: 합격 기준 점수 (`targetScore`)

```typescript
// Critic에게도 targetScore를 전달
const systemPrompt = `
판정 기준:
- 점수 ${targetScore}점 이상: 승인 (approved)
- 점수 ${targetScore - 1}점 이하: 반려 (rejected)
`;

// 오케스트레이터에서 판단
const scoreOk = judgement.score >= cfg.targetScore;
if (scoreOk) { approved = true; }
else { retryEvents.push(...); }
```

**Critic에게도 targetScore를 알려주는 이유:**  
AI는 "80점 기준이면 엄격하게, 60점 기준이면 느슨하게" 판정합니다.  
기준을 숨기면 AI가 임의로 점수를 매기게 됩니다.

---

## 8. 현재 구현의 한계와 다음 단계

### 현재 한계

| 한계 | 설명 |
|------|------|
| MCP Tools가 시뮬레이션 | 실제 웹 검색/팩트체크 API와 연결되지 않음 |
| 코드 오케스트레이터 | AI가 아닌 TypeScript가 순서 결정 |
| 단일 모델 | 4개 에이전트 모두 GPT-4o-mini |
| 단방향 피드백 | Researcher만 피드백 받음. Analyst는 받지 않음 |
| 순차 실행 | 병렬 실행 없음 (Researcher가 끝나야 Analyst 시작) |

### 다음 단계 업그레이드 로드맵

```
현재 (v3)                업그레이드 방향
────────────────────     ──────────────────────────────
GPT-4o-mini (단일)   →   GPT-4o + Claude 역할 분담
시뮬레이션 Tools     →   실제 Brave Search API 연결
코드 오케스트레이터   →   Claude가 동적 순서 결정
순차 실행            →   Researcher 병렬 실행 후 합치기
단방향 피드백        →   모든 에이전트 상호 피드백
```

---

## 9. 핵심 학습 포인트 요약

```
1. "다중 에이전트"의 실체
   ≠ 여러 개의 AI 모델
   = 하나의 AI + 여러 개의 역할(시스템 프롬프트) + 역할별 도구

2. "MCP 도구"의 실체
   = AI가 호출할 수 있는 외부 함수의 표준 명세
   = AI가 스스로 "이 도구가 필요하다"고 판단 → 오케스트레이터에 요청

3. "피드백 루프"의 실체
   = 에이전트들이 실시간 채팅하는 게 아님
   = 이전 에이전트의 출력 + 비평가의 피드백을 다음 프롬프트에 삽입

4. "오케스트레이터"의 역할
   = 에이전트 실행 순서 결정
   = 비평가 판정 결과 파싱 → 반려/승인 결정 → 재시도 or 진행
   = 현재는 코드로 하드코딩, 업그레이드하면 AI가 동적 결정
```

---

*작성일: 2026-03-31*  
*데모 앱: https://github.com/joonbae123/jbparkproject*
