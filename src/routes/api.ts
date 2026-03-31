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

// CORS 설정 - 프론트엔드에서 API 호출 허용
api.use("*", cors());

/**
 * GET /api/health
 * 서버 헬스체크 및 MCP 도구 정보 반환
 */
api.get("/health", (c) => {
  return c.json({
    status: "ok",
    message: "AI Harness + MCP Demo Server",
    mcpTools: MCP_TOOLS.map(t => ({
      name: t.name,
      description: t.description
    })),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/tools
 * 등록된 MCP 도구 전체 목록 반환
 */
api.get("/tools", (c) => {
  return c.json({
    tools: MCP_TOOLS,
    count: MCP_TOOLS.length
  });
});

/**
 * POST /api/harness
 * 
 * AI Harness 실행 - SSE(Server-Sent Events)로 실시간 스트리밍
 * 
 * 왜 SSE를 사용하나?
 * - 에이전트 4개가 순서대로 실행되는데 시간이 걸림
 * - 각 에이전트 완료시마다 즉시 UI에 업데이트
 * - 사용자가 진행 상황을 실시간으로 볼 수 있음
 * 
 * Request body: { query: string, apiKey: string, projectId?: string }
 */
api.post("/harness", async (c) => {
  try {
    const body = await c.req.json();
    const { query, apiKey, projectId = "" } = body;
    
    if (!query || !apiKey) {
      return c.json({ error: "query와 apiKey가 필요합니다" }, 400);
    }
    
    // SSE 스트림 반환
    // 각 에이전트 완료시마다 이벤트를 전송합니다
    return new Response(
      new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          
          // SSE 이벤트 전송 헬퍼 함수
          const sendEvent = (event: string, data: unknown) => {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          };
          
          try {
            // 시작 이벤트
            sendEvent("start", { 
              message: "Harness 파이프라인 시작",
              timestamp: new Date().toISOString()
            });
            
            // Harness 실행 - 각 에이전트 완료시 콜백으로 이벤트 전송
            const result = await runHarness(
              query,
              apiKey,
              (agentLog, retryEvent) => {
                if (retryEvent) {
                  // 반려 이벤트 별도 전송
                  sendEvent("retry_event", retryEvent);
                }
                sendEvent("agent_complete", agentLog);
              },
              projectId
            );
            
            // 최종 완료 이벤트
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
