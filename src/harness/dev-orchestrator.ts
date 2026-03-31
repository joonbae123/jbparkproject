/**
 * 개발 하네스 오케스트레이터 v6
 *
 * Claude가 개발 팀 워크플로우를 실시간으로 조율합니다.
 *
 * 흐름:
 *
 *   [시작] 개발 요청 접수
 *     ↓
 *   [Claude 판단] 첫 번째 팀원 결정
 *     ↓
 *   [팀원 실행] PM / Developer / Reviewer / QA Tester
 *     ↓
 *   [Claude 재판단] 결과 보고, 다음 팀원 결정
 *     ├── Developer 실패 → 다시 Developer (최대 3회)
 *     ├── Reviewer 반려 → Developer에게 피드백
 *     ├── QA 통과 → 완료
 *     └── 최대 스텝 → 강제 종료
 *
 * v5와의 차이:
 *   v5: 정보 수집 파이프라인 (리서처 → 분석가 → 비평가 → 종합가)
 *   v6: 실제 코드 개발 파이프라인 (PM → 개발자 → 리뷰어 → QA)
 *       + 실제 코드 실행으로 정량적 피드백 (에러 메시지, 테스트 결과)
 */

import type { DevAgentRole } from "./dev-agent.js";

// Claude API 호출
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

// 다음 개발 팀원 결정 정보
export interface DevNextStep {
  nextRole: DevAgentRole | "done";
  instruction: string;    // 이 팀원에게 줄 구체적 지시
  reasoning: string;      // Claude의 결정 이유
  priority: "normal" | "fix" | "recheck";  // 일반/수정/재확인
}

// 초기 계획
export interface DevInitialPlan {
  firstStep: DevNextStep;
  overallStrategy: string;
  estimatedSteps: number;
  techStack: string;      // 사용할 기술 스택 (예: "Node.js + assert")
}

// 완료된 팀원 작업 요약
export interface DevCompletedStep {
  role: DevAgentRole;
  output: string;
  filesCreated: string[];
  executionSuccess?: boolean;  // 코드 실행 성공 여부
  qualityScore?: number;       // 리뷰어/QA 점수
  attempt: number;
}

/**
 * 첫 번째 팀원 결정 (PM이 먼저 하는 게 일반적이지만 Claude가 결정)
 */
export async function decideDevFirstStep(
  devRequest: string,
  anthropicKey: string
): Promise<DevInitialPlan> {

  const systemPrompt = `당신은 AI 개발팀 워크플로우 오케스트레이터입니다.
개발 요청을 분석하고 첫 번째로 실행할 팀원을 결정하세요.

사용 가능한 팀원:
- pm: 요구사항 분석, 기술 명세서 작성, 파일 구조 설계
- developer: 실제 코드 작성 및 실행 검증 (Node.js/JavaScript)
- reviewer: 코드 품질 검토 (가독성, 에러처리, 효율성)
- qa_tester: 테스트 코드 작성 및 실행

반드시 JSON으로만 응답:
{
  "overallStrategy": "전체 개발 전략 1~2문장",
  "estimatedSteps": 예상 단계 수 (3~6),
  "techStack": "사용할 기술 스택",
  "firstStep": {
    "nextRole": "첫 번째 팀원 역할",
    "instruction": "이 팀원에게 줄 구체적 지시 (2~3문장)",
    "reasoning": "왜 이 팀원을 첫 번째로 선택했나",
    "priority": "normal"
  }
}`;

  try {
    const raw = await callClaude(anthropicKey, [{
      role: "user",
      content: `개발 요청: "${devRequest}"\n\n첫 번째 팀원을 결정하세요.`
    }], systemPrompt, 600);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 없음");
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      firstStep: parsed.firstStep,
      overallStrategy: parsed.overallStrategy || "PM → 개발자 → 리뷰어 → QA 순서로 진행",
      estimatedSteps: parsed.estimatedSteps || 4,
      techStack: parsed.techStack || "Node.js JavaScript"
    };
  } catch (err) {
    console.error("[DevOrchestrator] 첫 스텝 결정 실패:", err);
    return getDefaultDevFirstStep();
  }
}

/**
 * 다음 팀원 결정 (핵심 - 실행 결과 기반 동적 결정)
 */
export async function decideDevNextStep(
  devRequest: string,
  anthropicKey: string,
  completedSteps: DevCompletedStep[],
  stepCount: number
): Promise<DevNextStep> {

  // 안전장치: 최대 10스텝
  if (stepCount >= 10) {
    return {
      nextRole: "done",
      instruction: "개발 완료",
      reasoning: "최대 스텝(10) 도달 - 강제 종료",
      priority: "normal"
    };
  }

  const systemPrompt = `당신은 AI 개발팀 워크플로우 오케스트레이터입니다.
지금까지 완료된 작업 결과를 보고, 다음에 실행할 팀원을 결정하세요.

사용 가능한 팀원:
- pm: 요구사항이 불명확하거나 재설계 필요 시
- developer: 코드 작성/수정 필요 시 (실행 오류, 리뷰 반려 등)
- reviewer: 코드가 완성된 후 품질 검토
- qa_tester: 리뷰 통과 후 최종 테스트
- done: QA 통과 또는 충분히 완성된 경우

중요 판단 기준:
- 코드 실행에 실패했다면 → developer (수정 필요)
- 리뷰어가 반려했다면 → developer (피드백 반영)
- 테스트가 실패했다면 → developer (버그 수정)
- QA가 통과했다면 → done

현재 진행: ${stepCount + 1}번째 스텝

반드시 JSON으로만 응답:
{
  "nextRole": "다음 팀원 또는 done",
  "instruction": "다음 팀원에게 줄 구체적 지시 (이전 결과 참조, 2~3문장)",
  "reasoning": "이 결정 이유 (1~2문장)",
  "priority": "normal" 또는 "fix" 또는 "recheck"
}`;

  // 각 완료된 스텝 요약
  const stepsSummary = completedSteps.map((s, i) => {
    const execStatus = s.executionSuccess !== undefined
      ? (s.executionSuccess ? "✅ 실행 성공" : "❌ 실행 실패")
      : "";
    const scoreInfo = s.qualityScore !== undefined
      ? ` | 품질점수: ${s.qualityScore}점`
      : "";
    const filesInfo = s.filesCreated.length > 0
      ? `\n  생성 파일: ${s.filesCreated.join(", ")}`
      : "";
    const preview = s.output.length > 400 ? s.output.slice(0, 400) + "...(생략)" : s.output;

    return `${i + 1}. [${s.role}${s.attempt > 1 ? ` (${s.attempt}차)` : ""}] ${execStatus}${scoreInfo}${filesInfo}\n결과 요약:\n${preview}`;
  }).join("\n\n---\n\n");

  try {
    const raw = await callClaude(anthropicKey, [{
      role: "user",
      content: `개발 요청: "${devRequest}"\n\n완료된 작업 (${completedSteps.length}개):\n\n${stepsSummary}\n\n다음 팀원을 결정하세요.`
    }], systemPrompt, 512);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 없음");
    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.nextRole === "done") {
      return {
        nextRole: "done",
        instruction: parsed.instruction || "개발 완료",
        reasoning: parsed.reasoning || "충분히 완성됨",
        priority: "normal"
      };
    }

    return {
      nextRole: parsed.nextRole as DevAgentRole,
      instruction: parsed.instruction || "작업을 수행하세요.",
      reasoning: parsed.reasoning || "결정 이유 없음",
      priority: parsed.priority || "normal"
    };

  } catch (err) {
    console.error("[DevOrchestrator] 다음 스텝 결정 실패:", err);
    return getDefaultDevNextStep(completedSteps);
  }
}

/**
 * 기본 첫 스텝 (Anthropic 키 없을 때)
 */
export function getDefaultDevFirstStep(): DevInitialPlan {
  return {
    firstStep: {
      nextRole: "pm",
      instruction: "개발 요청을 분석하고 기술 명세서를 작성하세요.",
      reasoning: "기본 계획: PM이 먼저 명세서 작성",
      priority: "normal"
    },
    overallStrategy: "기본 계획: PM → Developer → Reviewer → QA",
    estimatedSteps: 4,
    techStack: "Node.js JavaScript"
  };
}

/**
 * 기본 다음 스텝 (에러 fallback)
 */
export function getDefaultDevNextStep(completedSteps: DevCompletedStep[]): DevNextStep {
  const roles = completedSteps.map(s => s.role);

  if (!roles.includes("pm")) {
    return { nextRole: "pm", instruction: "요구사항을 분석하세요.", reasoning: "기본: PM 먼저", priority: "normal" };
  }
  if (!roles.includes("developer")) {
    return { nextRole: "developer", instruction: "PM 명세서로 코드를 작성하세요.", reasoning: "기본: 개발 단계", priority: "normal" };
  }

  // 실행 실패한 개발자 작업이 있으면 재시도
  const lastDev = [...completedSteps].reverse().find(s => s.role === "developer");
  if (lastDev && lastDev.executionSuccess === false) {
    return { nextRole: "developer", instruction: "실행 오류를 수정하세요.", reasoning: "기본: 실행 실패 수정", priority: "fix" };
  }

  if (!roles.includes("reviewer")) {
    return { nextRole: "reviewer", instruction: "작성된 코드를 검토하세요.", reasoning: "기본: 리뷰 단계", priority: "normal" };
  }

  // 리뷰어 점수가 낮으면 개발자에게 돌려보내기
  const lastReview = [...completedSteps].reverse().find(s => s.role === "reviewer");
  if (lastReview && (lastReview.qualityScore || 0) < 70) {
    return { nextRole: "developer", instruction: "리뷰어 피드백을 반영하여 코드를 개선하세요.", reasoning: "기본: 리뷰 반려", priority: "fix" };
  }

  if (!roles.includes("qa_tester")) {
    return { nextRole: "qa_tester", instruction: "테스트를 작성하고 실행하세요.", reasoning: "기본: QA 단계", priority: "normal" };
  }

  return { nextRole: "done", instruction: "개발 완료", reasoning: "기본: 모든 단계 완료", priority: "normal" };
}
