/**
 * AI Agent 타입 정의
 * 
 * AgentRole: 각 에이전트의 역할
 * AgentStatus: 에이전트 실행 상태
 * AgentLog: 에이전트 실행 로그 (UI에서 실시간으로 표시)
 * HarnessResult: 전체 하네스 실행 결과
 */

export type AgentRole = "researcher" | "analyst" | "critic" | "synthesizer";

export type AgentStatus = "idle" | "running" | "tool_calling" | "completed" | "error";

export interface AgentLog {
  agentId: string;
  agentRole: AgentRole;
  agentName: string;
  status: AgentStatus;
  message: string;
  toolCalls?: {
    toolName: string;
    args: Record<string, unknown>;
    result: string;
  }[];
  output?: string;
  timestamp: string;
  duration?: number;
}

export interface HarnessResult {
  query: string;
  logs: AgentLog[];
  finalReport: string;
  totalDuration: number;
  mcpToolsUsed: string[];
  agentsExecuted: number;
}
