/**
 * AI Harness 오케스트레이터 v4 - Claude AI 오케스트레이터
 *
 * v3(코드 오케스트레이터)와의 핵심 차이:
 *
 *   v3: TypeScript 코드가 순서 결정 (항상 Researcher→Analyst→Critic→Synthesizer)
 *   v4: Claude가 쿼리를 분석하여 실행 계획 동적 생성
 *       + 중간 검토(각 에이전트 완료 후 계획 수정 가능)
 *
 * 전체 흐름:
 *
 *  [1] Claude가 계획 수립
 *       → 쿼리 분석 후 에이전트 순서/지시 결정
 *       예) ["researcher", "researcher", "analyst", "critic(판정)", "synthesizer"]
 *
 *  [2] 계획대로 에이전트 순서 실행
 *       → 각 에이전트는 여전히 GPT-4o-mini
 *       → critic isJudge=true 이면 피드백 루프 진입
 *
 *  [3] Claude 중간 검토 (옵션)
 *       → 2개 이상 완료 시마다 "계획 변경 필요?" 재판단
 *
 *  [4] 최종 보고서 + 리포트
 */

import { runAgent, runCriticJudgement } from "./agent.js";
import { planWithClaude, reviewWithClaude } from "./claude-orchestrator.js";
import type {
  HarnessResult,
  AgentLog,
  RetryEvent,
  RetryReport,
  CriticJudgement
} from "./types.js";
import type { OrchestratorPlan, AgentStep } from "./claude-orchestrator.js";

export interface HarnessConfig {
  maxRetry: number;
  targetScore: number;
  projectId: string;
  anthropicKey: string;   // Claude 오케스트레이터용 (없으면 코드 오케스트레이터로 폴백)
}

const DEFAULT_CONFIG: HarnessConfig = {
  maxRetry: 3,
  targetScore: 80,
  projectId: "",
  anthropicKey: ""
};

const ABSOLUTE_MAX = 10;

// 계획 정보도 SSE로 전송하기 위한 이벤트 타입
export interface PlanEvent {
  type: "plan";
  plan: OrchestratorPlan;
}
export interface ReviewEvent {
  type: "review";
  comment: string;
  modified: boolean;
}

export async function runHarness(
  query: string,
  apiKey: string,
  onAgentUpdate?: (log: AgentLog, event?: RetryEvent) => void,
  config: Partial<HarnessConfig> = {},
  onPlanUpdate?: (event: PlanEvent | ReviewEvent) => void
): Promise<HarnessResult> {

  const cfg: HarnessConfig = { ...DEFAULT_CONFIG, ...config };
  const effectiveMax = cfg.maxRetry === 0 ? ABSOLUTE_MAX : cfg.maxRetry;

  const startTime     = Date.now();
  const allLogs:       AgentLog[]    = [];
  const mcpToolsUsed:  string[]      = [];
  const retryEvents:   RetryEvent[]  = [];
  const qualityProgression: number[] = [];

  const collectTools = (log: AgentLog) => {
    log.toolCalls?.forEach(tc => {
      if (!mcpToolsUsed.includes(tc.toolName)) mcpToolsUsed.push(tc.toolName);
    });
  };
  const trimContext = (text: string, maxLen = 1500) =>
    text.length > maxLen ? text.slice(0, maxLen) + "\n...(이하 생략)" : text;

  // ───────────────────────────────────────────
  // STEP 1: Claude가 실행 계획 수립
  // ───────────────────────────────────────────
  let plan: OrchestratorPlan;
  const useClaudeOrchestrator = !!cfg.anthropicKey;

  if (useClaudeOrchestrator) {
    console.log("\n🤖 [Claude 오케스트레이터] 실행 계획 수립 중...");
    plan = await planWithClaude(query, cfg.anthropicKey, cfg.targetScore);
    console.log(`📋 계획: ${plan.steps.map(s => s.role + (s.isJudge ? "(판정)" : "")).join(" → ")}`);
    console.log(`💭 이유: ${plan.reasoning}`);
    onPlanUpdate?.({ type: "plan", plan });
  } else {
    // Anthropic 키 없으면 기본 계획으로 폴백
    console.log("\n⚠️ Anthropic 키 없음 → 기본 계획으로 실행");
    plan = {
      reasoning: "Anthropic API 키가 입력되지 않아 기본 계획으로 실행합니다.",
      estimatedComplexity: "medium",
      steps: [
        { role: "researcher",  instruction: "주제에 대한 최신 정보를 수집하세요.", isJudge: false },
        { role: "analyst",     instruction: "수집된 정보를 심층 분석하세요.",      isJudge: false },
        { role: "critic",      instruction: "분석 내용을 검증하고 판정하세요.",     isJudge: true  },
        { role: "synthesizer", instruction: "최종 보고서를 작성하세요.",            isJudge: false }
      ]
    };
    onPlanUpdate?.({ type: "plan", plan });
  }

  console.log("\n========== AI Harness v4 시작 ==========");
  console.log(`쿼리: ${query}`);
  console.log(`오케스트레이터: ${useClaudeOrchestrator ? "Claude claude-3-5-haiku" : "기본(코드)"}`);
  console.log(`최대 재시도: ${cfg.maxRetry === 0 ? `무제한(안전장치 ${ABSOLUTE_MAX}회)` : cfg.maxRetry + "회"}`);
  console.log(`목표 점수: ${cfg.targetScore}점`);
  console.log("=========================================\n");

  // ───────────────────────────────────────────
  // STEP 2: 계획대로 에이전트 실행
  // ───────────────────────────────────────────
  let contextAccumulator = "";   // 이전 에이전트 출력 누적
  const completedSteps: { role: string; output: string }[] = [];
  let lastJudgement: CriticJudgement | null = null;
  let forcedStop = false;

  // critic(isJudge=true) 전용 재시도 루프 상태
  let judgeAttempt = 0;
  let judgeApproved = false;
  let previousFeedback = "";

  // plan.steps를 순서대로 실행
  // critic isJudge=true 구간은 내부적으로 피드백 루프
  let stepIndex = 0;
  const steps = [...plan.steps];

  while (stepIndex < steps.length) {
    const step = steps[stepIndex];

    // ── critic 판정 모드: 피드백 루프 ──
    if (step.role === "critic" && step.isJudge) {
      judgeAttempt = 0;
      judgeApproved = false;
      previousFeedback = "";

      // 직전 researcher/analyst 로그 찾기
      const researchLogs = allLogs.filter(l => l.agentRole === "researcher");
      const analysisLogs = allLogs.filter(l => l.agentRole === "analyst");
      let lastResearch = researchLogs[researchLogs.length - 1];
      let lastAnalysis = analysisLogs[analysisLogs.length - 1];

      while (!judgeApproved && judgeAttempt < effectiveMax) {
        judgeAttempt++;

        // 재시도 시 Researcher 재실행
        if (judgeAttempt > 1) {
          console.log(`🔄 [${judgeAttempt}차 재시도] Researcher 재실행...`);
          const retryResearch = await runAgent(
            "researcher",
            `다음 주제에 대해 리서치하세요: "${query}"
${previousFeedback ? `\n[이전 반려 피드백 - 반드시 반영]\n${previousFeedback}` : ""}`,
            apiKey, "", cfg.projectId
          );
          retryResearch.attempt = judgeAttempt;
          allLogs.push(retryResearch);
          collectTools(retryResearch);
          onAgentUpdate?.(retryResearch);
          lastResearch = retryResearch;

          // Analyst도 재실행
          const retryAnalysis = await runAgent(
            "analyst",
            step.instruction || "리서치 결과를 심층 분석하세요.",
            apiKey, trimContext(retryResearch.output || ""), cfg.projectId
          );
          retryAnalysis.attempt = judgeAttempt;
          allLogs.push(retryAnalysis);
          collectTools(retryAnalysis);
          onAgentUpdate?.(retryAnalysis);
          lastAnalysis = retryAnalysis;
        }

        // Critic 판정 실행
        const { log: criticLog, judgement } = await runCriticJudgement(
          trimContext(lastResearch?.output || "", 800),
          trimContext(lastAnalysis?.output || "", 800),
          query, apiKey, cfg.projectId, judgeAttempt, cfg.targetScore
        );
        criticLog.attempt = judgeAttempt;
        allLogs.push(criticLog);
        collectTools(criticLog);
        qualityProgression.push(judgement.score);
        lastJudgement = judgement;

        if (judgement.score >= cfg.targetScore) {
          judgeApproved = true;
          console.log(`✅ ${judgeAttempt}차 승인 (${judgement.score}점)`);
          onAgentUpdate?.(criticLog);
        } else {
          const retryEvent: RetryEvent = {
            attempt: judgeAttempt,
            rejectedAt: new Date().toISOString(),
            judgement,
            researcherOutput: lastResearch?.output || "",
            criticOutput: criticLog.output || ""
          };
          retryEvents.push(retryEvent);
          previousFeedback = `반려 이유: ${judgement.reason}\n현재 점수: ${judgement.score}점 (목표: ${cfg.targetScore}점)\n문제점:\n${judgement.issues.map((i, idx) => `  ${idx+1}. ${i}`).join("\n")}\n개선 제안:\n${judgement.suggestions.map((s, idx) => `  ${idx+1}. ${s}`).join("\n")}`;
          console.log(`❌ ${judgeAttempt}차 반려 (${judgement.score}점)`);

          if (judgeAttempt >= effectiveMax) {
            forcedStop = true;
            judgeApproved = true;
            console.log(`⚠️ 최대 재시도 소진 → 강제 진행`);
            onAgentUpdate?.(criticLog, retryEvent);
          } else {
            onAgentUpdate?.(criticLog, retryEvent);
          }
        }
      }

      // 컨텍스트 업데이트
      const latestCritic = allLogs.filter(l => l.agentRole === "critic").slice(-1)[0];
      contextAccumulator += `\n[검증/비평]\n${trimContext(latestCritic?.output || "", 500)}`;
      completedSteps.push({ role: "critic", output: latestCritic?.output || "" });
      stepIndex++;

    } else {
      // ── 일반 에이전트 실행 ──
      console.log(`▶ [Step ${stepIndex + 1}/${steps.length}] ${step.role} 실행 중...`);

      const agentLog = await runAgent(
        step.role as any,
        step.instruction || query,
        apiKey,
        step.role === "researcher" ? "" : trimContext(contextAccumulator),
        cfg.projectId
      );
      allLogs.push(agentLog);
      collectTools(agentLog);
      onAgentUpdate?.(agentLog);

      contextAccumulator += `\n[${step.role}]\n${trimContext(agentLog.output || "", 500)}`;
      completedSteps.push({ role: step.role, output: agentLog.output || "" });
      stepIndex++;

      // ── Claude 중간 검토 (synthesizer 직전, Anthropic 키 있을 때만) ──
      if (
        useClaudeOrchestrator &&
        stepIndex < steps.length &&
        steps[stepIndex]?.role !== "synthesizer" &&
        completedSteps.length >= 2
      ) {
        const remaining = steps.slice(stepIndex);
        const review = await reviewWithClaude(
          query, cfg.anthropicKey, completedSteps, remaining, cfg.targetScore
        );
        console.log(`🔍 [Claude 중간 검토] ${review.comment}`);
        if (review.modifiedSteps) {
          steps.splice(stepIndex, steps.length - stepIndex, ...review.modifiedSteps);
          console.log(`📝 계획 수정: ${review.modifiedSteps.map(s => s.role).join(" → ")}`);
        }
        onPlanUpdate?.({ type: "review", comment: review.comment, modified: !!review.modifiedSteps });
      }
    }
  }

  // ───────────────────────────────────────────
  // STEP 3: 리포트 생성
  // ───────────────────────────────────────────
  const synthLog = allLogs.filter(l => l.agentRole === "synthesizer").slice(-1)[0];

  const retryReport: RetryReport = {
    totalAttempts: judgeAttempt || 1,
    totalRejections: retryEvents.length,
    finalVerdict: forcedStop ? "rejected" : "approved",
    retryEvents,
    qualityProgression,
    improvementSummary: generateImprovementSummary(
      retryEvents, qualityProgression, judgeAttempt || 1,
      cfg.targetScore, cfg.maxRetry, forcedStop
    )
  };

  const totalDuration = Date.now() - startTime;

  console.log("\n========== AI Harness v4 완료 ==========");
  console.log(`총 소요: ${(totalDuration / 1000).toFixed(1)}s | 에이전트: ${allLogs.length}개 | 반려: ${retryEvents.length}회`);
  console.log("=========================================\n");

  return {
    query,
    logs: allLogs,
    finalReport: synthLog?.output || "보고서 생성 실패",
    retryReport,
    totalDuration,
    mcpToolsUsed,
    agentsExecuted: allLogs.length
  };
}

function generateImprovementSummary(
  retryEvents: RetryEvent[],
  qualityProgression: number[],
  totalAttempts: number,
  targetScore: number,
  maxRetry: number,
  forcedStop: boolean
): string {
  const lastScore = qualityProgression[qualityProgression.length - 1] ?? 0;
  if (retryEvents.length === 0) {
    return `🎉 첫 번째 시도에서 바로 승인!\n품질 점수: ${lastScore}점 (목표: ${targetScore}점)`;
  }
  const firstScore = qualityProgression[0] ?? 0;
  const improvement = lastScore - firstScore;
  const trendIcon = improvement > 0 ? "📈" : improvement < 0 ? "📉" : "➡️";
  const allIssues = [...new Set(retryEvents.flatMap(e => e.judgement.issues))];
  const limitInfo = maxRetry === 0 ? `안전장치(${ABSOLUTE_MAX}회)` : `최대 ${maxRetry}회`;
  const resultLine = forcedStop
    ? `⚠️ ${totalAttempts}차 모두 반려 (${limitInfo} 소진) → 강제 종료`
    : `✅ ${totalAttempts}차 시도 끝에 최종 승인 (${lastScore}점 ≥ 목표 ${targetScore}점)`;
  return `${resultLine}\n\n${trendIcon} 점수 변화: ${qualityProgression.join("점 → ")}점\n   개선폭: ${improvement > 0 ? "+" : ""}${improvement}점\n\n주요 반려 사유:\n${allIssues.slice(0, 3).map((issue, i) => `  ${i + 1}. ${issue}`).join("\n")}`.trim();
}
