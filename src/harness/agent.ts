/**
 * AI Agent 구현
 * 
 * 각 Agent는 독립적인 AI 인스턴스입니다.
 * 
 * 핵심 원리:
 * 1. 각 Agent는 고유한 "역할(Role)"과 "시스템 프롬프트"를 가집니다
 * 2. Agent는 MCP Tools를 사용하여 외부 정보를 수집합니다
 * 3. Agent의 출력이 다음 Agent의 입력이 됩니다 (Pipeline 패턴)
 * 
 * 이 파일의 핵심 흐름:
 * 
 *   runAgent() 호출
 *       ↓
 *   OpenAI API에 메시지 + MCP Tools 목록 전송
 *       ↓
 *   AI가 Tool 호출 결정? → executeMCPTool() 실행 → 결과를 메시지에 추가
 *       ↓ (반복: AI가 "충분하다"고 판단할 때까지)
 *   최종 텍스트 응답 반환
 */

import OpenAI from "openai";
import { MCP_TOOLS, convertToOpenAITools, executeMCPTool } from "../mcp/tools.js";
import type { AgentLog, AgentRole } from "./types.js";

// Agent 설정 정의
// 각 Agent는 자신만의 역할과 성격을 가집니다
const AGENT_CONFIGS: Record<AgentRole, {
  name: string;
  emoji: string;
  systemPrompt: string;
  allowedTools: string[];
}> = {
  researcher: {
    name: "리서처 에이전트",
    emoji: "🔍",
    systemPrompt: `당신은 전문 리서처입니다. 
주어진 주제에 대해 web_search 도구를 적극적으로 활용하여 관련 정보를 수집하세요.
수집한 정보를 명확하고 구조적으로 정리해주세요.
반드시 한국어로 응답하세요.`,
    allowedTools: ["web_search"]
  },
  analyst: {
    name: "분석가 에이전트",
    emoji: "📊",
    systemPrompt: `당신은 데이터 분석 전문가입니다.
이전 리서처가 수집한 정보를 analyze_text 도구로 분석하고,
핵심 인사이트와 패턴을 추출하세요.
데이터 기반의 객관적인 분석을 제공하세요.
반드시 한국어로 응답하세요.`,
    allowedTools: ["analyze_text"]
  },
  critic: {
    name: "비평가 에이전트",
    emoji: "⚖️",
    systemPrompt: `당신은 비판적 사고 전문가입니다.
이전 분석 내용에 대해 fact_check 도구를 사용하여 주요 주장들을 검증하세요.
논리적 허점이나 개선점을 지적하고, 균형잡힌 시각을 제공하세요.
반드시 한국어로 응답하세요.`,
    allowedTools: ["fact_check"]
  },
  synthesizer: {
    name: "종합 에이전트",
    emoji: "✨",
    systemPrompt: `당신은 최종 보고서 작성 전문가입니다.
이전 모든 에이전트들의 작업(리서치, 분석, 검증)을 종합하여
명확하고 실용적인 최종 보고서를 작성하세요.
보고서 형식: 요약 → 주요 발견사항 → 인사이트 → 결론
반드시 한국어로 응답하세요.`,
    allowedTools: [] // 도구 없이 종합만 수행
  }
};

/**
 * 단일 Agent 실행 함수
 * 
 * @param role - 에이전트 역할
 * @param userMessage - 이 에이전트에게 전달할 메시지
 * @param apiKey - OpenAI API 키
 * @param previousContext - 이전 에이전트들의 출력 (컨텍스트)
 */
export async function runAgent(
  role: AgentRole,
  userMessage: string,
  apiKey: string,
  previousContext: string = ""
): Promise<AgentLog> {
  
  const config = AGENT_CONFIGS[role];
  const startTime = Date.now();
  
  const log: AgentLog = {
    agentId: `${role}-${Date.now()}`,
    agentRole: role,
    agentName: `${config.emoji} ${config.name}`,
    status: "running",
    message: `${config.name} 시작...`,
    toolCalls: [],
    output: "",
    timestamp: new Date().toISOString()
  };

  try {
    const openai = new OpenAI({ apiKey });
    
    // MCP Tools 중 이 에이전트가 사용할 수 있는 것만 필터링
    // 각 에이전트는 자신의 역할에 맞는 도구만 사용 가능
    const availableTools = MCP_TOOLS.filter(
      tool => config.allowedTools.includes(tool.name)
    );
    
    // OpenAI 형식으로 변환
    const openAITools = convertToOpenAITools(availableTools);
    
    // 메시지 구성
    // - system: 에이전트의 역할/성격 정의
    // - user: 처리할 작업 (이전 컨텍스트 포함)
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: config.systemPrompt },
      {
        role: "user",
        content: previousContext 
          ? `[이전 에이전트 작업 결과]\n${previousContext}\n\n[현재 작업]\n${userMessage}`
          : userMessage
      }
    ];

    // ===== 핵심: Tool Calling 루프 =====
    // AI가 "더 이상 도구가 필요없다"고 판단할 때까지 반복
    let iteration = 0;
    const maxIterations = 3; // 무한 루프 방지
    
    while (iteration < maxIterations) {
      iteration++;
      log.status = "running";
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",  // 비용 효율적인 모델 사용
        messages,
        tools: openAITools.length > 0 ? openAITools : undefined,
        tool_choice: openAITools.length > 0 ? "auto" : undefined, // AI가 자율적으로 도구 사용 결정
        max_tokens: 1000,
        temperature: 0.7
      });

      const choice = response.choices[0];
      
      // 케이스 1: AI가 도구 호출을 결정한 경우
      if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
        log.status = "tool_calling";
        
        // 어시스턴트 메시지를 컨텍스트에 추가
        messages.push(choice.message);
        
        // 각 Tool 호출 처리
        for (const toolCall of choice.message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          
          console.log(`[${config.name}] MCP Tool 호출: ${toolName}`, toolArgs);
          
          // MCP Tool 실제 실행
          const toolResult = await executeMCPTool(toolName, toolArgs);
          
          // 로그에 tool call 기록
          log.toolCalls!.push({
            toolName,
            args: toolArgs,
            result: toolResult.content
          });
          
          // Tool 결과를 메시지 히스토리에 추가
          // AI는 이 결과를 보고 다음 행동을 결정합니다
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult.content
          });
        }
        // 루프 계속 - AI가 결과를 보고 추가 도구 호출 또는 최종 응답 결정
        continue;
      }
      
      // 케이스 2: AI가 최종 텍스트 응답을 생성한 경우
      if (choice.finish_reason === "stop" && choice.message.content) {
        log.output = choice.message.content;
        log.status = "completed";
        log.message = `${config.name} 완료`;
        log.duration = Date.now() - startTime;
        return log;
      }
      
      break;
    }
    
    // 최대 반복 도달시 처리
    log.output = messages[messages.length - 1].content as string || "응답 생성 실패";
    log.status = "completed";
    log.duration = Date.now() - startTime;
    
  } catch (error) {
    log.status = "error";
    log.message = `에러: ${error instanceof Error ? error.message : "알 수 없는 오류"}`;
    log.duration = Date.now() - startTime;
  }
  
  return log;
}
