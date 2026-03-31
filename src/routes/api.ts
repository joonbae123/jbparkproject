/**
 * API 라우트 정의
 *
 * POST /api/harness - 하네스 실행 (SSE 스트리밍)
 * GET  /api/tools   - 사용 가능한 MCP 도구 목록 조회
 * GET  /api/health  - 서버 상태 확인
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { runHarness } from "../harness/orchestrator.js";
import { MCP_TOOLS } from "../mcp/tools.js";

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
    version: "v5-dynamic",
    mcpTools: MCP_TOOLS.map(t => ({ name: t.name, description: t.description })),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/tools
 */
api.get("/tools", (c) => {
  return c.json({ tools: MCP_TOOLS, count: MCP_TOOLS.length });
});

/**
 * POST /api/harness
 *
 * SSE 이벤트 목록 (v5):
 *   start        - 하네스 시작
 *   strategy     - Claude의 전체 전략 (초기 1회)
 *   decision     - Claude가 다음 에이전트 결정할 때마다
 *   agent_complete - 에이전트 완료
 *   retry_event  - Critic 반려 시
 *   complete     - 전체 완료
 *   error        - 오류 발생
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

    const safeMaxRetry   = Math.max(0, Math.min(10, Number(maxRetry) || 3));
    const safeTargetScore = Math.max(0, Math.min(100, Number(targetScore) || 80));

    return new Response(
      new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();

          const sendEvent = (event: string, data: unknown) => {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          };

          try {
            sendEvent("start", {
              message: "AI Harness v5 동적 워크플로우 시작",
              timestamp: new Date().toISOString()
            });

            const result = await runHarness(
              query,
              apiKey,
              (agentLog, retryEvent) => {
                if (retryEvent) sendEvent("retry_event", retryEvent);
                sendEvent("agent_complete", agentLog);
              },
              {
                projectId,
                maxRetry: safeMaxRetry,
                targetScore: safeTargetScore,
                anthropicKey
              },
              (decisionEvent) => {
                if (decisionEvent.type === "strategy") {
                  sendEvent("strategy", decisionEvent);
                } else {
                  sendEvent("decision", decisionEvent);
                }
              }
            );

            sendEvent("complete", result);

          } catch (error) {
            sendEvent("error", {
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
      error: "요청 처리 실패",
      detail: error instanceof Error ? error.message : "알 수 없는 오류"
    }, 500);
  }
});

export default api;
