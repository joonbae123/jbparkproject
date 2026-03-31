/**
 * AI Harness 오케스트레이터 v5 - 완전 동적 워크플로우
 *
 * v4 → v5 핵심 변화:
 *
 *   v4: Claude가 시작 시 steps[] 배열 생성 → 순서대로 실행 (반정적)
 *   v5: Claude가 매 에이전트 완료 후 "다음에 뭘 할지" 실시간 결정 (완전 동적)
 *
 * v5 실행 루프:
 *
 *  ┌─────────────────────────────────────────────────┐
 *  │  [시작] Claude가 첫 번째 에이전트 결정            │
 *  │         ↓                                       │
 *  │  [실행] 결정된 에이전트 실행                      │
 *  │         ↓                                       │
 *  │  [재판단] Claude가 결과 보고 "다음에 뭘 할지" 결정 │
 *  │         ↓                                        │
 *  │  synthesizer 결정 → 최종 보고서 → 종료            │
 *  └─────────────────────────────────────────────────┘
 *
 * 진짜 동적인 이유:
 *   - Researcher 결과가 풍부 → Claude: "Analyst 없이 바로 Critic"
 *   - Researcher 결과가 빈약 → Claude: "Researcher 한번 더, 다른 각도로"
 *   - Critic 점수 낮음 → Claude: "Analyst 한번 더 필요해"
 *   - 단순 질문 → Claude: "Researcher만으로 충분해, 바로 Synthesizer"
 */

import { runAgent, runCriticJudgement } from "./agent.js";
import {
  decideFirstStep,
  decideNextStep,
  getDefaultInitialPlan,
  getDefaultNextStep
} from "./claude-orchestrator.js";
import type {
  HarnessResult,
  AgentLog,
  RetryEvent,
  RetryReport,
  CriticJudgement
} from "./types.js";
import type { AgentResult, NextStepDecision } from "./claude-orchestrator.js";

export interface HarnessConfig {
  maxRetry: number;
  targetScore: number;
  projectId: string;
  anthropicKey: string;
}

// v5에서 Claude가 각 결정을 내릴 때 SSE로 전송할 이벤트
export interface DecisionEvent {
  type: "decision";
  stepNumber: number;
  decision: NextStepDecision;
  completedCount: number;
}

export interface StrategyEvent {
  type: "strategy";
  overallStrategy: string;
  estimatedComplexity: "low" | "medium" | "high";
  firstRole: string;
}

const DEFAULT_CONFIG: HarnessConfig = {
  maxRetry: 3,
  targetScore: 80,
  projectId: "",
  anthropicKey: ""
};

const ABSOLUTE_MAX_RETRIES = 10;
const ABSOLUTE_MAX_STEPS = 8;

export async function runHarness(
  query: string,
  apiKey: string,
  onAgentUpdate?: (log: AgentLog, event?: RetryEvent) => void,
  config: Partial<HarnessConfig> = {},
  onDecisionUpdate?: (event: DecisionEvent | StrategyEvent) => void
): Promise<HarnessResult> {

  const cfg: HarnessConfig = { ...DEFAULT_CONFIG, ...config };
  const effectiveMaxRetry = cfg.maxRetry === 0 ? ABSOLUTE_MAX_RETRIES : cfg.maxRetry;
  const useClaudeOrchestrator = !!cfg.anthropicKey;

  const startTime = Date.now();
  const allLogs: AgentLog[] = [];
  const mcpToolsUsed: string[] = [];
  const retryEvents: RetryEvent[] = [];
  const qualityProgression: number[] = [];

  // 완료된 에이전트 결과 축적 (Claude에게 전달)
  const completedResults: AgentResult[] = [];

  let lastCriticScore: number | null = null;
  let forcedStop = false;
  let stepCount = 0;

  // 재시도 관련 상태
  let judgeAttempt = 0;
  let judgeApproved = false;
  let previousFeedback = "";

  const collectTools = (log: AgentLog) => {
    log.toolCalls?.forEach(tc => {
      if (!mcpToolsUsed.includes(tc.toolName)) mcpToolsUsed.push(tc.toolName);
    });
  };

  const trimText = (text: string, maxLen = 1500) =>
    text.length > maxLen ? text.slice(0, maxLen) + "\n...(이하 생략)" : text;

  console.log("\n========== AI Harness v5 시작 (완전 동적) ==========");
  console.log(`쿼리: ${query}`);
  console.log(`오케스트레이터: ${useClaudeOrchestrator ? "Claude claude-3-5-haiku (동적)" : "기본(코드)"}`);
  console.log(`최대 재시도: ${cfg.maxRetry === 0 ? `무제한(안전장치 ${ABSOLUTE_MAX_RETRIES}회)` : cfg.maxRetry + "회"}`);
  console.log(`목표 점수: ${cfg.targetScore}점`);
  console.log("======================================================\n");

  // ──────────────────────────────────────────────────────────
  // STEP 1: Claude가 첫 번째 에이전트 결정
  // ──────────────────────────────────────────────────────────
  let initialPlan;
  if (useClaudeOrchestrator) {
    console.log("🧠 [Claude] 첫 번째 에이전트 결정 중...");
    initialPlan = await decideFirstStep(query, cfg.anthropicKey, cfg.targetScore);
  } else {
    initialPlan = getDefaultInitialPlan();
  }

  console.log(`📋 전체 전략: ${initialPlan.overallStrategy}`);
  console.log(`🎯 첫 번째: ${initialPlan.firstStep.nextRole} (이유: ${initialPlan.firstStep.reasoning})`);

  onDecisionUpdate?.({
    type: "strategy",
    overallStrategy: initialPlan.overallStrategy,
    estimatedComplexity: initialPlan.estimatedComplexity,
    firstRole: initialPlan.firstStep.nextRole
  });

  // 첫 번째 결정도 decision 이벤트로 전송
  onDecisionUpdate?.({
    type: "decision",
    stepNumber: 1,
    decision: initialPlan.firstStep,
    completedCount: 0
  });

  // ──────────────────────────────────────────────────────────
  // STEP 2: 동적 실행 루프
  // ──────────────────────────────────────────────────────────
  let currentDecision = initialPlan.firstStep;

  while (currentDecision.nextRole !== "synthesizer" && currentDecision.nextRole !== "done") {
    stepCount++;

    // critic + isJudge 모드: 피드백 루프
    if (currentDecision.nextRole === "critic" && currentDecision.isJudge ||
        currentDecision.nextRole === "critic" && currentDecision.isJudge) {

      judgeAttempt = 0;
      judgeApproved = false;
      previousFeedback = "";

      const researchLogs = allLogs.filter(l => l.agentRole === "researcher");
      const analysisLogs = allLogs.filter(l => l.agentRole === "analyst");
      let lastResearch = researchLogs[researchLogs.length - 1];
      let lastAnalysis = analysisLogs[analysisLogs.length - 1];

      while (!judgeApproved && judgeAttempt < effectiveMaxRetry) {
        judgeAttempt++;

        if (judgeAttempt > 1) {
          console.log(`🔄 [${judgeAttempt}차 재시도] Researcher 재실행...`);
          const retryMsg = `다음 주제에 대해 리서치하세요: "${query}"${previousFeedback ? `\n\n[이전 반려 피드백 - 반드시 반영]\n${previousFeedback}` : ""}`;

          const retryResearch = await runAgent("researcher", retryMsg, apiKey, "", cfg.projectId);
          retryResearch.attempt = judgeAttempt;
          allLogs.push(retryResearch);
          collectTools(retryResearch);
          onAgentUpdate?.(retryResearch);
          lastResearch = retryResearch;
          completedResults.push({
            role: "researcher",
            output: retryResearch.output || "",
            toolsUsed: retryResearch.toolCalls?.map(t => t.toolName) || [],
            attempt: judgeAttempt
          });

          // Analyst도 재실행 (있을 때만)
          if (lastAnalysis) {
            const retryAnalysis = await runAgent(
              "analyst",
              currentDecision.instruction || "리서치 결과를 심층 분석하세요.",
              apiKey,
              trimText(retryResearch.output || ""),
              cfg.projectId
            );
            retryAnalysis.attempt = judgeAttempt;
            allLogs.push(retryAnalysis);
            collectTools(retryAnalysis);
            onAgentUpdate?.(retryAnalysis);
            lastAnalysis = retryAnalysis;
            completedResults.push({
              role: "analyst",
              output: retryAnalysis.output || "",
              toolsUsed: retryAnalysis.toolCalls?.map(t => t.toolName) || [],
              attempt: judgeAttempt
            });
          }
        }

        // Critic 판정
        const { log: criticLog, judgement } = await runCriticJudgement(
          trimText(lastResearch?.output || "", 800),
          trimText(lastAnalysis?.output || "", 800),
          query, apiKey, cfg.projectId, judgeAttempt, cfg.targetScore
        );
        criticLog.attempt = judgeAttempt;
        allLogs.push(criticLog);
        collectTools(criticLog);
        qualityProgression.push(judgement.score);
        lastCriticScore = judgement.score;

        completedResults.push({
          role: "critic",
          output: criticLog.output || "",
          toolsUsed: criticLog.toolCalls?.map(t => t.toolName) || [],
          attempt: judgeAttempt
        });

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

          if (judgeAttempt >= effectiveMaxRetry) {
            forcedStop = true;
            judgeApproved = true;
            console.log(`⚠️ 최대 재시도 소진 → 강제 진행`);
            onAgentUpdate?.(criticLog, retryEvent);
          } else {
            onAgentUpdate?.(criticLog, retryEvent);
          }
        }
      }

    } else {
      // 일반 에이전트 실행
      console.log(`▶ [Step ${stepCount}] ${currentDecision.nextRole} 실행 중...`);
      console.log(`  지시: ${currentDecision.instruction}`);

      // researcher는 이전 컨텍스트 없이, 나머지는 이전 결과 전달
      const context = currentDecision.nextRole === "researcher"
        ? (previousFeedback ? `[이전 반려 피드백]\n${previousFeedback}` : "")
        : trimText(completedResults.map(r => `[${r.role}]\n${r.output}`).join("\n\n"));

      const agentLog = await runAgent(
        currentDecision.nextRole as any,
        currentDecision.instruction || query,
        apiKey,
        context,
        cfg.projectId
      );

      allLogs.push(agentLog);
      collectTools(agentLog);
      onAgentUpdate?.(agentLog);

      completedResults.push({
        role: currentDecision.nextRole,
        output: agentLog.output || "",
        toolsUsed: agentLog.toolCalls?.map(t => t.toolName) || [],
        attempt: 1
      });
    }

    // ──────────────────────────────────────────────────────────
    // STEP 3: Claude가 다음 에이전트 결정 (v5의 핵심!)
    // ──────────────────────────────────────────────────────────
    if (useClaudeOrchestrator) {
      console.log(`\n🧠 [Claude] Step ${stepCount} 완료 → 다음 에이전트 결정 중...`);
      currentDecision = await decideNextStep(
        query,
        cfg.anthropicKey,
        completedResults,
        cfg.targetScore,
        lastCriticScore,
        stepCount
      );
    } else {
      currentDecision = getDefaultNextStep(completedResults, lastCriticScore, cfg.targetScore);
    }

    console.log(`  → 다음: ${currentDecision.nextRole} (이유: ${currentDecision.reasoning})`);

    onDecisionUpdate?.({
      type: "decision",
      stepNumber: stepCount + 1,
      decision: currentDecision,
      completedCount: completedResults.length
    });
  }

  // ──────────────────────────────────────────────────────────
  // STEP 4: Synthesizer - 최종 보고서 작성
  // ──────────────────────────────────────────────────────────
  console.log(`\n✨ [Synthesizer] 최종 보고서 작성 중...`);
  const synthContext = trimText(
    completedResults.map(r => `[${r.role}${r.attempt > 1 ? ` (${r.attempt}차)` : ""}]\n${r.output}`).join("\n\n"),
    3000
  );

  const forcedNote = forcedStop
    ? `\n⚠️ 주의: 목표 점수(${cfg.targetScore}점)에 도달하지 못한 채 강제 종료된 결과입니다.`
    : "";

  const synthLog = await runAgent(
    "synthesizer",
    `다음 모든 에이전트 결과를 종합하여 최종 보고서를 작성하세요.\n원본 쿼리: ${query}${forcedNote}`,
    apiKey,
    synthContext,
    cfg.projectId
  );
  allLogs.push(synthLog);
  collectTools(synthLog);
  onAgentUpdate?.(synthLog);

  // ──────────────────────────────────────────────────────────
  // STEP 5: 리포트 생성
  // ──────────────────────────────────────────────────────────
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

  console.log("\n========== AI Harness v5 완료 ==========");
  console.log(`총 소요: ${(totalDuration / 1000).toFixed(1)}s | 에이전트: ${allLogs.length}개 | 스텝: ${stepCount}개 | 반려: ${retryEvents.length}회`);
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
  const limitInfo = maxRetry === 0 ? `안전장치(${ABSOLUTE_MAX_RETRIES}회)` : `최대 ${maxRetry}회`;
  const resultLine = forcedStop
    ? `⚠️ ${totalAttempts}차 모두 반려 (${limitInfo} 소진) → 강제 종료`
    : `✅ ${totalAttempts}차 시도 끝에 최종 승인 (${lastScore}점 ≥ 목표 ${targetScore}점)`;
  return `${resultLine}\n\n${trendIcon} 점수 변화: ${qualityProgression.join("점 → ")}점\n   개선폭: ${improvement > 0 ? "+" : ""}${improvement}점\n\n주요 반려 사유:\n${allIssues.slice(0, 3).map((issue, i) => `  ${i + 1}. ${issue}`).join("\n")}`.trim();
}
