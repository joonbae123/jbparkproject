/**
 * AI Harness 오케스트레이터
 * 
 * 오케스트레이터는 "지휘자"입니다.
 * 
 * 역할:
 * - 어떤 에이전트를 어떤 순서로 실행할지 결정
 * - 에이전트 간 컨텍스트(정보) 전달
 * - 전체 파이프라인 실행 및 결과 수집
 * 
 * 이 데모의 파이프라인:
 * 
 *  사용자 쿼리
 *      │
 *      ▼
 *  ┌─────────────┐
 *  │  Researcher │ ← web_search MCP Tool 사용
 *  │  (리서처)   │   → 관련 정보 수집
 *  └──────┬──────┘
 *         │ 리서치 결과 전달
 *         ▼
 *  ┌─────────────┐
 *  │   Analyst   │ ← analyze_text MCP Tool 사용
 *  │  (분석가)   │   → 데이터 분석 및 인사이트
 *  └──────┬──────┘
 *         │ 분석 결과 전달
 *         ▼
 *  ┌─────────────┐
 *  │    Critic   │ ← fact_check MCP Tool 사용
 *  │  (비평가)   │   → 주장 검증 및 보완
 *  └──────┬──────┘
 *         │ 검증 결과 전달
 *         ▼
 *  ┌─────────────┐
 *  │ Synthesizer │ ← MCP Tool 없음
 *  │  (종합가)   │   → 모든 내용 종합, 최종 보고서 작성
 *  └──────┬──────┘
 *         │
 *         ▼
 *    최종 보고서
 */

import { runAgent } from "./agent.js";
import type { HarnessResult, AgentLog } from "./types.js";

/**
 * Harness 파이프라인 실행
 * 
 * @param query - 사용자 질문/주제
 * @param apiKey - OpenAI API 키
 * @param onAgentUpdate - 에이전트 완료시 실시간 콜백 (UI 업데이트용)
 */
export async function runHarness(
  query: string,
  apiKey: string,
  onAgentUpdate?: (log: AgentLog) => void
): Promise<HarnessResult> {
  
  const startTime = Date.now();
  const logs: AgentLog[] = [];
  const mcpToolsUsed: string[] = [];
  
  console.log("\n========== AI Harness 시작 ==========");
  console.log(`쿼리: ${query}`);
  console.log("=====================================\n");
  
  // ===== Step 1: Researcher Agent =====
  // 역할: 주제에 대한 기본 정보 수집
  console.log("🔍 [Step 1] Researcher Agent 실행 중...");
  const researchLog = await runAgent(
    "researcher",
    `다음 주제에 대해 리서치하세요: "${query}"
    관련된 최신 정보, 주요 개념, 현황을 조사해주세요.`,
    apiKey,
    "" // 첫 번째 에이전트이므로 이전 컨텍스트 없음
  );
  logs.push(researchLog);
  
  // 사용된 MCP 도구 수집
  researchLog.toolCalls?.forEach(tc => {
    if (!mcpToolsUsed.includes(tc.toolName)) {
      mcpToolsUsed.push(tc.toolName);
    }
  });
  
  // 실시간 UI 업데이트 콜백
  onAgentUpdate?.(researchLog);
  
  // ===== Step 2: Analyst Agent =====
  // 역할: 리서처의 결과를 분석하여 인사이트 도출
  console.log("📊 [Step 2] Analyst Agent 실행 중...");
  const analysisLog = await runAgent(
    "analyst",
    `위의 리서치 결과를 심층 분석하여 핵심 인사이트와 패턴을 도출하세요.`,
    apiKey,
    researchLog.output || "" // 리서처 결과를 컨텍스트로 전달
  );
  logs.push(analysisLog);
  
  analysisLog.toolCalls?.forEach(tc => {
    if (!mcpToolsUsed.includes(tc.toolName)) {
      mcpToolsUsed.push(tc.toolName);
    }
  });
  
  onAgentUpdate?.(analysisLog);
  
  // ===== Step 3: Critic Agent =====
  // 역할: 이전 에이전트들의 결과를 검증하고 비판적으로 평가
  console.log("⚖️ [Step 3] Critic Agent 실행 중...");
  const criticLog = await runAgent(
    "critic",
    `위의 리서치와 분석 내용에서 주요 주장들을 검증하고, 놓친 부분이나 개선점을 제시하세요.`,
    apiKey,
    `[리서처 결과]\n${researchLog.output}\n\n[분석가 결과]\n${analysisLog.output}`
  );
  logs.push(criticLog);
  
  criticLog.toolCalls?.forEach(tc => {
    if (!mcpToolsUsed.includes(tc.toolName)) {
      mcpToolsUsed.push(tc.toolName);
    }
  });
  
  onAgentUpdate?.(criticLog);
  
  // ===== Step 4: Synthesizer Agent =====
  // 역할: 모든 에이전트의 결과를 종합하여 최종 보고서 작성
  console.log("✨ [Step 4] Synthesizer Agent 실행 중...");
  const synthLog = await runAgent(
    "synthesizer",
    `쿼리: "${query}"\n\n위의 모든 에이전트 작업을 종합하여 최종 보고서를 작성하세요.`,
    apiKey,
    `[리서치]\n${researchLog.output}\n\n[분석]\n${analysisLog.output}\n\n[검증/비평]\n${criticLog.output}`
  );
  logs.push(synthLog);
  
  onAgentUpdate?.(synthLog);
  
  const totalDuration = Date.now() - startTime;
  
  console.log("\n========== AI Harness 완료 ==========");
  console.log(`총 소요 시간: ${totalDuration}ms`);
  console.log(`사용된 MCP 도구: ${mcpToolsUsed.join(", ")}`);
  console.log("=====================================\n");
  
  return {
    query,
    logs,
    finalReport: synthLog.output || "보고서 생성 실패",
    totalDuration,
    mcpToolsUsed,
    agentsExecuted: logs.length
  };
}
