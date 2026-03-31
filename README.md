# AI Harness + MCP 스터디 데모

> 다중 AI 에이전트가 서로 검증하며 결론을 내리는 **Harness 패턴**과  
> AI에 외부 도구를 연결하는 **MCP(Model Context Protocol)** 을 실습한 데모입니다.

---

## 📖 스터디 노트

**👉 [STUDY.md](./STUDY.md) — 하네스 설계 상세 분석**

> 어떤 AI를 어떤 역할로 왜 썼는지, 코드 수준의 설계 이유를 모두 기록했습니다.  
> MCP 동작 원리, 피드백 루프 메커니즘, 오케스트레이터 설계까지 포함.

---

## 🚀 데모 앱

**라이브 URL**: `http://localhost:3000` (샌드박스 실행 중)  
**GitHub**: https://github.com/joonbae123/jbparkproject

---

## 📚 핵심 개념 정리

### 1. Harness란?

**Harness = 여러 AI 에이전트를 조율하는 프레임워크**

혼자 일하는 AI보다, **역할이 나뉜 여러 AI가 서로 검증**하면 더 정확한 결론을 낼 수 있습니다.

```
비유: 신문사
- 기자(Researcher)     → 취재
- 에디터(Analyst)      → 분석 및 정리
- 팩트체커(Critic)     → 사실 검증 + 반려/승인 판정
- 편집장(Synthesizer)  → 최종 기사 작성
```

#### ✅ 단방향 파이프라인 (구버전)
```
Researcher → Analyst → Critic → Synthesizer
```
- 단순히 전달만 함. 검증 후 피드백 없음.

#### ✅ 피드백 루프 (현재 구현 - v2)
```
           ┌─────────────────────────────┐
           │         피드백 루프          │
           │                             │
           │  Researcher ──► Analyst     │
           │      ▲              │       │
           │      │ 반려!        ▼       │
           │      └──────── Critic       │
           │               (판정관)      │
           └──────────────────┼──────────┘
                              │ 승인!
                              ▼
                         Synthesizer
                        (최종 보고서)
```

- **Critic이 반려** → 이유와 개선 제안을 담아 **Researcher에게 되돌려 보냄**
- 최대 3회 재시도. 매 시도마다 품질 점수(0~100) 기록
- 모든 반려 이벤트 → **리포트로 시각화**

---

### 2. MCP(Model Context Protocol)란?

**MCP = AI와 외부 도구를 연결하는 표준 인터페이스**

> "AI의 USB 포트"

```
AI ──(MCP)──► 도구(Tools)
               ├── web_search    : 웹 검색
               ├── analyze_text  : 텍스트 분석 (키워드 추출)
               └── fact_check    : 팩트 체크
```

#### MCP 핵심 흐름

```
1. AI가 질문을 받음
2. "웹 검색이 필요하다" → MCP Client에 web_search 요청
3. MCP Server가 실제 검색 실행
4. 결과를 AI에 반환
5. AI가 결과를 바탕으로 최종 답변 생성
```

#### MCP vs 일반 API 차이

| 구분 | 일반 API 직접 호출 | MCP |
|------|---------------------|-----|
| 방식 | 코드에 하드코딩 | 표준 인터페이스 |
| AI 개입 | AI가 직접 호출 불가 | AI가 스스로 도구 선택 |
| 확장성 | 각각 연동 필요 | 표준 포맷으로 통일 |

---

### 3. Harness + MCP 결합 구조

```
[사용자 쿼리]
      │
      ▼
  오케스트레이터 (orchestrator.ts)
      │
      ├──► 🔍 Researcher ──► web_search (MCP Tool)
      │         │
      ├──► 📊 Analyst ──► analyze_text (MCP Tool)
      │         │
      ├──► ⚖️ Critic ──► fact_check (MCP Tool)
      │         │
      │    판정: 승인/반려
      │         │
      │    ❌ 반려 → Researcher로 피드백 전달 (재시도)
      │    ✅ 승인 → 다음 단계
      │
      └──► ✨ Synthesizer → 최종 보고서
```

---

## 🗂️ 프로젝트 구조

```
webapp/
├── src/
│   ├── server.ts              # Hono HTTP 서버 + 전체 UI HTML
│   ├── mcp/
│   │   └── tools.ts           # MCP 도구 정의 (web_search, analyze_text, fact_check)
│   ├── harness/
│   │   ├── types.ts           # 타입 정의 (AgentLog, RetryEvent, HarnessResult 등)
│   │   ├── agent.ts           # 단일 에이전트 실행 (runAgent, runCriticJudgement)
│   │   └── orchestrator.ts    # 피드백 루프 오케스트레이터 (runHarness)
│   └── routes/
│       └── api.ts             # POST /api/harness, GET /api/health
├── ecosystem.config.cjs       # PM2 서비스 설정
├── package.json
└── tsconfig.json
```

---

## 🔄 반려/재시도 리포트 기능

Critic이 반려할 때마다 아래 정보가 기록됩니다:

| 항목 | 내용 |
|------|------|
| 총 시도 횟수 | 몇 번 루프를 돌았는지 |
| 반려 횟수 | 비평가가 몇 번 반려했는지 |
| 품질 점수 추이 | 1차→2차→3차 점수 변화 (바 차트) |
| 반려 이유 | 각 반려 시 구체적 문제점 목록 |
| 개선 제안 | 비평가가 제시한 개선 방향 |
| 개선 요약 | 최종 점수와 변화 요약 |

### 예시 흐름
```
1차 시도: Researcher 리서치 → Analyst 분석 → Critic 판정 → ❌ 62점 반려
  반려 이유: "출처가 불명확하고 최신 데이터 부족"

2차 시도: Researcher 재리서치 (피드백 반영) → Analyst → Critic → ✅ 85점 승인
  → Synthesizer 최종 보고서 작성
```

---

## 💡 사용 방법

1. **OpenAI API Key 발급**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. 데모 앱 접속 후 API Key 입력
3. 리서치 주제 입력 (예시 버튼 클릭 가능)
4. **"Harness 실행"** 클릭
5. 4개 에이전트가 순서대로 실행되는 과정 실시간 확인
6. **반려/재시도 리포트**에서 품질 점수 추이 확인
7. 최종 보고서 확인

---

## ⚙️ 기술 스택

| 구분 | 기술 |
|------|------|
| 서버 | [Hono](https://hono.dev/) + Node.js |
| 언어 | TypeScript |
| AI | OpenAI gpt-4o-mini (fetch 직접 호출) |
| 실시간 스트리밍 | SSE (Server-Sent Events) |
| UI | Tailwind CSS (CDN) + FontAwesome |
| 프로세스 관리 | PM2 |

---

## 🧩 핵심 코드 해설

### agent.ts - Agent Loop

```typescript
// AI가 "충분하다"고 판단할 때까지 Tool 호출 반복
while (iteration < maxIterations) {
  const response = await callOpenAI(apiKey, {
    model: "gpt-4o-mini",
    messages,
    tools: openAITools,  // MCP 도구 목록 전달
  });

  if (choice.finish_reason === "tool_calls") {
    // AI가 도구 호출 결정 → 실행 후 결과를 메시지에 추가
    const result = await executeMCPTool(toolName, args);
    messages.push({ role: "tool", content: result });
    continue;  // 다시 AI에게 전달
  }

  // 최종 응답 반환
  return choice.message.content;
}
```

### orchestrator.ts - 피드백 루프

```typescript
while (!approved && attempt < MAX_RETRY) {
  attempt++;

  // 1. 리서처 실행
  const researchLog = await runAgent("researcher", query + previousFeedback);

  // 2. 분석가 실행
  const analysisLog = await runAgent("analyst", researchLog.output);

  // 3. 비평가 판정 (JSON 형식으로 승인/반려 결정)
  const { judgement } = await runCriticJudgement(researchLog, analysisLog);

  if (judgement.verdict === "rejected") {
    // 반려 → 피드백을 다음 리서처에게 전달
    previousFeedback = judgement.issues + judgement.suggestions;
    retryEvents.push({ attempt, judgement });  // 리포트 기록
  } else {
    approved = true;  // 승인 → 루프 탈출
  }
}

// 4. 최종 종합가 실행
const finalReport = await runAgent("synthesizer", allContext);
```

---

## 🔑 자주 묻는 질문

**Q. Project ID도 필요한가요?**  
A. 아니요! API Key(`sk-proj-...` 또는 `sk-...`) 하나만 있으면 됩니다. Project ID는 특정 조직 설정에서만 필요합니다.

**Q. API 키는 어디서 찾나요?**  
A. [platform.openai.com/api-keys](https://platform.openai.com/api-keys) → "API Keys" 탭 → "+ Create new secret key"

**Q. 크레딧이 있는데 401 에러가 나요?**  
A. 키가 만료되었거나 잘못 복사된 경우입니다. 새 키를 발급받으세요.

**Q. Critic은 항상 반려하나요?**  
A. 아니요. 80점 이상이면 승인, 79점 이하면 반려입니다. 품질이 좋으면 첫 시도에 바로 승인됩니다.

**Q. 오케스트레이터도 AI인가요?**  
A. 현재 구현은 TypeScript 코드로 하드코딩된 순서입니다 (코드 오케스트레이터). AI 오케스트레이터로 업그레이드하면 Claude 같은 AI가 동적으로 에이전트 실행 순서를 결정합니다.

---

## 📈 다음 스터디 단계

- [ ] **AI 오케스트레이터**: Claude가 에이전트 실행 순서를 동적으로 결정
- [ ] **Debate 패턴**: 두 에이전트가 찬반 논쟁 후 심판이 결정
- [ ] **실제 MCP 서버 연동**: stdio/SSE 방식으로 외부 MCP 서버 연결
- [ ] **멀티 모델**: Researcher는 GPT-4o-mini, Critic은 Claude 사용

---

*최종 업데이트: 2026-03-31*
