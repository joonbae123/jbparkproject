/**
 * AI Harness 오케스트레이터 v3 - 사용자 설정 가능 피드백 루프
 *
 * 변경사항:
 * - maxRetry: 사용자가 최대 재시도 횟수 직접 설정 (1~10회, 0 = 무제한)
 * - targetScore: 목표 품질 점수 설정 (이 점수 이상이면 자동 승인)
 *
 * 종료 조건 (우선순위 순):
 *   1. 점수 ≥ targetScore → 즉시 승인
 *   2. attempt ≥ maxRetry (maxRetry > 0) → 강제 종료
 *   3. maxRetry === 0 → 점수 기준만으로 판단 (횟수 무제한)
 */

import { runAgent, runCriticJudgement } from "./agent.js";
import type {
  HarnessResult,
  AgentLog,
  RetryEvent,
  RetryReport,
  CriticJudgement
} from "./types.js";

export interface HarnessConfig {
  maxRetry: number;    // 최대 재시도 횟수 (0 = 무제한)
  targetScore: number; // 합격 기준 점수 (0~100)
  projectId: string;
}

const DEFAULT_CONFIG: HarnessConfig = {
  maxRetry: 3,
  targetScore: 80,
  projectId: ""
};

// 안전장치: 무제한 모드에서도 이 횟수를 넘으면 강제 종료 (비용 폭발 방지)
const ABSOLUTE_MAX = 10;

export async function runHarness(
  query: string,
  apiKey: string,
  onAgentUpdate?: (log: AgentLog, event?: RetryEvent) => void,
  config: Partial<HarnessConfig> = {}
): Promise<HarnessResult> {

  // 설정 병합 (사용자 값 우선, 없으면 기본값)
  const cfg: HarnessConfig = { ...DEFAULT_CONFIG, ...config };

  // 0이면 무제한 → 안전장치로 ABSOLUTE_MAX 사용
  const effectiveMax = cfg.maxRetry === 0 ? ABSOLUTE_MAX : cfg.maxRetry;

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

  console.log("\n========== AI Harness v3 시작 ==========");
  console.log(`쿼리: ${query}`);
  console.log(`최대 재시도: ${cfg.maxRetry === 0 ? `무제한 (안전장치: ${ABSOLUTE_MAX}회)` : `${cfg.maxRetry}회`}`);
  console.log(`목표 점수: ${cfg.targetScore}점`);
  console.log("=========================================\n");

  let attempt = 0;
  let approved = false;
  let forcedStop = false;
  let finalResearchLog: AgentLog | null = null;
  let finalAnalysisLog: AgentLog | null = null;
  let lastJudgement: CriticJudgement | null = null;
  let previousFeedback = "";

  while (!approved && attempt < effectiveMax) {
    attempt++;
    console.log(`\n--- ${attempt}차 시도 (목표: ${cfg.targetScore}점 이상) ---`);

    // Step 1: 리서처
    console.log(`🔍 [${attempt}차] Researcher Agent 실행 중...`);
    const researchLog = await runAgent(
      "researcher",
      `다음 주제에 대해 리서치하세요: "${query}"
관련된 최신 정보, 주요 개념, 현황을 조사해주세요.
${previousFeedback ? `\n[이전 반려 피드백 - 반드시 반영하세요]\n${previousFeedback}` : ""}`,
      apiKey,
      "",
      cfg.projectId
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
      cfg.projectId
    );
    analysisLog.attempt = attempt;
    allLogs.push(analysisLog);
    collectTools(analysisLog);
    onAgentUpdate?.(analysisLog);

    // Step 3: 비평가 판정
    console.log(`⚖️ [${attempt}차] Critic Agent 판정 중... (합격 기준: ${cfg.targetScore}점)`);
    const { log: criticLog, judgement } = await runCriticJudgement(
      trimContext(researchLog.output || "", 800),
      trimContext(analysisLog.output || "", 800),
      query,
      apiKey,
      cfg.projectId,
      attempt,
      cfg.targetScore  // 목표 점수를 Critic에게도 전달
    );
    criticLog.attempt = attempt;
    allLogs.push(criticLog);
    collectTools(criticLog);
    qualityProgression.push(judgement.score);
    lastJudgement = judgement;

    // ===== 종료 조건 판단 =====
    const scoreOk = judgement.score >= cfg.targetScore;

    if (scoreOk) {
      // 목표 점수 달성 → 승인
      approved = true;
      finalResearchLog = researchLog;
      finalAnalysisLog = analysisLog;
      console.log(`✅ ${attempt}차 승인! ${judgement.score}점 ≥ 목표 ${cfg.targetScore}점`);
      onAgentUpdate?.(criticLog);

    } else {
      // 목표 점수 미달 → 반려
      const retryEvent: RetryEvent = {
        attempt,
        rejectedAt: new Date().toISOString(),
        judgement,
        researcherOutput: researchLog.output || "",
        criticOutput: criticLog.output || ""
      };
      retryEvents.push(retryEvent);

      previousFeedback = `
반려 이유: ${judgement.reason}
현재 점수: ${judgement.score}점 (목표: ${cfg.targetScore}점 이상 필요)
문제점:
${judgement.issues.map((i, idx) => `  ${idx + 1}. ${i}`).join("\n")}
개선 제안:
${judgement.suggestions.map((s, idx) => `  ${idx + 1}. ${s}`).join("\n")}
      `.trim();

      console.log(`❌ ${attempt}차 반려 (${judgement.score}점 < ${cfg.targetScore}점)`);

      const isLastChance = attempt >= effectiveMax;
      if (isLastChance) {
        // 횟수 소진 → 강제 종료
        forcedStop = true;
        approved = true;
        if (cfg.maxRetry === 0) {
          console.log(`⚠️ 안전장치 발동 (${ABSOLUTE_MAX}회 도달) - 강제 종료`);
        } else {
          console.log(`⚠️ 최대 재시도 횟수(${cfg.maxRetry}회) 소진 - 강제 종료`);
        }
        onAgentUpdate?.(criticLog, retryEvent);
      } else {
        console.log(`🔄 재시도 예정... (${attempt}/${effectiveMax}회 사용)`);
        onAgentUpdate?.(criticLog, retryEvent);
      }
    }
  }

  // 최종 사용할 로그 결정
  if (!finalResearchLog || !finalAnalysisLog) {
    const researchLogs = allLogs.filter(l => l.agentRole === "researcher");
    const analysisLogs = allLogs.filter(l => l.agentRole === "analyst");
    finalResearchLog = researchLogs[researchLogs.length - 1];
    finalAnalysisLog = analysisLogs[analysisLogs.length - 1];
  }

  const criticLogs = allLogs.filter(l => l.agentRole === "critic");
  const finalCriticLog = criticLogs[criticLogs.length - 1];

  // Step 4: 종합가 (최종 보고서)
  console.log(`\n✨ Synthesizer Agent 실행 중...`);
  const forcedNote = forcedStop
    ? `\n⚠️ 주의: 목표 점수(${cfg.targetScore}점)에 도달하지 못한 채 최대 재시도(${cfg.maxRetry === 0 ? '안전장치 ' + ABSOLUTE_MAX : cfg.maxRetry}회) 소진으로 강제 종료된 결과입니다.`
    : "";

  const synthLog = await runAgent(
    "synthesizer",
    `쿼리: "${query}"${forcedNote}\n\n위의 모든 에이전트 작업을 종합하여 최종 보고서를 작성하세요.`,
    apiKey,
    `[리서치 (${attempt}차 최종)]\n${trimContext(finalResearchLog?.output || "", 700)}\n\n[분석]\n${trimContext(finalAnalysisLog?.output || "", 700)}\n\n[검증/비평]\n${trimContext(finalCriticLog?.output || "", 700)}`,
    cfg.projectId
  );
  allLogs.push(synthLog);
  onAgentUpdate?.(synthLog);

  // ===== 리포트 생성 =====
  const retryReport: RetryReport = {
    totalAttempts: attempt,
    totalRejections: retryEvents.length,
    finalVerdict: forcedStop ? "rejected" : "approved",
    retryEvents,
    qualityProgression,
    improvementSummary: generateImprovementSummary(
      retryEvents, qualityProgression, attempt,
      cfg.targetScore, cfg.maxRetry, forcedStop
    )
  };

  const totalDuration = Date.now() - startTime;

  console.log("\n========== AI Harness v3 완료 ==========");
  console.log(`총 소요 시간: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`총 시도 횟수: ${attempt}회`);
  console.log(`총 반려 횟수: ${retryEvents.length}회`);
  console.log(`품질 점수 추이: ${qualityProgression.join(" → ")}`);
  console.log(`최종 결과: ${forcedStop ? "강제 종료" : "정상 승인"}`);
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
 * 개선 과정 요약 텍스트 생성
 */
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
    return `🎉 첫 번째 시도에서 바로 승인되었습니다!\n품질 점수: ${lastScore}점 (목표: ${targetScore}점)`;
  }

  const firstScore = qualityProgression[0] ?? 0;
  const improvement = lastScore - firstScore;
  const trendIcon = improvement > 0 ? "📈" : improvement < 0 ? "📉" : "➡️";

  const allIssues = retryEvents.flatMap(e => e.judgement.issues);
  const uniqueIssues = [...new Set(allIssues)];

  const limitInfo = maxRetry === 0
    ? `안전장치(${10}회) 기준`
    : `최대 ${maxRetry}회 설정`;

  const resultLine = forcedStop
    ? `⚠️ ${totalAttempts}차 모두 반려 (${limitInfo} 소진) → 강제 종료`
    : `✅ ${totalAttempts}차 시도 끝에 최종 승인 (${lastScore}점 ≥ 목표 ${targetScore}점)`;

  return `${resultLine}

${trendIcon} 품질 점수 변화: ${qualityProgression.join("점 → ")}점
   개선폭: ${improvement > 0 ? "+" : ""}${improvement}점

주요 반려 사유:
${uniqueIssues.slice(0, 3).map((issue, i) => `  ${i + 1}. ${issue}`).join("\n")}`.trim();
}
