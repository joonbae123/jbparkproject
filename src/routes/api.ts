/**
 * API 라우트 정의
 *
 * POST /api/harness              - 리서치 하네스 실행 (SSE, v5)
 * POST /api/dev-harness          - 개발 하네스 실행 (SSE, v6 대형 프로젝트)
 * GET  /api/download/:sessionId  - 세션 결과물 ZIP 다운로드
 * GET  /api/session/:sessionId   - 세션 파일 목록 조회
 * GET  /api/tools                - MCP 도구 목록
 * GET  /api/health               - 서버 상태
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { runHarness } from "../harness/orchestrator.js";
import { MCP_TOOLS } from "../mcp/tools.js";
import { DEV_MCP_TOOLS } from "../mcp/dev-tools.js";
import { runDevAgent } from "../harness/dev-agent.js";
import { decomposeProject } from "../harness/task-decomposer.js";
import { createZipBuffer } from "../harness/zip-builder.js";
import { getSessionPath } from "../mcp/dev-tools.js";
import * as fs from "fs";
import * as path from "path";

const api = new Hono();
api.use("*", cors());

// ─────────────────────────────────────
// GET /api/health
// ─────────────────────────────────────
api.get("/health", (c) => {
  return c.json({
    status: "ok",
    message: "AI Harness + MCP Demo Server",
    version: "v6-large-project",
    timestamp: new Date().toISOString()
  });
});

// ─────────────────────────────────────
// GET /api/tools
// ─────────────────────────────────────
api.get("/tools", (c) => {
  return c.json({
    researchTools: MCP_TOOLS,
    devTools: DEV_MCP_TOOLS,
    count: MCP_TOOLS.length + DEV_MCP_TOOLS.length
  });
});

// ─────────────────────────────────────
// GET /api/session/:sessionId  - 세션 파일 목록
// ─────────────────────────────────────
api.get("/session/:sessionId", (c) => {
  const sessionId = c.req.param("sessionId");
  const sessionPath = getSessionPath(sessionId);

  if (!fs.existsSync(sessionPath)) {
    return c.json({ files: [], sessionId });
  }

  const files = fs.readdirSync(sessionPath).map(f => {
    const fPath = path.join(sessionPath, f);
    const stat = fs.statSync(fPath);
    return {
      name: f,
      size: stat.size,
      modified: stat.mtime.toISOString()
    };
  });

  return c.json({ files, sessionId, count: files.length });
});

// ─────────────────────────────────────
// GET /api/download/:sessionId  - ZIP 다운로드
// ─────────────────────────────────────
api.get("/download/:sessionId", (c) => {
  const sessionId = c.req.param("sessionId");
  const projectName = c.req.query("name") || "ai-harness-project";

  try {
    const zipBuffer = createZipBuffer(sessionId, projectName);
    // ⚠️ Content-Disposition filename은 ASCII-only 필수 (한글/한자 불가)
    // RFC 6266: filename* 파라미터로 UTF-8 인코딩 처리
    const safeAscii = projectName.replace(/[^a-zA-Z0-9-_]/g, "_").replace(/_+/g, "_").slice(0, 40);
    const filename = `${safeAscii}-${sessionId.slice(-5)}.zip`;
    // filename* 방식으로 UTF-8 원본명도 함께 제공 (모던 브라우저 지원)
    const encodedName = encodeURIComponent(`${projectName}-${sessionId.slice(-5)}.zip`);

    return new Response(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedName}`,
        "Content-Length": String(zipBuffer.length)
      }
    });
  } catch (err) {
    console.error("[ZIP 다운로드] 오류:", err);
    return c.json({
      error: "ZIP 생성 실패",
      detail: err instanceof Error ? err.message : "알 수 없는 오류"
    }, 500);
  }
});

// ─────────────────────────────────────
// POST /api/harness  - 리서치 하네스 v5 (기존 유지)
// ─────────────────────────────────────
api.post("/harness", async (c) => {
  try {
    const body = await c.req.json();
    const { query, apiKey, anthropicKey = "", projectId = "", maxRetry = 3, targetScore = 80 } = body;

    if (!query || !apiKey) {
      return c.json({ error: "query와 apiKey가 필요합니다" }, 400);
    }

    const safeMaxRetry    = Math.max(0, Math.min(10, Number(maxRetry) || 3));
    const safeTargetScore = Math.max(0, Math.min(100, Number(targetScore) || 80));

    return new Response(
      new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder();
          const send = (ev: string, data: unknown) =>
            controller.enqueue(enc.encode(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`));

          try {
            send("start", { message: "AI Harness v5 시작", timestamp: new Date().toISOString() });
            const result = await runHarness(
              query, apiKey,
              (log, retry) => { if (retry) send("retry_event", retry); send("agent_complete", log); },
              { projectId, maxRetry: safeMaxRetry, targetScore: safeTargetScore, anthropicKey },
              (ev) => send(ev.type === "strategy" ? "strategy" : "decision", ev)
            );
            send("complete", result);
          } catch (err) {
            send("error", { message: err instanceof Error ? err.message : "오류", timestamp: new Date().toISOString() });
          } finally {
            controller.close();
          }
        }
      }),
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" } }
    );
  } catch (err) {
    return c.json({ error: "요청 처리 실패" }, 500);
  }
});

// ─────────────────────────────────────
// POST /api/dev-harness  - 개발 하네스 v6 (대형 프로젝트)
//
// SSE 이벤트:
//   dev_start        - 시작
//   dev_decompose    - TaskDecomposer 분해 결과
//   dev_task_start   - 태스크 시작
//   dev_decision     - Claude 결정
//   dev_agent        - 에이전트 완료
//   dev_task_done    - 태스크 완료 (성공/실패)
//   dev_complete     - 전체 완료 + ZIP 다운로드 URL
//   dev_error        - 오류
// ─────────────────────────────────────
api.post("/dev-harness", async (c) => {
  try {
    const body = await c.req.json();
    const { devRequest, apiKey, anthropicKey = "" } = body;

    if (!devRequest || !apiKey) {
      return c.json({ error: "devRequest와 apiKey가 필요합니다" }, 400);
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return new Response(
      new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder();
          const send = (ev: string, data: unknown) =>
            controller.enqueue(enc.encode(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`));

          try {
            send("dev_start", {
              message: "🚀 개발 하네스 v6 시작 (대형 프로젝트 모드)",
              sessionId,
              timestamp: new Date().toISOString()
            });

            // ── 1. TaskDecomposer: 요청을 태스크로 분해 ──
            send("dev_agent", {
              devRole: "decomposer",
              agentName: "🗂️ TaskDecomposer",
              status: "running",
              message: "개발 요청을 단위 태스크로 분해 중...",
              stepCount: 0,
              output: "",
              toolCalls: [],
              filesCreated: [],
              timestamp: new Date().toISOString()
            });

            const plan = await decomposeProject(devRequest, anthropicKey, apiKey);

            send("dev_decompose", {
              projectName: plan.projectName,
              totalTasks: plan.totalTasks,
              tasks: plan.tasks,
              techStack: plan.techStack,
              entryFile: plan.entryFile,
              notes: plan.notes,
              sessionId
            });

            // ── 2. 태스크별 Developer → Reviewer 루프 ──
            const allFiles: Set<string> = new Set();
            const taskResults: { taskId: number; title: string; success: boolean; files: string[] }[] = [];
            const completedContext: string[] = []; // 이전 태스크 결과 축적

            for (const task of plan.tasks) {
              send("dev_task_start", {
                taskId: task.id,
                title: task.title,
                filename: task.filename,
                totalTasks: plan.totalTasks,
                timestamp: new Date().toISOString()
              });

              // 의존 파일 컨텍스트 구성 (이전 태스크에서 생성된 파일)
              const depContext = task.dependsOn.length > 0
                ? `\n\n[의존 파일 목록]\n이미 세션에 생성된 파일들: ${task.dependsOn.join(", ")}\n이 파일들을 const { xxx } = require('./${task.dependsOn[0]}') 방식으로 불러오세요.`
                : "";

              // 이전 태스크들의 export 정보를 컨텍스트에 포함
              const prevContext = completedContext.slice(-3).join("\n\n---\n\n");

              // export 함수 목록 힌트
              const exportHint = task.exportedFunctions && task.exportedFunctions.length > 0
                ? `\n\n[이 파일이 export해야 할 함수]\nmodule.exports = { ${task.exportedFunctions.join(", ")} }`
                : task.filename !== plan.entryFile
                  ? `\n\n[주의] 이 파일은 module.exports = { 구현한함수들 }로 반드시 export하세요.`
                  : "";

              // Developer 실행
              send("dev_decision", {
                stepCount: task.id,
                nextRole: "developer",
                instruction: `"${task.filename}" 파일을 구현하세요. (절대 다른 파일명 사용 금지)`,
                reasoning: task.title,
                priority: "normal",
                timestamp: new Date().toISOString()
              });

              const devInstruction = `[태스크 ${task.id}/${plan.totalTasks}] ${task.title}

⚠️ 중요: 반드시 파일명 "${task.filename}"으로만 저장하세요. 다른 파일명 사용 금지!

${task.description}${depContext}${exportHint}

파일명: ${task.filename}
세션 ID: ${sessionId}`;

              const devLog = await runDevAgent(
                "developer",
                devInstruction,
                apiKey,
                sessionId,
                prevContext
              );

              send("dev_agent", { ...devLog, stepCount: task.id, sessionId });

              const devSuccess = devLog.executionResults?.some(r => r.success) ?? false;
              devLog.filesCreated?.forEach(f => allFiles.add(f));

              // Reviewer (실행 성공한 경우만)
              if (devSuccess) {
                send("dev_decision", {
                  stepCount: task.id + 0.5,
                  nextRole: "reviewer",
                  instruction: `"${task.filename}" 코드를 검토하세요.`,
                  reasoning: "실행 성공 → 품질 검토",
                  priority: "normal",
                  timestamp: new Date().toISOString()
                });

                const reviewLog = await runDevAgent(
                  "reviewer",
                  `[태스크 ${task.id} 리뷰] ${task.title}\n파일: ${task.filename}`,
                  apiKey,
                  sessionId,
                  devLog.output?.slice(0, 800) || ""
                );

                send("dev_agent", { ...reviewLog, stepCount: task.id + 0.5, sessionId });
              }

              // 태스크 완료 기록
              const taskSuccess = devSuccess;
              taskResults.push({
                taskId: task.id,
                title: task.title,
                success: taskSuccess,
                files: devLog.filesCreated || []
              });

              // 다음 태스크를 위한 컨텍스트 추가
              completedContext.push(
                `[태스크 ${task.id}: ${task.title}] ${taskSuccess ? "✅ 성공" : "⚠️ 실패"}\n생성 파일: ${(devLog.filesCreated || []).join(", ")}\n결과 요약: ${(devLog.output || "").slice(0, 300)}`
              );

              send("dev_task_done", {
                taskId: task.id,
                title: task.title,
                success: taskSuccess,
                files: devLog.filesCreated || [],
                timestamp: new Date().toISOString()
              });
            }

            // ── 3. 완료 + 다운로드 URL ──
            const successCount = taskResults.filter(t => t.success).length;
            const downloadUrl = `/api/download/${sessionId}?name=${encodeURIComponent(plan.projectName)}`;

            send("dev_complete", {
              sessionId,
              projectName: plan.projectName,
              totalTasks: plan.totalTasks,
              successTasks: successCount,
              filesCreated: [...allFiles],
              downloadUrl,
              summary: `${successCount}/${plan.totalTasks} 태스크 완료 · 파일 ${allFiles.size}개 생성`,
              timestamp: new Date().toISOString()
            });

          } catch (err) {
            send("dev_error", {
              message: err instanceof Error ? err.message : "알 수 없는 오류",
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
  } catch (err) {
    return c.json({ error: "개발 하네스 요청 처리 실패" }, 500);
  }
});

export default api;
