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

import { MCP_TOOLS, convertToOpenAITools, executeMCPTool } from "../mcp/tools.js";
import type { AgentLog, AgentRole, CriticJudgement } from "./types.js";

// OpenAI API를 SDK 없이 직접 fetch로 호출
// SDK의 no body 버그 우회
async function callOpenAI(
  apiKey: string,
  projectId: string,
  body: Record<string, unknown>
): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  };
  if (projectId) headers["OpenAI-Project"] = projectId;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      if (text && text.length > 0) {
        const errJson = JSON.parse(text);
        errMsg = errJson.error?.message || errMsg;
      } else {
        errMsg = `HTTP ${res.status} (응답 없음) - API Key를 확인하세요`;
      }
    } catch {
      errMsg = text ? `HTTP ${res.status}: ${text.slice(0, 200)}` : `HTTP ${res.status} (빈 응답)`;
    }
    throw new Error(errMsg);
  }
  return JSON.parse(text);
}

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
  previousContext: string = "",
  projectId: string = ""
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
    // MCP Tools 중 이 에이전트가 사용할 수 있는 것만 필터링
    const availableTools = MCP_TOOLS.filter(
      tool => config.allowedTools.includes(tool.name)
    );
    const openAITools = convertToOpenAITools(availableTools);

    // 메시지 구성
    const messages: any[] = [
      { role: "system", content: config.systemPrompt },
      {
        role: "user",
        content: previousContext
          ? `[이전 에이전트 작업 결과]\n${previousContext}\n\n[현재 작업]\n${userMessage}`
          : userMessage
      }
    ];

    // ===== 핵심: Tool Calling 루프 =====
    let iteration = 0;
    const maxIterations = 3;

    while (iteration < maxIterations) {
      iteration++;
      log.status = "running";

      // SDK 대신 fetch 직접 호출 (no body 버그 우회)
      const response = await callOpenAI(apiKey, projectId, {
        model: "gpt-4o-mini",
        messages,
        ...(openAITools.length > 0 ? { tools: openAITools, tool_choice: "auto" } : {}),
        max_tokens: 2000,
        temperature: 0.7
      });

      const choice = response.choices[0];

      // 케이스 1: AI가 도구 호출을 결정한 경우
      if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
        log.status = "tool_calling";
        messages.push(choice.message);

        for (const toolCall of choice.message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          console.log(`[${config.name}] MCP Tool 호출: ${toolName}`, toolArgs);
          const toolResult = await executeMCPTool(toolName, toolArgs);

          log.toolCalls!.push({ toolName, args: toolArgs, result: toolResult.content });
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult.content
          });
        }
        continue;
      }

      // 케이스 2: 최종 응답 (stop 또는 length 둘 다 처리)
      if (choice.message?.content) {
        log.output = choice.message.content;
        log.status = "completed";
        log.message = `${config.name} 완료`;
        log.duration = Date.now() - startTime;
        return log;
      }

      break;
    }

    log.output = "응답 생성 실패";
    log.status = "completed";
    log.duration = Date.now() - startTime;
    
  } catch (error) {
    const apiError = error as any;
    // 에러 전체 내용 로그
    console.error(`[${config.name}] ❌ 에러 발생:`);
    console.error("  HTTP 상태:", apiError.status);
    console.error("  메시지:", apiError.error?.message || apiError.message);
    console.error("  코드:", apiError.error?.code);
    console.error("  타입:", apiError.error?.type);
    console.error("  전체:", JSON.stringify(apiError.error || apiError.message));

    // UI에 보여줄 에러 메시지 조합
    const errDetail = apiError.error?.message || apiError.message || "알 수 없는 오류";
    const errCode = apiError.error?.code ? ` (${apiError.error.code})` : "";
    const errStatus = apiError.status ? `[HTTP ${apiError.status}] ` : "";

    log.status = "error";
    log.message = `에러: ${errStatus}${errDetail}${errCode}`;
    log.output = `${errStatus}${errDetail}${errCode}`;
    log.duration = Date.now() - startTime;
  }
  
  return log;
}

/**
 * 비평가 판정 전용 함수
 * 
 * 일반 runAgent와 다른 점:
 * - 반드시 JSON 형식으로 "승인/반려 판정"을 반환
 * - 반려 시 구체적인 이유, 문제점, 개선 제안 포함
 * - 품질 점수(0~100) 반환
 * 
 * 이 판정 결과를 오케스트레이터가 보고
 * "재시도 vs 다음 단계 진행" 결정
 */
export async function runCriticJudgement(
  researchOutput: string,
  analysisOutput: string,
  query: string,
  apiKey: string,
  projectId: string = "",
  attempt: number = 1,
  targetScore: number = 80   // 합격 기준 점수 (오케스트레이터에서 전달)
): Promise<{ log: AgentLog; judgement: CriticJudgement }> {

  const startTime = Date.now();
  const log: AgentLog = {
    agentId: `critic-judge-${Date.now()}`,
    agentRole: "critic",
    agentName: "⚖️ 비평가 에이전트",
    status: "running",
    message: `품질 판정 중... (${attempt}차 시도)`,
    toolCalls: [],
    attempt,
    output: "",
    timestamp: new Date().toISOString()
  };

  // 기본 판정 (에러 시 fallback)
  const fallbackJudgement: CriticJudgement = {
    verdict: "approved",
    reason: "판정 오류로 기본 승인 처리",
    issues: [],
    suggestions: [],
    score: 60
  };

  try {
    // fact_check 도구로 주요 주장 검증
    const factCheckTool = MCP_TOOLS.filter(t => t.name === "fact_check");
    const openAITools = convertToOpenAITools(factCheckTool);

    const systemPrompt = `당신은 엄격한 품질 관리 비평가입니다.
리서치 결과와 분석 내용을 검토하고 반드시 아래 JSON 형식으로만 응답하세요.

판정 기준 (사용자가 설정한 목표 점수):
- 점수 ${targetScore}점 이상: 승인 (approved)
- 점수 ${targetScore - 1}점 이하: 반려 (rejected)

엄격하게 평가하세요. 첫 시도는 특히 까다롭게 검토하세요.

반드시 이 JSON 형식으로만 응답 (다른 텍스트 금지):
{
  "verdict": "approved" 또는 "rejected",
  "score": 0~100 사이 숫자,
  "reason": "판정 이유 한 문장",
  "issues": ["문제점1", "문제점2"],
  "suggestions": ["개선제안1", "개선제안2"]
}`;

    const userMessage = `[쿼리] ${query}

[${attempt}차 리서치 결과]
${researchOutput}

[분석 결과]
${analysisOutput}

위 내용을 엄격히 평가하여 JSON으로 판정하세요.
${attempt > 1 ? `(이전에 ${attempt-1}번 반려된 내용입니다. 개선되었는지 확인하세요.)` : "(첫 번째 시도입니다. 엄격하게 평가하세요.)"}`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ];

    // fact_check 도구 먼저 호출하게 유도
    let iteration = 0;
    while (iteration < 3) {
      iteration++;

      const response = await callOpenAI(apiKey, projectId, {
        model: "gpt-4o-mini",
        messages,
        ...(openAITools.length > 0 ? { tools: openAITools, tool_choice: "auto" } : {}),
        max_tokens: 1000,
        temperature: 0.3  // 판정은 일관성 있게 낮은 temperature
      });

      const choice = response.choices[0];

      // Tool 호출 처리
      if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
        log.status = "tool_calling";
        messages.push(choice.message);

        for (const toolCall of choice.message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          const toolResult = await executeMCPTool(toolName, toolArgs);

          log.toolCalls!.push({ toolName, args: toolArgs, result: toolResult.content });
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult.content
          });
        }
        continue;
      }

      // 최종 응답 파싱
      if (choice.message?.content) {
        const rawOutput = choice.message.content;
        log.output = rawOutput;

        try {
          // JSON 추출 (```json ... ``` 감싸진 경우도 처리)
          const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const judgement: CriticJudgement = {
              verdict: parsed.verdict === "approved" ? "approved" : "rejected",
              reason: parsed.reason || "판정 이유 없음",
              issues: Array.isArray(parsed.issues) ? parsed.issues : [],
              suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
              score: typeof parsed.score === "number" ? parsed.score : 50
            };

            log.status = "completed";
            log.message = judgement.verdict === "approved"
              ? `✅ ${attempt}차 승인 (${judgement.score}점)`
              : `❌ ${attempt}차 반려 (${judgement.score}점)`;
            log.duration = Date.now() - startTime;

            console.log(`[비평가] ${attempt}차 판정: ${judgement.verdict} (${judgement.score}점)`);
            console.log(`[비평가] 이유: ${judgement.reason}`);
            if (judgement.issues.length > 0) {
              console.log(`[비평가] 문제점:`, judgement.issues);
            }

            return { log, judgement };
          }
        } catch (parseErr) {
          console.error("[비평가] JSON 파싱 실패:", parseErr);
        }

        break;
      }
      break;
    }

  } catch (error) {
    const apiError = error as any;
    console.error("[비평가 판정] 에러:", apiError.message);
    log.status = "error";
    log.message = `판정 에러: ${apiError.message}`;
    log.duration = Date.now() - startTime;
  }

  return { log, judgement: fallbackJudgement };
}

