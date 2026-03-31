/**
 * AI Agent 타입 정의 (v2 - 피드백 루프 지원)
 */

export type AgentRole = "researcher" | "analyst" | "critic" | "synthesizer";
export type AgentStatus = "idle" | "running" | "tool_calling" | "completed" | "error";

// 비평가의 판정 결과
export type CriticVerdict = "approved" | "rejected";

// 비평가 판정 상세
export interface CriticJudgement {
  verdict: CriticVerdict;        // 승인 or 반려
  reason: string;                // 판정 이유
  issues: string[];              // 발견된 문제점 목록
  suggestions: string[];         // 개선 제안 목록
  score: number;                 // 품질 점수 (0~100)
}

// 단일 반려/재시도 이벤트 기록
export interface RetryEvent {
  attempt: number;               // 몇 번째 시도인지
  rejectedAt: string;            // 반려 시각
  judgement: CriticJudgement;    // 비평가 판정 내용
  researcherOutput: string;      // 반려된 리서처 결과
  criticOutput: string;          // 비평가 피드백 내용
}

export interface AgentLog {
  agentId: string;
  agentRole: AgentRole;
  agentName: string;
  status: AgentStatus;
  message: string;
  attempt?: number;              // 몇 번째 시도인지 (재시도 시 증가)
  toolCalls?: {
    toolName: string;
    args: Record<string, unknown>;
    result: string;
  }[];
  output?: string;
  timestamp: string;
  duration?: number;
}

// 반려/재시도 전체 리포트
export interface RetryReport {
  totalAttempts: number;         // 총 시도 횟수
  totalRejections: number;       // 총 반려 횟수
  finalVerdict: CriticVerdict;   // 최종 판정
  retryEvents: RetryEvent[];     // 각 반려 이벤트 상세
  improvementSummary: string;    // 반려→승인 과정 요약
  qualityProgression: number[];  // 시도별 품질 점수 추이
}

export interface HarnessResult {
  query: string;
  logs: AgentLog[];
  finalReport: string;
  retryReport: RetryReport;      // 반려/재시도 리포트
  totalDuration: number;
  mcpToolsUsed: string[];
  agentsExecuted: number;
}
