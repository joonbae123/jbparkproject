/**
 * AI Harness 오케스트레이터 v2 - 피드백 루프 버전
 *
 * 핵심 변경사항:
 * - 비평가가 "반려" 판정 시 리서처로 되돌아가 재시도
 * - 최대 3번까지 재시도 (무한루프 방지)
 * - 모든 반려/재시도 이벤트를 기록 → 리포트 생성
 *
 * 새로운 파이프라인:
 *
 *  사용자 쿼리
 *      │
 *      ▼
 *  ┌─────────────────────────────────────┐
 *  │           피드백 루프                │
 *  │                                     │
 *  │  ┌──────────┐    ┌──────────┐       │
 *  │  │Researcher│───►│ Analyst  │       │
 *  │  └──────────┘    └────┬─────┘       │
 *  │       ▲               │             │
 *  │       │ 반려!          ▼             │
 *  │       │         ┌──────────┐        │
 *  │       └─────────│  Critic  │        │
 *  │                 │ (판정관) │        │
 *  │                 └────┬─────┘        │
 *  │                      │ 승인!        │
 *  └──────────────────────┼─────────────┘
 *                         ▼
 *                  ┌──────────────┐
 *                  │ Synthesizer  │
 *                  │ (최종 보고서) │
 *                  └──────────────┘
 */

import { runAgent, runCriticJudgement } from "./agent.js";
import type {
  HarnessResult,
  AgentLog,
  RetryEvent,
  RetryReport,
  CriticJudgement
} from "./types.js";

const MAX_RETRY = 3; // 최대 재시도 횟수

export async function runHarness(
  query: string,
  apiKey: string,
  onAgentUpdate?: (log: AgentLog, event?: RetryEvent) => void,
  projectId: string = ""
): Promise<HarnessResult> {

  const startTime = Date.now();
  const allLogs: AgentLog[] = [];
  const mcpToolsUsed: string[] = [];
  const retryEvents: RetryEvent[] = [];
  const qualityProgression: number[] = [];

  const collectTools = (log: AgentLog) => {
    log.toolCalls?.forEach(tc => {
      if (!mcpToolsUsed.includes(tc.toolName)) mcpToolsUsed.push(tc.toolName);
    });
  };

  const trimContext = (text: string, maxLen = 1500) =>
    text.length > maxLen ? text.slice(0, maxLen) + "\n...(이하 생략)" : text;

  console.log("\n========== AI Harness v2 (피드백 루프) 시작 ==========");
  console.log(`쿼리: ${query}`);
  console.log(`최대 재시도: ${MAX_RETRY}회`);
  console.log("=====================================================\n");

  // ===== 피드백 루프 =====
  let attempt = 0;
  let approved = false;
  let finalResearchLog: AgentLog | null = null;
  let finalAnalysisLog: AgentLog | null = null;
  let lastJudgement: CriticJudgement | null = null;
  let previousFeedback = ""; // 이전 반려 피드백 (재시도 시 전달)

  while (!approved && attempt < MAX_RETRY) {
    attempt++;
    console.log(`\n--- ${attempt}차 시도 시작 ---`);

    // Step 1: 리서처
    console.log(`🔍 [${attempt}차] Researcher Agent 실행 중...`);
    const researchLog = await runAgent(
      "researcher",
      `다음 주제에 대해 리서치하세요: "${query}"
관련된 최신 정보, 주요 개념, 현황을 조사해주세요.
${previousFeedback ? `\n[이전 반려 피드백 - 반드시 반영하세요]\n${previousFeedback}` : ""}`,
      apiKey,
      "",
      projectId
    );
    researchLog.attempt = attempt;
    allLogs.push(researchLog);
    collectTools(researchLog);
    onAgentUpdate?.(researchLog);

    // Step 2: 분석가
    console.log(`📊 [${attempt}차] Analyst Agent 실행 중...`);
    const analysisLog = await runAgent(
      "analyst",
      `위의 리서치 결과를 심층 분석하여 핵심 인사이트와 패턴을 도출하세요.`,
      apiKey,
      trimContext(researchLog.output || ""),
      projectId
    );
    analysisLog.attempt = attempt;
    allLogs.push(analysisLog);
    collectTools(analysisLog);
    onAgentUpdate?.(analysisLog);

    // Step 3: 비평가 판정 (승인/반려 결정)
    console.log(`⚖️ [${attempt}차] Critic Agent 판정 중...`);
    const { log: criticLog, judgement } = await runCriticJudgement(
      trimContext(researchLog.output || "", 800),
      trimContext(analysisLog.output || "", 800),
      query,
      apiKey,
      projectId,
      attempt
    );
    criticLog.attempt = attempt;
    allLogs.push(criticLog);
    collectTools(criticLog);
    qualityProgression.push(judgement.score);
    lastJudgement = judgement;

    if (judgement.verdict === "rejected") {
      // 반려 처리
      const retryEvent: RetryEvent = {
        attempt,
        rejectedAt: new Date().toISOString(),
        judgement,
        researcherOutput: researchLog.output || "",
        criticOutput: criticLog.output || ""
      };
      retryEvents.push(retryEvent);

      // 다음 재시도에 전달할 피드백 구성
      previousFeedback = `
반려 이유: ${judgement.reason}
문제점:
${judgement.issues.map((i, idx) => `  ${idx + 1}. ${i}`).join("\n")}
개선 제안:
${judgement.suggestions.map((s, idx) => `  ${idx + 1}. ${s}`).join("\n")}
      `.trim();

      console.log(`❌ ${attempt}차 반려 (${judgement.score}점) - 재시도 예정`);
      onAgentUpdate?.(criticLog, retryEvent);

      if (attempt >= MAX_RETRY) {
        console.log(`⚠️ 최대 재시도 횟수(${MAX_RETRY}) 도달 - 강제 진행`);
        approved = true; // 최대 재시도 도달 시 강제 통과
      }
    } else {
      // 승인 처리
      approved = true;
      finalResearchLog = researchLog;
      finalAnalysisLog = analysisLog;
      console.log(`✅ ${attempt}차 승인 (${judgement.score}점) - 다음 단계 진행`);
      onAgentUpdate?.(criticLog);
    }
  }

  // 최종 결과 사용할 로그 (승인된 것 or 마지막 시도)
  if (!finalResearchLog || !finalAnalysisLog) {
    const researchLogs = allLogs.filter(l => l.agentRole === "researcher");
    const analysisLogs = allLogs.filter(l => l.agentRole === "analyst");
    finalResearchLog = researchLogs[researchLogs.length - 1];
    finalAnalysisLog = analysisLogs[analysisLogs.length - 1];
  }

  const criticLogs = allLogs.filter(l => l.agentRole === "critic");
  const finalCriticLog = criticLogs[criticLogs.length - 1];

  // Step 4: 종합가 (최종 보고서)
  console.log(`✨ Synthesizer Agent 실행 중...`);
  const synthLog = await runAgent(
    "synthesizer",
    `쿼리: "${query}"\n\n위의 모든 에이전트 작업을 종합하여 최종 보고서를 작성하세요.`,
    apiKey,
    `[리서치 (${attempt}차 최종)]\n${trimContext(finalResearchLog?.output || "", 700)}\n\n[분석]\n${trimContext(finalAnalysisLog?.output || "", 700)}\n\n[검증/비평]\n${trimContext(finalCriticLog?.output || "", 700)}`,
    projectId
  );
  allLogs.push(synthLog);
  onAgentUpdate?.(synthLog);

  // ===== 반려/재시도 리포트 생성 =====
  const retryReport: RetryReport = {
    totalAttempts: attempt,
    totalRejections: retryEvents.length,
    finalVerdict: lastJudgement?.verdict || "approved",
    retryEvents,
    qualityProgression,
    improvementSummary: generateImprovementSummary(retryEvents, qualityProgression, attempt)
  };

  const totalDuration = Date.now() - startTime;

  console.log("\n========== AI Harness v2 완료 ==========");
  console.log(`총 소요 시간: ${totalDuration}ms`);
  console.log(`총 시도 횟수: ${attempt}회`);
  console.log(`총 반려 횟수: ${retryEvents.length}회`);
  console.log(`품질 점수 추이: ${qualityProgression.join(" → ")}`);
  console.log("=========================================\n");

  return {
    query,
    logs: allLogs,
    finalReport: synthLog.output || "보고서 생성 실패",
    retryReport,
    totalDuration,
    mcpToolsUsed,
    agentsExecuted: allLogs.length
  };
}

/**
 * 반려→승인 과정 요약 텍스트 생성
 */
function generateImprovementSummary(
  retryEvents: RetryEvent[],
  qualityProgression: number[],
  totalAttempts: number
): string {
  if (retryEvents.length === 0) {
    return `첫 번째 시도에서 바로 승인되었습니다. (품질 점수: ${qualityProgression[0]}점)`;
  }

  const firstScore = qualityProgression[0];
  const lastScore = qualityProgression[qualityProgression.length - 1];
  const improvement = lastScore - firstScore;

  const allIssues = retryEvents.flatMap(e => e.judgement.issues);
  const uniqueIssues = [...new Set(allIssues)];

  return `
총 ${totalAttempts}차 시도 끝에 최종 ${qualityProgression[qualityProgression.length-1]}점으로 완료되었습니다.

품질 점수 변화: ${qualityProgression.join("점 → ")}점
개선폭: ${improvement > 0 ? "+" : ""}${improvement}점

주요 반려 사유:
${uniqueIssues.slice(0, 3).map((issue, i) => `  ${i + 1}. ${issue}`).join("\n")}
  `.trim();
}
