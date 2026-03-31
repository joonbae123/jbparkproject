/**
 * Claude 오케스트레이터
 *
 * 역할: 사용자 쿼리를 보고 "어떤 에이전트를 어떤 순서로 실행할지" 계획을 세움
 *
 * 코드 오케스트레이터(v3)와의 차이:
 *   v3: Researcher → Analyst → Critic → Synthesizer (항상 고정)
 *   v4: Claude가 쿼리를 분석 → 상황에 맞는 실행 계획 동적 생성
 *
 * Claude가 만드는 계획 예시:
 *   단순 질문 → ["researcher", "synthesizer"]  (Analyst/Critic 생략)
 *   복잡한 분석 → ["researcher", "researcher", "analyst", "critic", "synthesizer"]
 *   팩트 중요 → ["researcher", "analyst", "critic", "critic", "synthesizer"]
 */

export interface OrchestratorPlan {
  steps: AgentStep[];          // 실행할 에이전트 순서
  reasoning: string;           // Claude가 이 계획을 세운 이유
  estimatedComplexity: "low" | "medium" | "high";
}

export interface AgentStep {
  role: "researcher" | "analyst" | "critic" | "synthesizer";
  instruction: string;         // 이 에이전트에게 줄 특별 지시
  isJudge: boolean;            // true면 판정 모드(승인/반려), false면 일반 실행
}

// Claude API 직접 fetch 호출 (SDK 없이)
async function callClaude(
  anthropicKey: string,
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt: string
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",  // 빠르고 저렴한 Haiku 모델
      max_tokens: 1024,
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
 * Claude가 실행 계획을 수립
 *
 * @param query - 사용자 쿼리
 * @param anthropicKey - Anthropic API 키
 * @param targetScore - 합격 기준 점수 (계획에 반영)
 */
export async function planWithClaude(
  query: string,
  anthropicKey: string,
  targetScore: number = 80
): Promise<OrchestratorPlan> {

  const systemPrompt = `당신은 AI 에이전트 오케스트레이터입니다.
사용자 쿼리를 분석하고, 어떤 에이전트를 어떤 순서로 실행할지 계획을 세웁니다.

사용 가능한 에이전트:
- researcher: 웹 검색으로 정보 수집 (web_search 도구 사용)
- analyst: 수집된 정보 심층 분석 (analyze_text 도구 사용)
- critic: 내용 검증 및 품질 판정 (fact_check 도구 사용, isJudge=true면 승인/반려 결정)
- synthesizer: 모든 결과 종합하여 최종 보고서 작성 (반드시 마지막에 1회)

계획 수립 원칙:
1. synthesizer는 반드시 마지막 1회만 포함
2. critic을 isJudge=true로 사용하면 점수 ${targetScore}점 기준으로 승인/반려 판정
3. 쿼리 복잡도에 따라 에이전트 수 조절 (단순: 2~3개, 복잡: 4~6개)
4. researcher는 여러 번 사용 가능 (각도를 달리해서)
5. 반드시 아래 JSON 형식으로만 응답 (다른 텍스트 없이)

응답 형식:
{
  "reasoning": "이 계획을 세운 이유 2~3문장",
  "estimatedComplexity": "low" 또는 "medium" 또는 "high",
  "steps": [
    {
      "role": "researcher",
      "instruction": "이 에이전트에게 줄 구체적 지시",
      "isJudge": false
    },
    ...
    {
      "role": "synthesizer",
      "instruction": "최종 보고서 작성 지시",
      "isJudge": false
    }
  ]
}`;

  const userMessage = `다음 쿼리에 대한 에이전트 실행 계획을 수립하세요:
"${query}"

합격 기준 점수: ${targetScore}점`;

  try {
    const raw = await callClaude(anthropicKey, [
      { role: "user", content: userMessage }
    ], systemPrompt);

    // JSON 파싱
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Claude 응답에서 JSON을 찾을 수 없습니다");

    const parsed = JSON.parse(jsonMatch[0]);

    // 유효성 검사
    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error("유효하지 않은 계획 형식");
    }

    // synthesizer가 없으면 강제 추가
    const hasSynthesizer = parsed.steps.some((s: AgentStep) => s.role === "synthesizer");
    if (!hasSynthesizer) {
      parsed.steps.push({
        role: "synthesizer",
        instruction: "모든 에이전트 작업을 종합하여 최종 보고서를 작성하세요.",
        isJudge: false
      });
    }

    return {
      steps: parsed.steps,
      reasoning: parsed.reasoning || "계획 이유 없음",
      estimatedComplexity: parsed.estimatedComplexity || "medium"
    };

  } catch (err) {
    // Claude 호출 실패 시 기본 계획으로 폴백
    console.error("[Claude 오케스트레이터] 계획 수립 실패, 기본 계획 사용:", err);
    return getDefaultPlan(targetScore);
  }
}

/**
 * Claude가 중간 검토 (각 에이전트 완료 후 호출)
 * "계속 진행할지 / 에이전트 추가할지" 재판단
 */
export async function reviewWithClaude(
  query: string,
  anthropicKey: string,
  completedSteps: { role: string; output: string }[],
  remainingSteps: AgentStep[],
  targetScore: number
): Promise<{ shouldContinue: boolean; modifiedSteps?: AgentStep[]; comment: string }> {

  // 완료된 스텝이 적으면 검토 생략 (비용 절약)
  if (completedSteps.length < 2) {
    return { shouldContinue: true, comment: "계속 진행" };
  }

  const systemPrompt = `당신은 AI 에이전트 오케스트레이터입니다.
현재까지 완료된 에이전트 작업을 보고, 남은 계획을 수정할지 결정하세요.

반드시 JSON으로만 응답:
{
  "shouldContinue": true 또는 false,
  "comment": "판단 이유 한 문장",
  "modifiedSteps": null 또는 수정된 steps 배열 (변경 없으면 null)
}`;

  const completedSummary = completedSteps
    .map((s, i) => `${i + 1}. [${s.role}] ${s.output.slice(0, 200)}...`)
    .join("\n");

  const remainingSummary = remainingSteps
    .map(s => `- ${s.role}: ${s.instruction}`)
    .join("\n");

  try {
    const raw = await callClaude(anthropicKey, [{
      role: "user",
      content: `쿼리: "${query}"
합격기준: ${targetScore}점

완료된 작업:
${completedSummary}

남은 계획:
${remainingSummary}

남은 계획을 그대로 진행해도 될까요? 필요하면 수정하세요.`
    }], systemPrompt);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        shouldContinue: parsed.shouldContinue !== false,
        modifiedSteps: parsed.modifiedSteps || undefined,
        comment: parsed.comment || "계속 진행"
      };
    }
  } catch (err) {
    console.error("[Claude 중간 검토] 실패:", err);
  }

  return { shouldContinue: true, comment: "검토 실패, 기본 계획 유지" };
}

/**
 * Claude 호출 실패 시 사용할 기본 계획
 */
function getDefaultPlan(targetScore: number): OrchestratorPlan {
  return {
    reasoning: "Claude 오케스트레이터 호출 실패로 기본 계획을 사용합니다.",
    estimatedComplexity: "medium",
    steps: [
      { role: "researcher",   instruction: "주제에 대한 최신 정보를 수집하세요.", isJudge: false },
      { role: "analyst",      instruction: "수집된 정보를 심층 분석하세요.",      isJudge: false },
      { role: "critic",       instruction: "분석 내용을 검증하고 판정하세요.",     isJudge: true  },
      { role: "synthesizer",  instruction: "최종 보고서를 작성하세요.",            isJudge: false }
    ]
  };
}
