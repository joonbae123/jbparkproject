/**
 * Claude 오케스트레이터 v5 - 진짜 동적 워크플로우
 *
 * v4(반정적)와 v5(완전 동적)의 핵심 차이:
 *
 *   v4: Claude가 시작 시 steps[] 배열 한번에 생성 → 이후 그대로 실행
 *       (계획은 동적이지만 실행은 정적)
 *
 *   v5: Claude가 매 에이전트 완료 후 "다음에 뭘 할지" 실시간 결정
 *       (진짜 동적: 실행 결과를 보고 계획이 바뀜)
 *
 * v5 실행 흐름:
 *
 *  [시작] Claude에게 쿼리 전달 + "첫 번째 에이전트 결정해줘" 요청
 *     │
 *     ▼
 *  [에이전트 실행] Claude가 결정한 에이전트 실행
 *     │
 *     ▼
 *  [Claude 재판단] 결과를 보여주면서 "다음 에이전트 결정해줘" 요청
 *     │
 *     ├──► 계속 진행 → 다음 에이전트 실행
 *     └──► synthesizer → 최종 보고서 작성 후 종료
 */

export interface NextStepDecision {
  nextRole: "researcher" | "analyst" | "critic" | "synthesizer" | "done";
  instruction: string;
  reasoning: string;
  isJudge: boolean;
}

export interface InitialPlan {
  firstStep: NextStepDecision;
  overallStrategy: string;
  estimatedComplexity: "low" | "medium" | "high";
}

export interface AgentResult {
  role: string;
  output: string;
  toolsUsed: string[];
  attempt: number;
}

// Claude API 직접 fetch 호출
async function callClaude(
  anthropicKey: string,
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt: string,
  maxTokens: number = 512
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages
    })
  });

  const text = await res.text();
  if (!res.ok) {
    let errMsg = `Anthropic HTTP ${res.status}`;
    try {
      const errJson = JSON.parse(text);
      errMsg = errJson.error?.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const data = JSON.parse(text);
  return data.content[0]?.text || "";
}

/**
 * [v5 핵심] 초기 결정: 첫 번째 에이전트 결정
 * Claude에게 쿼리를 보여주고 어떤 에이전트부터 시작할지 결정 요청
 */
export async function decideFirstStep(
  query: string,
  anthropicKey: string,
  targetScore: number = 80
): Promise<InitialPlan> {

  const systemPrompt = `당신은 AI 에이전트 워크플로우 오케스트레이터입니다.
사용자 쿼리를 분석하고 첫 번째로 실행할 에이전트를 결정하세요.

사용 가능한 에이전트:
- researcher: 웹 검색으로 정보 수집 (web_search 도구)
- analyst: 수집된 정보 심층 분석 (analyze_text 도구)
- critic: 내용 검증 및 품질 판정 (fact_check 도구, isJudge=true면 승인/반려)
- synthesizer: 모든 결과 종합하여 최종 보고서 작성

반드시 JSON으로만 응답:
{
  "overallStrategy": "전체 접근 전략 1~2문장",
  "estimatedComplexity": "low" 또는 "medium" 또는 "high",
  "firstStep": {
    "nextRole": "첫 번째 에이전트 역할",
    "instruction": "이 에이전트에게 줄 구체적 지시",
    "reasoning": "왜 이 에이전트를 첫 번째로 선택했나",
    "isJudge": false
  }
}`;

  try {
    const raw = await callClaude(anthropicKey, [{
      role: "user",
      content: `쿼리: "${query}"\n합격 기준 점수: ${targetScore}점\n\n첫 번째 에이전트를 결정하세요.`
    }], systemPrompt, 512);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 없음");
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      firstStep: parsed.firstStep,
      overallStrategy: parsed.overallStrategy || "순차 분석 후 종합",
      estimatedComplexity: parsed.estimatedComplexity || "medium"
    };
  } catch (err) {
    console.error("[v5 오케스트레이터] 첫 스텝 결정 실패, 기본값 사용:", err);
    return getDefaultInitialPlan();
  }
}

/**
 * [v5 핵심] 동적 다음 스텝 결정
 *
 * 에이전트 실행 결과를 Claude에게 보여주고 "다음에 뭘 할지" 물어봄
 * 이것이 v4와의 핵심 차이: 매번 결과를 보고 계획이 달라질 수 있음
 */
export async function decideNextStep(
  query: string,
  anthropicKey: string,
  completedResults: AgentResult[],
  targetScore: number = 80,
  lastCriticScore: number | null = null,
  stepCount: number = 0
): Promise<NextStepDecision> {

  // 안전장치: 최대 8스텝 넘으면 강제 synthesizer로
  if (stepCount >= 8) {
    return {
      nextRole: "synthesizer",
      instruction: "지금까지의 모든 결과를 종합하여 최종 보고서를 작성하세요.",
      reasoning: "최대 스텝 수(8) 도달 - 강제 종료",
      isJudge: false
    };
  }

  const systemPrompt = `당신은 AI 에이전트 워크플로우 오케스트레이터입니다.
지금까지 완료된 에이전트 결과를 보고, 다음에 실행할 에이전트를 결정하세요.

사용 가능한 에이전트:
- researcher: 추가 정보 수집이 필요할 때
- analyst: 수집된 정보를 더 깊이 분석해야 할 때
- critic(isJudge=true): 현재 내용의 품질을 판정할 때 (${targetScore}점 기준)
- synthesizer: 충분한 정보가 모이면 최종 보고서 작성 (종료)

현재 진행: ${stepCount + 1}번째 스텝 (8번 초과 시 자동 종료)

반드시 JSON으로만 응답:
{
  "nextRole": "다음 에이전트 역할",
  "instruction": "다음 에이전트에게 줄 구체적 지시",
  "reasoning": "이 결정을 내린 이유 (지금까지 결과 참조, 1~2문장)",
  "isJudge": true 또는 false
}`;

  const resultsSummary = completedResults
    .map((r, i) => {
      const preview = r.output.length > 300 ? r.output.slice(0, 300) + "...(생략)" : r.output;
      return `${i + 1}. [${r.role}${r.attempt > 1 ? ` (${r.attempt}차)` : ""}] 도구: ${r.toolsUsed.join(", ") || "없음"}\n결과: ${preview}`;
    })
    .join("\n\n");

  const criticInfo = lastCriticScore !== null
    ? `\n최근 Critic 점수: ${lastCriticScore}점 (합격: ${targetScore}점, ${lastCriticScore >= targetScore ? "✅ 통과" : "❌ 미달"})`
    : "";

  try {
    const raw = await callClaude(anthropicKey, [{
      role: "user",
      content: `쿼리: "${query}"${criticInfo}\n\n완료된 작업 (${completedResults.length}개):\n${resultsSummary}\n\n다음 에이전트를 결정하세요.`
    }], systemPrompt, 384);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 없음");
    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.nextRole === "synthesizer" || parsed.nextRole === "done") {
      return {
        nextRole: "synthesizer",
        instruction: parsed.instruction || "모든 결과를 종합하여 최종 보고서를 작성하세요.",
        reasoning: parsed.reasoning || "충분한 정보 수집 완료",
        isJudge: false
      };
    }

    return {
      nextRole: parsed.nextRole || "synthesizer",
      instruction: parsed.instruction || "주어진 역할을 수행하세요.",
      reasoning: parsed.reasoning || "결정 이유 없음",
      isJudge: parsed.isJudge === true
    };

  } catch (err) {
    console.error("[v5 오케스트레이터] 다음 스텝 결정 실패:", err);
    return getDefaultNextStep(completedResults, lastCriticScore, targetScore);
  }
}

/**
 * 기본 플랜 (Anthropic 키 없을 때 사용)
 */
export function getDefaultInitialPlan(): InitialPlan {
  return {
    firstStep: {
      nextRole: "researcher",
      instruction: "주제에 대한 최신 정보를 수집하세요.",
      reasoning: "기본 계획: 항상 리서치부터 시작",
      isJudge: false
    },
    overallStrategy: "기본 계획: Researcher → Analyst → Critic → Synthesizer",
    estimatedComplexity: "medium"
  };
}

/**
 * 기본 다음 스텝 (Anthropic 키 없을 때 / 에러 fallback)
 */
export function getDefaultNextStep(
  completedResults: AgentResult[],
  lastCriticScore: number | null,
  targetScore: number
): NextStepDecision {
  const roles = completedResults.map(r => r.role);
  const hasResearcher = roles.includes("researcher");
  const hasAnalyst = roles.includes("analyst");
  const hasCritic = roles.includes("critic");

  if (!hasResearcher) {
    return { nextRole: "researcher", instruction: "정보를 수집하세요.", reasoning: "기본: 리서치 먼저", isJudge: false };
  }
  if (!hasAnalyst) {
    return { nextRole: "analyst", instruction: "수집된 정보를 분석하세요.", reasoning: "기본: 분석 단계", isJudge: false };
  }
  if (!hasCritic) {
    return { nextRole: "critic", instruction: "내용을 검증하세요.", reasoning: "기본: 검증 단계", isJudge: true };
  }
  return { nextRole: "synthesizer", instruction: "최종 보고서를 작성하세요.", reasoning: "기본: 종합 단계", isJudge: false };
}
