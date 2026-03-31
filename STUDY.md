# AI Harness + MCP 설계 스터디 노트

> 이 문서는 직접 구현한 데모 앱의 설계를 **있는 그대로** 기록한 스터디 노트입니다.  
> "어떤 AI를, 어떤 역할로, 왜 그렇게 설계했는가"를 중심으로 설명합니다.

---

## 0. 하네스(Harness)란 무엇인가?

> "각 역할을 가진 에이전트들을 세팅해서, 그들이 서로 의견을 주고받거나 검증을 주고받으며  
> 더 정확한 결론을 내는게 하네스야? 혼자 일하는 것보단 비평가가 있으면 검증도 되고.."

**정확히 맞습니다.** 조금 더 보태면:

**하네스(Harness)** = 여러 AI 에이전트들이 **역할을 분담하고 서로 검증**하며 협업하는 구조

```
혼자 하는 AI                하네스 구조
────────────────────        ──────────────────────────────
자기 결과물을 스스로 검증  → 외부 비평가(Critic)가 독립 검증
한 번의 답변으로 끝        → 기준 미달 시 자동 재시도
편향되거나 허술할 수 있음  → 역할 분리로 체계적 품질 관리
과정이 불투명              → 각 단계 로그/리포트 투명 공개
```

**핵심 오해 교정:**
```
흔한 오해: 에이전트 4개 = AI 모델 4개 (GPT, Claude, Gemini, Llama...)

실제 구현: 에이전트 4개 = GPT-4o-mini 하나 × 시스템 프롬프트 4가지
```

에이전트들이 "실시간 대화"를 하는 것이 아니라,  
**이전 결과물 + 비평가 피드백을 다음 프롬프트에 삽입**하는 방식입니다.

---

## 하네스 버전 진화 기록

이 프로젝트는 4단계를 거쳐 점점 더 동적이고 지능적인 구조로 발전했습니다.

---

## v1 하네스 - 피드백 없는 직렬 구조

### 구조

```
[사용자 쿼리]
     ↓
🔍 Researcher  ──► 📊 Analyst  ──► ⚖️ Critic  ──► ✨ Synthesizer
     (결과)           (결과)         (결과)           (최종 보고서)
```

### 특징

- **순서**: 항상 Researcher → Analyst → Critic → Synthesizer 고정
- **피드백 없음**: Critic이 문제를 발견해도 그냥 넘어감
- **오케스트레이터**: TypeScript 코드가 순서를 결정 (AI 아님)

### 핵심 코드 (개념)

```typescript
// v1 - 단순 순차 실행
const researchLog  = await runAgent("researcher", query, apiKey);
const analysisLog  = await runAgent("analyst",    query, apiKey, researchLog.output);
const criticLog    = await runAgent("critic",     query, apiKey, analysisLog.output);
const synthLog     = await runAgent("synthesizer",query, apiKey, criticLog.output);
```

### 한계

- Critic이 "이건 별로야"라고 해도 그냥 Synthesizer로 넘어감
- 품질 관리가 없음 → 결과 신뢰도 낮을 수 있음

---

## v2 하네스 - 비평가 포함 피드백 루프

### 구조

```
[사용자 쿼리]
     ↓
┌────────────────────────────────────────────┐
│             피드백 루프                      │
│                                            │
│  🔍 Researcher ──► 📊 Analyst ──► ⚖️ Critic │
│       ▲                            │       │
│       │      반려(점수 미달)          │       │
│       └────────────────────────────┘       │
│                     │                      │
│              승인(점수 달성)                │
└─────────────────────┼──────────────────────┘
                      ↓
               ✨ Synthesizer
```

### 핵심 추가: runCriticJudgement()

Critic이 일반 텍스트가 아닌 **구조화된 JSON 판정**을 반환합니다:

```typescript
// agent.ts - 판정 전용 함수
const systemPrompt = `
판정 기준:
- 점수 ${targetScore}점 이상: 승인 (approved)
- 점수 ${targetScore - 1}점 이하: 반려 (rejected)

반드시 JSON으로만 응답:
{
  "verdict": "approved" 또는 "rejected",
  "score": 0~100,
  "reason": "판정 이유",
  "issues": ["문제점1", "문제점2"],
  "suggestions": ["개선제안1", "개선제안2"]
}`;
```

### 피드백 전달 메커니즘

반려 시 비평가의 피드백이 다음 Researcher 프롬프트에 삽입됩니다:

```typescript
// 반려 피드백 구성
previousFeedback = `반려 이유: ${judgement.reason}
현재 점수: ${judgement.score}점 (목표: ${targetScore}점)
문제점: ${judgement.issues.join(", ")}
개선 제안: ${judgement.suggestions.join(", ")}`;

// 다음 Researcher 프롬프트에 포함
`다음 주제에 대해 리서치하세요: "${query}"
[이전 반려 피드백 - 반드시 반영하세요]
${previousFeedback}`
```

이것이 **"AI들이 서로 의견을 주고받는"** 실제 구현 방식입니다.

### 추가된 설정 파라미터

| 파라미터 | 설명 | 특이사항 |
|---------|------|---------|
| `maxRetry` | 최대 재시도 횟수 | 0 = 무제한 (안전장치 10회) |
| `targetScore` | 합격 기준 점수 | Critic에게도 전달하여 판정 기준 통일 |

### 왜 안전장치(최대 10회)가 필요한가?

Critic 기준이 너무 높거나 쿼리가 불명확하면 영원히 반려될 수 있습니다.  
OpenAI API는 호출당 비용이 발생하므로 무한루프 = 의도치 않은 비용 폭발입니다.

---

## v3 하네스 - Claude 오케스트레이터 포함

### 구조

```
[사용자 쿼리]
     ↓
🧠 Claude (오케스트레이터)
   └── ① 실행 계획 수립 (steps[] 배열 생성)
   └── ③ 중간 검토 (계획 수정 가능)
     ↓
GPT-4o-mini 에이전트들 (Claude 계획대로 실행)
  🔍 Researcher → 📊 Analyst → ⚖️ Critic → ✨ Synthesizer
```

### v3의 핵심: 코드 오케스트레이터 → AI 오케스트레이터

| 구분 | v2 코드 오케스트레이터 | v3 Claude 오케스트레이터 |
|------|---------------------|------------------------|
| 순서 결정 | 항상 고정 (코드에 하드코딩) | Claude가 쿼리 분석 후 결정 |
| 유연성 | 낮음 | 높음 |
| 추가 비용 | 없음 | Claude API 호출 비용 추가 |

### Claude가 만드는 계획 예시

```json
{
  "reasoning": "복잡한 분석 주제라 Researcher를 두 번 돌리고 검증을 강화합니다.",
  "estimatedComplexity": "high",
  "steps": [
    { "role": "researcher", "instruction": "기술 동향을 수집하세요", "isJudge": false },
    { "role": "researcher", "instruction": "사례 연구를 수집하세요", "isJudge": false },
    { "role": "analyst",    "instruction": "두 결과를 비교 분석하세요", "isJudge": false },
    { "role": "critic",     "instruction": "검증하고 판정하세요", "isJudge": true },
    { "role": "synthesizer","instruction": "최종 보고서를 작성하세요", "isJudge": false }
  ]
}
```

### v3의 한계 - "반정적"

Claude가 시작 시 `steps[]` 배열을 한 번에 생성하고, 이후에는 그 배열을 순서대로 실행합니다.  
계획은 동적이지만, 실제 실행은 정적입니다.

```
문제: Researcher 결과가 너무 빈약한데
      Claude가 이미 "Analyst → Critic → Synthesizer" 순서를 정해버렸다면?
      → 결과 보고 나서 계획을 바꿀 수 없음
```

---

## v4 하네스 - 동적 워크플로우 오케스트레이터 (완전 구현)

### v3 → v4 핵심 변화

```
v3 (반정적):  Claude가 시작 시 steps[] 배열 생성 → 이후 그대로 실행
              (계획은 동적이지만 실행은 고정)

v4 (완전 동적): Claude가 매 에이전트 완료 후 "다음에 뭘 할지" 실시간 결정
              (결과를 보고 계획이 실시간으로 바뀜)
```

### v4 실행 루프

```
[시작] Claude: "첫 번째 에이전트 뭐로 할까?" → researcher 결정
         ↓
[Researcher 실행] → 결과 반환
         ↓
[Claude 재판단] "결과 보니까 다음은 뭐가 좋을까?"
  → 결과 풍부: "Analyst 없이 바로 Critic으로"
  → 결과 빈약: "Researcher 한번 더, 다른 각도로"
         ↓
[다음 에이전트 실행] → 결과 반환
         ↓
[Claude 재판단] "이제 충분한가? synthesizer로 갈까?"
  → 충분: "synthesizer"
  → 부족: "analyst 추가"
         ↓
[Synthesizer] 최종 보고서 작성
```

### v4의 두 가지 핵심 함수

#### decideFirstStep() - 초기 결정

```typescript
// claude-orchestrator.ts

export async function decideFirstStep(
  query: string,
  anthropicKey: string,
  targetScore: number
): Promise<InitialPlan> {
  // Claude에게: "이 쿼리에 어떤 에이전트부터 시작하면 좋을까요?"
  // Claude 응답: { firstStep: { nextRole, instruction, reasoning, isJudge }, overallStrategy, complexity }
}
```

#### decideNextStep() - 동적 재판단

```typescript
// 에이전트 완료 후 매번 호출
export async function decideNextStep(
  query: string,
  anthropicKey: string,
  completedResults: AgentResult[],  // 지금까지 완료된 결과들 (핵심!)
  targetScore: number,
  lastCriticScore: number | null,
  stepCount: number
): Promise<NextStepDecision> {
  // Claude에게: "지금까지 이런 결과가 나왔어. 다음에 뭘 실행할까?"
  // Claude 응답: { nextRole, instruction, reasoning, isJudge }
}
```

### 실제 동작 예시

```
쿼리: "AI Harness의 미래 전망"

Step 1:
  Claude: "리서치부터 시작" → researcher 실행
  결과: 풍부한 정보 수집됨

Step 2:
  Claude: "결과가 충분해. Analyst 없이 바로 Critic으로 가자" → critic(isJudge=true) 실행
  결과: 78점 반려

Step 3 (재시도):
  Claude: "반려됐네. 다른 각도로 researcher 한번 더" → researcher 재실행
  결과: 추가 정보 수집

Step 4:
  Claude: "이제 analyst 추가하면 좋겠어" → analyst 실행
  결과: 심층 분석 완료

Step 5:
  Critic: 85점 승인

Step 6:
  Claude: "충분해. synthesizer로 마무리" → synthesizer 실행
  결과: 최종 보고서
```

### 안전장치

```typescript
// 최대 8스텝 초과 시 강제 종료
if (stepCount >= 8) {
  return { nextRole: "synthesizer", reasoning: "최대 스텝 수 도달" };
}
```

### UI 변화: Claude 결정 흐름 시각화

v4 UI에는 **"Claude의 동적 판단 흐름"** 패널이 추가되었습니다:

```
Claude의 동적 판단 흐름                결정 4회
────────────────────────────────────────────────
전체 전략: 복잡한 분석 → Researcher 2회 필요
복잡도: 🔴 복잡

① 🔍 Researcher  [초기 결정]
   Claude: "리서치부터 시작하는 게 맞음"

② ⚖️ Critic (판정)  [완료된 에이전트 1개 기반 결정]
   Claude: "결과가 충분해서 바로 검증으로"

③ 🔍 Researcher  [완료된 에이전트 2개 기반 결정]
   Claude: "반려됨, 다른 각도로 추가 조사 필요"

④ ✨ Synthesizer  [완료된 에이전트 4개 기반 결정]
   Claude: "충분한 정보 수집, 최종 보고서 작성"
```

---

## 공통 설계 요소 (v1~v4 전체)

### 사용된 AI 모델

| AI | 역할 | 이유 |
|----|------|------|
| **GPT-4o-mini** | 모든 에이전트 실행 | 비용 저렴, 속도 빠름, Tool Calling 안정적 지원 |
| **Claude claude-3-5-haiku** | 오케스트레이터 (v3, v4) | 추론 능력 우수, JSON 출력 신뢰성 높음 |

### temperature 설정 전략

```typescript
// 리서치/분석: 창의성 필요
{ model: "gpt-4o-mini", temperature: 0.7, max_tokens: 2000 }

// 판정(Critic): 일관성 중요
{ model: "gpt-4o-mini", temperature: 0.3, max_tokens: 1000 }

// Claude 오케스트레이터: 빠른 판단
{ model: "claude-3-5-haiku", max_tokens: 384~512 }
```

### OpenAI API 호출 방식: SDK 아닌 직접 fetch

```typescript
// SDK의 no body 버그 우회
async function callOpenAI(apiKey, projectId, body) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  const text = await res.text();  // raw text 먼저 받아서
  return JSON.parse(text);        // 직접 파싱
}
```

**이유**: openai Node.js SDK 4.x에서 특정 환경(sandbox)에 `401 status code (no body)` 버그 발생.  
`fetch`로 직접 호출하면 에러 메시지를 정확히 파악 가능.

### 4개 에이전트 역할 설계

```typescript
const AGENT_CONFIGS = {
  researcher: {
    allowedTools: ["web_search"],        // 수집만
    temperature: 0.7
  },
  analyst: {
    allowedTools: ["analyze_text"],      // 분석만
    temperature: 0.7
  },
  critic: {
    allowedTools: ["fact_check"],        // 검증만
    temperature: 0.3  // 판정은 일관성!
  },
  synthesizer: {
    allowedTools: [],                    // 도구 없음. 종합만.
    temperature: 0.7
  }
};
```

**왜 도구를 역할별로 제한하나?**
- Researcher가 분석 도구를 쓰면 수집/분석이 섞여 편향 발생
- 역할 분리 = 책임 분리 = 결과 예측 가능성 향상

### MCP Tools (시뮬레이션)

```typescript
// src/mcp/tools.ts
// 실제 프로덕션에서는 Brave Search API, Tavily 등으로 교체

case "web_search": {
  // 현재: 템플릿 문자열 반환 (구조 학습 목적)
  // 실제: await fetch("https://api.tavily.com/search", ...)
}
```

### SSE(Server-Sent Events) 실시간 스트리밍

에이전트 4개가 순서대로 실행되면 전체에 60~120초가 걸립니다.  
SSE로 각 에이전트 완료 시마다 즉시 UI에 업데이트합니다.

```typescript
// v4 SSE 이벤트 목록
"start"          - 하네스 시작
"strategy"       - Claude 전체 전략 (초기 1회)
"decision"       - Claude 다음 에이전트 결정할 때마다
"agent_complete" - 에이전트 완료
"retry_event"    - Critic 반려 시
"complete"       - 전체 완료
"error"          - 오류 발생
```

---

## 버전별 비교 요약

| | v1 | v2 | v3 | v4 |
|-|----|----|----|----|
| **구조** | 단순 직렬 | 피드백 루프 | Claude 계획 수립 | Claude 동적 결정 |
| **오케스트레이터** | TypeScript 코드 | TypeScript 코드 | Claude (시작 시 1회) | Claude (매 단계) |
| **피드백** | 없음 | Critic → Researcher | Critic → Researcher | Critic → Researcher |
| **유연성** | 낮음 | 낮음 | 중간 | 높음 |
| **비용** | 낮음 | 낮음 | 중간 | 중간 |
| **예측 가능성** | 높음 | 높음 | 중간 | 낮음 |
| **파이프라인** | 고정 4개 | 고정 4개 | Claude가 N개 결정 | Claude가 매번 결정 |

### 언제 어떤 버전을 쓰나?

```
v1: 빠른 프로토타입, 단순 작업
v2: 품질 관리가 중요한 작업 (비용 제한 있음)
v3: 다양한 유형의 쿼리 처리 (일부 Claude 비용 감수)
v4: 최고 품질 필요, 복잡한 분석 작업 (Claude 비용 감수)
```

---

## 다음 단계 업그레이드 로드맵

```
현재 (v4)                   다음 업그레이드 방향
────────────────────────    ──────────────────────────────
GPT-4o-mini (에이전트)   →   특수 에이전트에 GPT-4o 사용
Claude Haiku (오케)      →   Claude Sonnet으로 판단 강화
시뮬레이션 Tools         →   실제 Brave/Tavily Search API 연결
순차 실행                →   Researcher 병렬 실행 후 합치기
단방향 피드백            →   모든 에이전트 상호 피드백
단일 Critic              →   멀티 Critic 합의 구조
```

---

## 핵심 학습 포인트 정리

```
1. "다중 에이전트"의 실체
   ≠ 여러 개의 AI 모델
   = 하나의 AI + 여러 개의 역할(시스템 프롬프트) + 역할별 도구

2. "피드백 루프"의 실체
   = 에이전트들이 실시간 채팅하는 게 아님
   = 이전 에이전트의 출력 + 비평가 피드백을 다음 프롬프트에 삽입

3. "동적 오케스트레이터"의 실체
   = v3: Claude가 시작 시 계획 수립 → 이후 고정 실행 (반정적)
   = v4: Claude가 매 단계 결과를 보고 다음 결정 (완전 동적)

4. "MCP 도구"의 실체
   = AI가 호출할 수 있는 외부 함수의 표준 명세
   = AI가 "이 도구가 필요하다" 판단 → 호출 → 결과를 컨텍스트에 추가

5. "품질 관리"의 실체
   = Critic이 JSON으로 점수 + 이유 + 개선사항 반환
   = 오케스트레이터가 점수 비교 → 반려/승인 결정 → 재시도 or 진행
```

---

*작성일: 2026-03-31*  
*데모 앱: https://github.com/joonbae123/jbparkproject*

---

## v6 하네스 - 개발 자동화 파이프라인 (신규)

### 핵심 아이디어

> "AI들이 스스로 코드를 짜고, 실행하고, 오류나면 고치는 하네스"

v1~v5는 **정보를 수집·분석**하는 리서치 파이프라인이었습니다.  
v6은 **실제 코드를 작성하고 Node.js로 직접 실행**하는 개발 파이프라인입니다.

### v5 리서치 하네스 vs v6 개발 하네스

```
v5 (정보 분석 파이프라인)       v6 (코드 개발 파이프라인)
────────────────────────────    ────────────────────────────────
Researcher  → 정보 수집         PM          → 요구사항 분석, 명세서
Analyst     → 텍스트 분석       Developer   → 코드 작성 + 실행 검증
Critic      → 품질 검증         Reviewer    → 코드 품질 점수 평가
Synthesizer → 보고서 작성       QA Tester   → 테스트 코드 작성·실행

"AI 판단" 피드백          →   "실행 결과(stdout/stderr)" 피드백
주관적 점수 (0~100)       →   객관적 결과 (통과/실패, 에러 메시지)
```

### 핵심: 실제 코드 실행 (child_process)

```typescript
// dev-tools.ts - execute_code 도구
const stdout = execSync(`node "${filePath}"`, {
  timeout: 10000,        // 10초 타임아웃
  cwd: sessionPath,
  encoding: "utf-8"
});
// stdout/stderr/exitCode가 그대로 AI에게 피드백됨
```

에이전트가 코드를 작성하면 **즉시 Node.js로 실행**합니다.  
에러가 나면 에러 메시지 그대로 다음 AI의 컨텍스트로 들어갑니다.

### v6 실행 흐름

```
[개발 요청 접수]
"버블 정렬 함수를 만들어줘. 오름차순/내림차순 옵션 포함."
     ↓
[Claude 초기 결정] "PM → Developer → Reviewer → QA 순으로"
     ↓
[PM] 명세서 작성: 파일 구조, 함수 시그니처, 테스트 케이스 목록
     ↓
[Developer] write_code → execute_code → 에러면 수정 반복
     ↓ (실행 성공)
[Reviewer] read_code → 품질 점수 (정확성/가독성/에러처리/효율성)
     ↓ (점수 70+ 이면)
[QA Tester] write_code(테스트) → run_tests → 통과/실패
     ↓
[Claude 판단] "모두 통과 → done"
```

### 새로 추가된 MCP 도구 (5가지)

| 도구 | 역할 | 실제 동작 |
|------|------|-----------|
| `write_code` | 코드 파일 작성 | `fs.writeFileSync()` |
| `read_code` | 코드 파일 읽기 | `fs.readFileSync()` |
| `execute_code` | **코드 실행** | `child_process.execSync()` |
| `run_tests` | 테스트 실행 | Node.js로 `*.test.js` 실행 |
| `list_files` | 파일 목록 | `fs.readdirSync()` |

### 격리 실행 환경 (샌드박스)

```
/tmp/dev-harness/
└── session-1711929074-abc12/    ← 세션별 격리 디렉토리
    ├── solution.js               ← Developer가 작성
    └── solution.test.js          ← QA Tester가 작성
```

- 각 하네스 실행마다 고유 세션 ID 생성
- 파일은 세션 디렉토리에 격리 → 동시 실행 충돌 없음
- Path traversal 방지: `path.basename()` 강제

### 정량적 피드백의 의미

```
v5 Critic 피드백 (주관적):
  "점수: 72점 - 출처 불충분, 분석 깊이 부족"
  → 개선 기준이 모호

v6 QA 피드백 (객관적):
  "실행 결과: exit code 1
   Error: Cannot read properties of undefined (reading 'length')
   at line 23: arr.length"
  → 정확히 어디가 잘못됐는지 명확
```

**실행 결과 = 재시도의 근거** → 할루시네이션 없는 피드백

### 버전 비교 테이블

| 구분 | v1 | v2 | v3 | v4 | v5 | v6 |
|------|----|----|----|----|----|----|
| 오케스트레이터 | 코드 고정 | 코드 고정 | Claude (1회) | Claude (1회) | Claude (매 단계) | Claude (매 단계) |
| 피드백 루프 | ❌ | Critic→Researcher | ✅ | ✅ | ✅ | ✅ |
| 파이프라인 | 리서치 | 리서치 | 리서치 | 리서치 | 리서치 | **개발** |
| 코드 실행 | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ Node.js** |
| 피드백 유형 | - | 주관적 | 주관적 | 주관적 | 주관적 | **객관적 (stdout)** |
| 파일 I/O | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ 실제 파일** |
