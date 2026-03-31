/**
 * 개발 하네스 에이전트 v6
 *
 * 4가지 개발 팀 역할:
 *
 *  🎯 PM (프로젝트 매니저)
 *     - 요구사항 분석 및 기술 명세서 작성
 *     - 파일 구조, 함수 시그니처, 테스트 케이스 정의
 *     - 도구: list_files (현황 파악)
 *
 *  💻 Developer (개발자)
 *     - PM 명세서 기반으로 실제 코드 작성
 *     - write_code로 파일 저장 후 execute_code로 즉시 검증
 *     - 실행 오류 시 스스로 수정 시도 (최대 3회)
 *
 *  🔍 Reviewer (코드 리뷰어)
 *     - 작성된 코드 읽고 품질 평가
 *     - 가독성, 에러 처리, 성능, 보안 관점에서 검토
 *     - 점수(0~100) + 구체적 개선 사항 제시
 *
 *  🧪 QA Tester (품질 보증)
 *     - 테스트 코드 작성 및 실행
 *     - 엣지 케이스, 경계값, 예외 상황 테스트
 *     - 최종 합격/불합격 판정
 */

import { DEV_MCP_TOOLS, executeDevTool, convertDevToolsToOpenAI } from "../mcp/dev-tools.js";
import type { AgentLog } from "./types.js";

export type DevAgentRole = "pm" | "developer" | "reviewer" | "qa_tester";

export interface DevAgentLog extends AgentLog {
  devRole: DevAgentRole;
  filesCreated?: string[];   // 생성/수정된 파일 목록
  executionResults?: {       // 실행 결과 기록
    filename: string;
    success: boolean;
    output: string;
    attempt: number;
  }[];
  qualityScore?: number;     // Reviewer/QA 점수
}

// 개발 팀 에이전트 설정
const DEV_AGENT_CONFIGS: Record<DevAgentRole, {
  name: string;
  emoji: string;
  systemPrompt: string;
  allowedTools: string[];
  maxIterations: number;
}> = {
  pm: {
    name: "PM 에이전트",
    emoji: "🎯",
    systemPrompt: `당신은 숙련된 프로젝트 매니저 겸 시니어 소프트웨어 아키텍트입니다.

역할:
1. 요구사항을 분석하여 명확한 기술 명세서를 작성합니다
2. 구현할 파일 구조와 함수 시그니처를 정의합니다
3. 테스트 케이스 목록을 구체적으로 정의합니다
4. 개발자가 바로 구현할 수 있도록 상세한 지침을 제공합니다

출력 형식:
## 기술 명세서
### 파일 구조
### 핵심 함수 명세 (입력/출력 타입 포함)
### 테스트 케이스 목록 (구체적 입력/기대 출력)
### 구현 주의사항

반드시 한국어로 응답하세요.`,
    allowedTools: ["list_files"],
    maxIterations: 3
  },

  developer: {
    name: "개발자 에이전트",
    emoji: "💻",
    systemPrompt: `당신은 숙련된 Node.js/JavaScript 개발자입니다.

역할:
1. PM 명세서를 보고 실제로 동작하는 코드를 작성합니다
2. write_code 도구로 파일을 저장합니다
3. execute_code 도구로 즉시 실행하여 동작을 확인합니다
4. 에러가 발생하면 원인을 분석하고 코드를 수정합니다 (최대 3회 시도)

중요 규칙:
- 코드는 순수 JavaScript (.js 파일)로 작성하세요 (TypeScript 불가)
- 외부 라이브러리 설치 없이 Node.js 내장 모듈만 사용하세요
- 코드 마지막에 간단한 실행 예시를 포함하세요 (console.log로 결과 출력)
- execute_code로 실행해서 실제 출력을 확인하세요

반드시 한국어로 응답하세요.`,
    allowedTools: ["write_code", "read_code", "execute_code", "list_files"],
    maxIterations: 8  // 에러 수정 반복 허용
  },

  reviewer: {
    name: "코드 리뷰어 에이전트",
    emoji: "🔍",
    systemPrompt: `당신은 엄격한 시니어 코드 리뷰어입니다.

역할:
1. read_code로 작성된 코드를 읽습니다
2. 코드 품질을 다각도로 평가합니다
3. 구체적인 개선 사항을 제시합니다

평가 기준 (각 항목 25점):
- 정확성: 요구사항을 올바르게 구현했는가?
- 가독성: 코드가 읽기 쉽고 주석이 충분한가?
- 에러 처리: 예외 상황을 적절히 처리하는가?
- 효율성: 불필요한 연산이나 중복 코드가 없는가?

반드시 JSON으로 점수를 포함한 리뷰를 작성하세요:
{
  "score": 0~100,
  "verdict": "approved" 또는 "needs_revision",
  "strengths": ["강점1", "강점2"],
  "issues": ["문제점1", "문제점2"],
  "suggestions": ["개선제안1", "개선제안2"]
}

반드시 한국어로 응답하세요.`,
    allowedTools: ["read_code", "list_files"],
    maxIterations: 3
  },

  qa_tester: {
    name: "QA 테스터 에이전트",
    emoji: "🧪",
    systemPrompt: `당신은 꼼꼼한 QA 엔지니어입니다.

역할:
1. 기능 요구사항을 기반으로 테스트 코드를 작성합니다
2. 엣지 케이스와 경계값을 포함한 테스트를 설계합니다
3. run_tests 또는 execute_code로 테스트를 실행합니다
4. 최종 합격/불합격 판정을 내립니다

테스트 코드 작성 규칙:
- 순수 JavaScript로 작성 (*.test.js 파일명 사용)
- Node.js 내장 assert 모듈 사용
- 각 테스트에 console.log로 결과 출력
- 마지막에 통과/실패 요약 출력

예시:
const assert = require('assert');
const { myFunction } = require('./solution.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('✅ PASS:', name); passed++; }
  catch(e) { console.log('❌ FAIL:', name, '-', e.message); failed++; }
}

test('기본 케이스', () => assert.strictEqual(myFunction(1, 2), 3));
test('경계값 테스트', () => assert.strictEqual(myFunction(0, 0), 0));
// ... 더 많은 테스트

console.log(\`\\n📊 결과: \${passed}통과 / \${failed}실패\`);

반드시 한국어로 응답하세요.`,
    allowedTools: ["write_code", "read_code", "execute_code", "run_tests", "list_files"],
    maxIterations: 6
  }
};

// OpenAI API fetch 호출
async function callOpenAI(
  apiKey: string,
  body: Record<string, unknown>
): Promise<any> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errJson = JSON.parse(text);
      errMsg = errJson.error?.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }
  return JSON.parse(text);
}

/**
 * 개발 하네스 에이전트 실행
 *
 * @param role       - 에이전트 역할 (pm/developer/reviewer/qa_tester)
 * @param task       - 이 에이전트에게 줄 구체적 작업 지시
 * @param apiKey     - OpenAI API 키
 * @param sessionId  - 파일 공유를 위한 세션 ID
 * @param context    - 이전 에이전트들의 작업 결과 (컨텍스트)
 */
export async function runDevAgent(
  role: DevAgentRole,
  task: string,
  apiKey: string,
  sessionId: string,
  context: string = ""
): Promise<DevAgentLog> {

  const config = DEV_AGENT_CONFIGS[role];
  const startTime = Date.now();

  const devLog: DevAgentLog = {
    agentId: `dev-${role}-${Date.now()}`,
    agentRole: role as any,   // 기존 AgentRole과 호환
    devRole: role,
    agentName: `${config.emoji} ${config.name}`,
    status: "running",
    message: `${config.name} 시작...`,
    toolCalls: [],
    output: "",
    timestamp: new Date().toISOString(),
    filesCreated: [],
    executionResults: []
  };

  try {
    // 허용된 도구만 필터링 (session_id 자동 주입을 위해 래핑)
    const allowedDevTools = DEV_MCP_TOOLS.filter(
      t => config.allowedTools.includes(t.name)
    );
    const openAITools = convertDevToolsToOpenAI(allowedDevTools);

    // 시스템 + 사용자 메시지 구성
    const sessionInfo = `[현재 세션 ID: ${sessionId}]\n모든 도구 호출 시 session_id: "${sessionId}"를 반드시 포함하세요.\n\n`;

    const messages: any[] = [
      { role: "system", content: config.systemPrompt },
      {
        role: "user",
        content: context
          ? `${sessionInfo}[이전 팀원들의 작업 결과]\n${context}\n\n[현재 작업 지시]\n${task}`
          : `${sessionInfo}[작업 지시]\n${task}`
      }
    ];

    // Tool Calling 루프
    let iteration = 0;
    while (iteration < config.maxIterations) {
      iteration++;
      devLog.status = "running";

      const response = await callOpenAI(apiKey, {
        model: "gpt-4o-mini",
        messages,
        ...(openAITools.length > 0 ? { tools: openAITools, tool_choice: "auto" } : {}),
        max_tokens: 3000,
        temperature: role === "developer" ? 0.3 : 0.5  // 개발자는 일관성 중시
      });

      const choice = response.choices[0];

      // Tool 호출 처리
      if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
        devLog.status = "tool_calling";
        messages.push(choice.message);

        for (const toolCall of choice.message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          // session_id 자동 주입 (AI가 빠뜨린 경우 대비)
          if (!toolArgs.session_id) {
            toolArgs.session_id = sessionId;
          }

          console.log(`[${config.name}] DevTool 호출: ${toolName}`);
          const toolResult = await executeDevTool(toolName, toolArgs);

          // 파일 생성 추적
          if (toolName === "write_code" && toolResult.success) {
            devLog.filesCreated!.push(toolArgs.filename as string);
          }

          // 실행 결과 추적
          if (toolName === "execute_code" || toolName === "run_tests") {
            devLog.executionResults!.push({
              filename: (toolArgs.filename || toolArgs.test_filename) as string,
              success: toolResult.success,
              output: toolResult.content,
              attempt: devLog.executionResults!.length + 1
            });
          }

          devLog.toolCalls!.push({
            toolName,
            args: { ...toolArgs, code: toolArgs.code ? "(코드 생략)" : undefined },
            result: toolResult.content
          });

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult.content
          });
        }
        continue;
      }

      // 최종 응답
      if (choice.message?.content) {
        devLog.output = choice.message.content;
        devLog.status = "completed";
        devLog.message = `${config.name} 완료`;
        devLog.duration = Date.now() - startTime;

        // Reviewer/QA 점수 파싱
        if (role === "reviewer" || role === "qa_tester") {
          try {
            const jsonMatch = (devLog.output || "").match(/\{[\s\S]*?"score"\s*:\s*(\d+)[\s\S]*?\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              devLog.qualityScore = parsed.score;
            }
          } catch {}
        }

        return devLog;
      }

      break;
    }

    devLog.output = "응답 생성 실패 (최대 반복 도달)";
    devLog.status = "completed";
    devLog.duration = Date.now() - startTime;

  } catch (error: any) {
    devLog.status = "error";
    devLog.message = `에러: ${error.message}`;
    devLog.output = error.message;
    devLog.duration = Date.now() - startTime;
    console.error(`[${config.name}] 에러:`, error.message);
  }

  return devLog;
}
