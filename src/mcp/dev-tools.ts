/**
 * 개발 하네스 전용 MCP Tools v6
 *
 * 기존 tools.ts (리서치용) 와 달리,
 * 이 파일은 "실제 코드 개발"을 위한 도구들을 제공합니다.
 *
 * 핵심 도구:
 * 1. write_code      - 코드 파일 작성 (실제 파일 I/O)
 * 2. read_code       - 코드 파일 읽기 (실제 파일 I/O)
 * 3. execute_code    - Node.js 코드 실행 (child_process)
 * 4. run_tests       - Jest/기본 테스트 실행
 * 5. list_files      - 작업 디렉토리 파일 목록
 *
 * 샌드박스 실행 원리:
 *   - 모든 코드는 /tmp/dev-harness/{sessionId}/ 에 격리
 *   - child_process.execSync로 Node.js 실행
 *   - 타임아웃 10초로 무한 루프 방지
 *   - stdout/stderr 모두 캡처해 AI에 피드백
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// 샌드박스 루트 경로
const SANDBOX_BASE = "/tmp/dev-harness";

// 세션별 독립 작업 공간 생성
export function createSandboxSession(sessionId: string): string {
  const sessionPath = path.join(SANDBOX_BASE, sessionId);
  fs.mkdirSync(sessionPath, { recursive: true });
  return sessionPath;
}

// 세션 경로 가져오기
export function getSessionPath(sessionId: string): string {
  return path.join(SANDBOX_BASE, sessionId);
}

// ─────────────────────────────────────────────
// MCP Tool 정의 (개발 하네스 전용)
// ─────────────────────────────────────────────

export const DEV_MCP_TOOLS = [
  {
    name: "write_code",
    description: "지정한 파일명으로 코드를 작성합니다. 기존 파일이 있으면 덮어씁니다.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "작성할 파일명 (예: solution.js, utils.ts)"
        },
        code: {
          type: "string",
          description: "작성할 코드 내용 (전체 파일 내용)"
        },
        session_id: {
          type: "string",
          description: "현재 세션 ID (격리 환경)"
        }
      },
      required: ["filename", "code", "session_id"]
    }
  },
  {
    name: "read_code",
    description: "지정한 파일의 코드를 읽어옵니다.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "읽을 파일명"
        },
        session_id: {
          type: "string",
          description: "현재 세션 ID"
        }
      },
      required: ["filename", "session_id"]
    }
  },
  {
    name: "execute_code",
    description: "Node.js로 JavaScript/TypeScript 코드를 실제 실행하고 결과(stdout, stderr, exit code)를 반환합니다. 실행 오류가 있으면 에러 메시지를 반환합니다.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "실행할 파일명 (session 내 경로)"
        },
        session_id: {
          type: "string",
          description: "현재 세션 ID"
        },
        args: {
          type: "string",
          description: "커맨드라인 인자 (선택, 예: '--input test.json')"
        }
      },
      required: ["filename", "session_id"]
    }
  },
  {
    name: "run_tests",
    description: "테스트 코드를 실행하고 통과/실패 결과를 반환합니다. 테스트 파일은 *.test.js 패턴이어야 합니다.",
    inputSchema: {
      type: "object",
      properties: {
        test_filename: {
          type: "string",
          description: "테스트 파일명 (예: solution.test.js)"
        },
        session_id: {
          type: "string",
          description: "현재 세션 ID"
        }
      },
      required: ["test_filename", "session_id"]
    }
  },
  {
    name: "list_files",
    description: "현재 세션의 작업 디렉토리에 있는 파일 목록을 반환합니다.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "현재 세션 ID"
        }
      },
      required: ["session_id"]
    }
  }
];

// ─────────────────────────────────────────────
// MCP Tool 실행기 (개발 하네스 전용)
// ─────────────────────────────────────────────

export async function executeDevTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: string; success: boolean; metadata?: Record<string, unknown> }> {

  console.log(`[DevTool 실행] ${toolName}`, { ...args, code: args.code ? "(생략)" : undefined });

  switch (toolName) {

    // ── 1. 코드 파일 작성 ──
    case "write_code": {
      const filename = args.filename as string;
      const code = args.code as string;
      const sessionId = args.session_id as string;

      // 파일명 보안 검증 (path traversal 방지)
      const safeName = path.basename(filename);
      const sessionPath = createSandboxSession(sessionId);
      const filePath = path.join(sessionPath, safeName);

      fs.writeFileSync(filePath, code, "utf-8");
      const lineCount = code.split("\n").length;
      const charCount = code.length;

      return {
        content: `✅ 파일 작성 완료: ${safeName}
경로: ${filePath}
라인 수: ${lineCount}줄
크기: ${charCount}자`,
        success: true,
        metadata: { filename: safeName, path: filePath, lineCount, charCount }
      };
    }

    // ── 2. 코드 파일 읽기 ──
    case "read_code": {
      const filename = args.filename as string;
      const sessionId = args.session_id as string;

      const safeName = path.basename(filename);
      const sessionPath = getSessionPath(sessionId);
      const filePath = path.join(sessionPath, safeName);

      if (!fs.existsSync(filePath)) {
        return {
          content: `❌ 파일 없음: ${safeName}\n경로: ${filePath}`,
          success: false
        };
      }

      const content = fs.readFileSync(filePath, "utf-8");
      return {
        content: `📄 [${safeName}]\n\`\`\`javascript\n${content}\n\`\`\``,
        success: true,
        metadata: { filename: safeName, lineCount: content.split("\n").length }
      };
    }

    // ── 3. 코드 실행 (핵심!) ──
    case "execute_code": {
      const filename = args.filename as string;
      const sessionId = args.session_id as string;
      const extraArgs = (args.args as string) || "";

      const safeName = path.basename(filename);
      const sessionPath = getSessionPath(sessionId);
      const filePath = path.join(sessionPath, safeName);

      if (!fs.existsSync(filePath)) {
        return {
          content: `❌ 실행 파일 없음: ${safeName}\n먼저 write_code로 파일을 작성하세요.`,
          success: false
        };
      }

      try {
        const cmd = `node "${filePath}" ${extraArgs}`.trim();
        console.log(`[execute_code] 실행: ${cmd}`);

        const stdout = execSync(cmd, {
          timeout: 10000,          // 10초 타임아웃
          cwd: sessionPath,
          encoding: "utf-8",
          env: { ...process.env, NODE_ENV: "test" }
        });

        return {
          content: `✅ 실행 성공!\n\n[실행 명령]\n$ ${cmd}\n\n[stdout]\n${stdout || "(출력 없음)"}`,
          success: true,
          metadata: { filename: safeName, exitCode: 0, stdout }
        };

      } catch (execError: any) {
        const stdout = execError.stdout || "";
        const stderr = execError.stderr || "";
        const exitCode = execError.status || 1;

        return {
          content: `❌ 실행 실패! (exit code: ${exitCode})\n\n[실행 명령]\n$ node ${safeName}\n\n[stdout]\n${stdout || "(없음)"}\n\n[stderr / 에러]\n${stderr || execError.message || "(없음)"}`,
          success: false,
          metadata: { filename: safeName, exitCode, stdout, stderr }
        };
      }
    }

    // ── 4. 테스트 실행 ──
    case "run_tests": {
      const testFilename = args.test_filename as string;
      const sessionId = args.session_id as string;

      const safeName = path.basename(testFilename);
      const sessionPath = getSessionPath(sessionId);
      const filePath = path.join(sessionPath, safeName);

      if (!fs.existsSync(filePath)) {
        return {
          content: `❌ 테스트 파일 없음: ${safeName}`,
          success: false
        };
      }

      // 테스트 파일 내용 읽어서 자체 실행 (Jest 없이 간단히)
      try {
        const testCode = fs.readFileSync(filePath, "utf-8");

        // 간단한 assert 패턴 지원
        // console.assert() 혹은 직접 실행
        const stdout = execSync(`node "${filePath}"`, {
          timeout: 10000,
          cwd: sessionPath,
          encoding: "utf-8",
          env: { ...process.env, NODE_ENV: "test" }
        });

        // 통과/실패 카운트 파싱
        const passMatch = stdout.match(/(\d+)\s*(?:pass|passed|통과)/i);
        const failMatch = stdout.match(/(\d+)\s*(?:fail|failed|실패)/i);
        const passCount = passMatch ? parseInt(passMatch[1]) : null;
        const failCount = failMatch ? parseInt(failMatch[1]) : null;

        const summary = passCount !== null || failCount !== null
          ? `\n📊 결과 요약: ${passCount ?? "?"}통과 / ${failCount ?? "?"}실패`
          : "";

        return {
          content: `✅ 테스트 실행 완료!${summary}\n\n[출력]\n${stdout}`,
          success: true,
          metadata: { testFile: safeName, passCount, failCount }
        };

      } catch (execError: any) {
        const stderr = execError.stderr || execError.message || "";
        const stdout = execError.stdout || "";

        return {
          content: `❌ 테스트 실패!\n\n[stdout]\n${stdout}\n\n[오류]\n${stderr}`,
          success: false,
          metadata: { testFile: safeName, exitCode: execError.status }
        };
      }
    }

    // ── 5. 파일 목록 ──
    case "list_files": {
      const sessionId = args.session_id as string;
      const sessionPath = getSessionPath(sessionId);

      if (!fs.existsSync(sessionPath)) {
        return {
          content: `📁 세션 디렉토리 없음 (아직 파일 없음)\n경로: ${sessionPath}`,
          success: true,
          metadata: { files: [] }
        };
      }

      const files = fs.readdirSync(sessionPath);
      if (files.length === 0) {
        return {
          content: `📁 빈 세션 디렉토리\n경로: ${sessionPath}`,
          success: true,
          metadata: { files: [] }
        };
      }

      const fileDetails = files.map(f => {
        try {
          const stat = fs.statSync(path.join(sessionPath, f));
          return `  - ${f} (${stat.size}B, ${new Date(stat.mtime).toLocaleTimeString()})`;
        } catch {
          return `  - ${f}`;
        }
      });

      return {
        content: `📁 세션 파일 목록 (${files.length}개)\n${fileDetails.join("\n")}`,
        success: true,
        metadata: { files, path: sessionPath }
      };
    }

    default:
      return {
        content: `❌ 알 수 없는 DevTool: ${toolName}`,
        success: false
      };
  }
}

/**
 * DEV_MCP_TOOLS → OpenAI Function Calling 형식으로 변환
 */
export function convertDevToolsToOpenAI(tools: typeof DEV_MCP_TOOLS) {
  return tools.map(tool => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));
}
