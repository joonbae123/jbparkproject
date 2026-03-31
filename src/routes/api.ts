/**
 * API 라우트 정의
 *
 * POST /api/harness      - 리서치 하네스 실행 (SSE 스트리밍, v5)
 * POST /api/dev-harness  - 개발 하네스 실행 (SSE 스트리밍, v6)
 * GET  /api/tools        - 사용 가능한 MCP 도구 목록 조회
 * GET  /api/health       - 서버 상태 확인
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { runHarness } from "../harness/orchestrator.js";
import { MCP_TOOLS } from "../mcp/tools.js";
import { DEV_MCP_TOOLS } from "../mcp/dev-tools.js";
import { runDevAgent } from "../harness/dev-agent.js";
import { decideDevFirstStep, decideDevNextStep } from "../harness/dev-orchestrator.js";
import type { DevCompletedStep } from "../harness/dev-orchestrator.js";

const api = new Hono();

// CORS 설정
api.use("*", cors());

/**
 * GET /api/health
 */
api.get("/health", (c) => {
  return c.json({
    status: "ok",
    message: "AI Harness + MCP Demo Server",
    version: "v6-dev-harness",
    mcpTools: MCP_TOOLS.map(t => ({ name: t.name, description: t.description })),
    devTools: DEV_MCP_TOOLS.map(t => ({ name: t.name, description: t.description })),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/tools
 */
api.get("/tools", (c) => {
  return c.json({
    researchTools: MCP_TOOLS,
    devTools: DEV_MCP_TOOLS,
    count: MCP_TOOLS.length + DEV_MCP_TOOLS.length
  });
});

/**
 * POST /api/harness - 기존 리서치 하네스 (v5 유지)
 */
api.post("/harness", async (c) => {
  try {
    const body = await c.req.json();
    const {
      query,
      apiKey,
      anthropicKey = "",
      projectId = "",
      maxRetry = 3,
      targetScore = 80
    } = body;

    if (!query || !apiKey) {
      return c.json({ error: "query와 apiKey가 필요합니다" }, 400);
    }

    const safeMaxRetry    = Math.max(0, Math.min(10, Number(maxRetry) || 3));
    const safeTargetScore = Math.max(0, Math.min(100, Number(targetScore) || 80));

    return new Response(
      new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const sendEvent = (event: string, data: unknown) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          try {
            sendEvent("start", { message: "AI Harness v5 동적 워크플로우 시작", timestamp: new Date().toISOString() });

            const result = await runHarness(
              query, apiKey,
              (agentLog, retryEvent) => {
                if (retryEvent) sendEvent("retry_event", retryEvent);
                sendEvent("agent_complete", agentLog);
              },
              { projectId, maxRetry: safeMaxRetry, targetScore: safeTargetScore, anthropicKey },
              (decisionEvent) => {
                sendEvent(decisionEvent.type === "strategy" ? "strategy" : "decision", decisionEvent);
              }
            );

            sendEvent("complete", result);
          } catch (error) {
            sendEvent("error", { message: error instanceof Error ? error.message : "알 수 없는 오류", timestamp: new Date().toISOString() });
          } finally {
            controller.close();
          }
        }
      }),
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" } }
    );
  } catch (error) {
    return c.json({ error: "요청 처리 실패", detail: error instanceof Error ? error.message : "알 수 없는 오류" }, 500);
  }
});

/**
 * POST /api/dev-harness - 개발 하네스 v6 (신규)
 *
 * SSE 이벤트:
 *   dev_start        - 하네스 시작
 *   dev_strategy     - Claude의 전체 개발 전략
 *   dev_decision     - Claude가 다음 팀원 결정
 *   dev_agent        - 팀원 작업 완료
 *   dev_complete     - 전체 완료 (최종 코드 + 결과)
 *   dev_error        - 오류 발생
 */
api.post("/dev-harness", async (c) => {
  try {
    const body = await c.req.json();
    const {
      devRequest,   // 개발 요청 (예: "배열을 정렬하는 함수를 구현해줘")
      apiKey,
      anthropicKey = ""
    } = body;

    if (!devRequest || !apiKey) {
      return c.json({ error: "devRequest와 apiKey가 필요합니다" }, 400);
    }

    // 세션 ID 생성 (파일 공유용)
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return new Response(
      new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const sendEvent = (event: string, data: unknown) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          try {
            sendEvent("dev_start", {
              message: "🚀 개발 하네스 v6 시작",
              sessionId,
              devRequest,
              timestamp: new Date().toISOString()
            });

            // ── 1. Claude: 첫 번째 팀원 결정 ──
            const initialPlan = await decideDevFirstStep(devRequest, anthropicKey);

            sendEvent("dev_strategy", {
              strategy: initialPlan.overallStrategy,
              estimatedSteps: initialPlan.estimatedSteps,
              techStack: initialPlan.techStack,
              firstRole: initialPlan.firstStep.nextRole,
              timestamp: new Date().toISOString()
            });

            // ── 2. 동적 실행 루프 ──
            const completedSteps: DevCompletedStep[] = [];
            let currentStep = initialPlan.firstStep;
            let stepCount = 0;

            while (currentStep.nextRole !== "done" && stepCount < 10) {
              stepCount++;

              // Claude 결정 이벤트 전송
              sendEvent("dev_decision", {
                stepCount,
                nextRole: currentStep.nextRole,
                instruction: currentStep.instruction,
                reasoning: currentStep.reasoning,
                priority: currentStep.priority,
                timestamp: new Date().toISOString()
              });

              // 팀원 실행 (이전 결과들을 컨텍스트로 제공)
              const contextSummary = completedSteps
                .map((s, i) => `[${i+1}. ${s.role}] ${s.output.slice(0, 500)}${s.output.length > 500 ? "...(생략)" : ""}`)
                .join("\n\n---\n\n");

              const agentLog = await runDevAgent(
                currentStep.nextRole as any,
                currentStep.instruction,
                apiKey,
                sessionId,
                contextSummary
              );

              // 실행 성공 여부 파악 (코드 실행 결과에서)
              const hasExecResult = agentLog.executionResults && agentLog.executionResults.length > 0;
              const lastExec = hasExecResult ? agentLog.executionResults![agentLog.executionResults!.length - 1] : null;

              sendEvent("dev_agent", {
                ...agentLog,
                stepCount,
                sessionId
              });

              // 완료된 스텝 기록
              completedSteps.push({
                role: currentStep.nextRole as any,
                output: agentLog.output || "",
                filesCreated: agentLog.filesCreated || [],
                executionSuccess: lastExec ? lastExec.success : undefined,
                qualityScore: agentLog.qualityScore,
                attempt: stepCount
              });

              // ── 3. Claude: 다음 팀원 결정 ──
              currentStep = await decideDevNextStep(
                devRequest,
                anthropicKey,
                completedSteps,
                stepCount
              );
            }

            // ── 4. 최종 결과 ──
            const finalFiles = completedSteps.flatMap(s => s.filesCreated);
            const uniqueFiles = [...new Set(finalFiles)];
            const lastQAScore = [...completedSteps].reverse().find(s => s.role === "qa_tester")?.qualityScore;
            const lastReviewScore = [...completedSteps].reverse().find(s => s.role === "reviewer")?.qualityScore;

            sendEvent("dev_complete", {
              sessionId,
              totalSteps: stepCount,
              filesCreated: uniqueFiles,
              completedRoles: completedSteps.map(s => s.role),
              qualityScore: lastQAScore || lastReviewScore || null,
              summary: `${stepCount}단계 완료 | 파일 ${uniqueFiles.length}개 생성`,
              timestamp: new Date().toISOString()
            });

          } catch (error) {
            sendEvent("dev_error", {
              message: error instanceof Error ? error.message : "알 수 없는 오류",
              timestamp: new Date().toISOString()
            });
          } finally {
            controller.close();
          }
        }
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no"
        }
      }
    );

  } catch (error) {
    return c.json({
      error: "개발 하네스 요청 처리 실패",
      detail: error instanceof Error ? error.message : "알 수 없는 오류"
    }, 500);
  }
});

export default api;
