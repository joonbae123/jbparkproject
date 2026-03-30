/**
 * 메인 서버 파일
 * 
 * Hono 앱을 초기화하고
 * - API 라우트 마운트
 * - 정적 HTML 페이지 제공
 * - Node.js HTTP 서버로 실행
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import api from "./routes/api.js";

const app = new Hono();

// API 라우트 마운트
app.route("/api", api);

// 메인 페이지 - 프론트엔드 UI
app.get("/", (c) => {
  return c.html(getHTML());
});

// 서버 시작
const PORT = 3000;
console.log(`\n🚀 AI Harness + MCP Demo Server`);
console.log(`📍 http://localhost:${PORT}`);
console.log(`📡 API: http://localhost:${PORT}/api/health\n`);

serve({
  fetch: app.fetch,
  port: PORT
});

// =============================================
// 프론트엔드 HTML
// =============================================
function getHTML(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Harness + MCP Demo</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    @keyframes pulse-border {
      0%, 100% { border-color: #3b82f6; }
      50% { border-color: #8b5cf6; }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .agent-card { animation: fadeInUp 0.4s ease-out; }
    .running-border { animation: pulse-border 1.5s infinite; border-width: 2px; border-style: solid; }
    .log-content { font-family: 'Courier New', monospace; font-size: 0.8rem; }
    .pipeline-line {
      width: 2px;
      height: 40px;
      background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
      margin: 0 auto;
    }
    pre { white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen">

  <!-- 헤더 -->
  <div class="bg-gray-900 border-b border-gray-700 px-6 py-4">
    <div class="max-w-5xl mx-auto flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-white flex items-center gap-2">
          <i class="fas fa-robot text-blue-400"></i>
          AI Harness + MCP Demo
        </h1>
        <p class="text-xs text-gray-400 mt-1">Multi-Agent Pipeline with Model Context Protocol</p>
      </div>
      <div class="flex items-center gap-4">
        <div id="status-badge" class="hidden flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-full text-xs">
          <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          <span id="status-text">실행 중...</span>
        </div>
        <a href="https://github.com" target="_blank" class="text-gray-400 hover:text-white transition-colors">
          <i class="fab fa-github text-xl"></i>
        </a>
      </div>
    </div>
  </div>

  <div class="max-w-5xl mx-auto px-6 py-8">

    <!-- 아키텍처 다이어그램 -->
    <div class="bg-gray-900 rounded-xl p-5 mb-6 border border-gray-700">
      <h2 class="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
        <i class="fas fa-sitemap text-blue-400"></i>
        시스템 아키텍처
      </h2>
      <div class="flex items-center justify-center gap-2 flex-wrap text-xs">
        <div class="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-center">
          <div class="text-gray-300 font-medium">사용자 쿼리</div>
          <div class="text-gray-500 text-xs mt-1">입력</div>
        </div>
        <i class="fas fa-arrow-right text-gray-500"></i>
        <div class="bg-blue-900/40 border border-blue-600 rounded-lg px-3 py-2 text-center">
          <div class="text-blue-300 font-medium">🔍 Researcher</div>
          <div class="text-gray-500 text-xs mt-1">web_search</div>
        </div>
        <i class="fas fa-arrow-right text-gray-500"></i>
        <div class="bg-purple-900/40 border border-purple-600 rounded-lg px-3 py-2 text-center">
          <div class="text-purple-300 font-medium">📊 Analyst</div>
          <div class="text-gray-500 text-xs mt-1">analyze_text</div>
        </div>
        <i class="fas fa-arrow-right text-gray-500"></i>
        <div class="bg-yellow-900/40 border border-yellow-600 rounded-lg px-3 py-2 text-center">
          <div class="text-yellow-300 font-medium">⚖️ Critic</div>
          <div class="text-gray-500 text-xs mt-1">fact_check</div>
        </div>
        <i class="fas fa-arrow-right text-gray-500"></i>
        <div class="bg-green-900/40 border border-green-600 rounded-lg px-3 py-2 text-center">
          <div class="text-green-300 font-medium">✨ Synthesizer</div>
          <div class="text-gray-500 text-xs mt-1">최종 보고서</div>
        </div>
        <i class="fas fa-arrow-right text-gray-500"></i>
        <div class="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-center">
          <div class="text-gray-300 font-medium">결과</div>
          <div class="text-gray-500 text-xs mt-1">출력</div>
        </div>
      </div>
      <!-- MCP 레이어 설명 -->
      <div class="mt-3 flex items-center justify-center gap-1 text-xs text-gray-500">
        <i class="fas fa-plug text-gray-600"></i>
        <span>각 에이전트는 <span class="text-blue-400">MCP Protocol</span>을 통해 외부 도구(Tools)에 접근합니다</span>
      </div>
    </div>

    <!-- 입력 섹션 -->
    <div class="bg-gray-900 rounded-xl p-5 mb-6 border border-gray-700">
      <h2 class="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
        <i class="fas fa-key text-yellow-400"></i>
        설정
      </h2>
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-gray-400 mb-1">OpenAI API Key</label>
          <input
            id="api-key"
            type="password"
            placeholder="sk-..."
            class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">리서치 쿼리</label>
          <div class="flex gap-2 flex-wrap mb-2">
            <button onclick="setQuery('AI Harness와 MCP의 미래 전망')" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition-colors">AI Harness 미래</button>
            <button onclick="setQuery('2024년 대규모 언어 모델 트렌드')" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition-colors">LLM 트렌드</button>
            <button onclick="setQuery('멀티 에이전트 시스템의 기업 활용 사례')" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition-colors">기업 활용사례</button>
            <button onclick="setQuery('Claude MCP와 OpenAI Function Calling 비교')" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition-colors">MCP vs Function Calling</button>
          </div>
          <textarea
            id="query"
            rows="2"
            placeholder="리서치할 주제를 입력하세요..."
            class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
          >AI Harness와 MCP의 미래 전망</textarea>
        </div>
        <button
          id="run-btn"
          onclick="runHarness()"
          class="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <i class="fas fa-play"></i>
          Harness 실행
        </button>
      </div>
    </div>

    <!-- 파이프라인 실행 뷰 -->
    <div id="pipeline-view" class="hidden mb-6">
      <h2 class="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
        <i class="fas fa-stream text-blue-400"></i>
        파이프라인 실행 현황
        <span id="timer" class="text-gray-500 text-xs ml-auto font-normal"></span>
      </h2>
      <div id="agents-container" class="space-y-2"></div>
    </div>

    <!-- 최종 보고서 -->
    <div id="report-section" class="hidden">
      <h2 class="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
        <i class="fas fa-file-alt text-green-400"></i>
        최종 보고서
        <span id="report-stats" class="text-gray-500 text-xs ml-auto font-normal"></span>
      </h2>
      <div class="bg-gray-900 border border-green-800 rounded-xl p-5">
        <div id="final-report" class="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap"></div>
      </div>
    </div>

  </div>

  <script>
    let isRunning = false;
    let startTime = null;
    let timerInterval = null;

    function setQuery(text) {
      document.getElementById('query').value = text;
    }

    function updateTimer() {
      if (!startTime) return;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      document.getElementById('timer').textContent = elapsed + 's 경과';
    }

    // 에이전트 카드 생성/업데이트
    function renderAgentCard(log, isRunning = false) {
      const container = document.getElementById('agents-container');
      const existingCard = document.getElementById('card-' + log.agentRole);

      const statusColors = {
        'idle': 'border-gray-600',
        'running': 'border-blue-500 running-border',
        'tool_calling': 'border-yellow-500 running-border',
        'completed': 'border-green-700',
        'error': 'border-red-700'
      };

      const statusIcons = {
        'idle': '<i class="fas fa-circle text-gray-600"></i>',
        'running': '<i class="fas fa-spinner fa-spin text-blue-400"></i>',
        'tool_calling': '<i class="fas fa-plug fa-pulse text-yellow-400"></i>',
        'completed': '<i class="fas fa-check-circle text-green-400"></i>',
        'error': '<i class="fas fa-times-circle text-red-400"></i>'
      };

      const roleColors = {
        'researcher': 'text-blue-300',
        'analyst': 'text-purple-300',
        'critic': 'text-yellow-300',
        'synthesizer': 'text-green-300'
      };

      const toolCallHTML = log.toolCalls && log.toolCalls.length > 0 ? \`
        <div class="mt-2 space-y-1">
          \${log.toolCalls.map(tc => \`
            <div class="bg-gray-950 rounded p-2 text-xs">
              <div class="flex items-center gap-1 mb-1">
                <i class="fas fa-plug text-blue-400 text-xs"></i>
                <span class="text-blue-300 font-mono">MCP Tool: \${tc.toolName}</span>
              </div>
              <div class="text-gray-400 text-xs">인자: \${JSON.stringify(tc.args)}</div>
              <details class="mt-1">
                <summary class="text-gray-500 cursor-pointer hover:text-gray-300 text-xs">결과 보기</summary>
                <pre class="text-gray-400 mt-1 log-content">\${tc.result}</pre>
              </details>
            </div>
          \`).join('')}
        </div>
      \` : '';

      const outputHTML = log.output ? \`
        <details class="mt-2" \${log.agentRole === 'synthesizer' ? 'open' : ''}>
          <summary class="text-gray-400 cursor-pointer hover:text-gray-200 text-xs flex items-center gap-1">
            <i class="fas fa-comment-alt text-xs"></i> 에이전트 출력
          </summary>
          <div class="mt-1 bg-gray-950 rounded p-2 text-xs text-gray-300 leading-relaxed">
            \${log.output.replace(/\\n/g, '<br>')}
          </div>
        </details>
      \` : '';

      const durationHTML = log.duration ? \`
        <span class="text-xs text-gray-600 ml-auto">\${(log.duration/1000).toFixed(1)}s</span>
      \` : '';

      const cardHTML = \`
        <div id="card-\${log.agentRole}" 
          class="agent-card bg-gray-900 rounded-lg p-4 border \${statusColors[log.status] || 'border-gray-700'}">
          <div class="flex items-center gap-2">
            \${statusIcons[log.status] || ''}
            <span class="font-medium text-sm \${roleColors[log.agentRole] || 'text-gray-300'}">\${log.agentName}</span>
            <span class="text-xs text-gray-500">\${log.message}</span>
            \${durationHTML}
          </div>
          \${toolCallHTML}
          \${outputHTML}
        </div>
      \`;

      if (existingCard) {
        existingCard.outerHTML = cardHTML;
      } else {
        container.insertAdjacentHTML('beforeend', cardHTML);
      }
    }

    async function runHarness() {
      if (isRunning) return;

      const apiKey = document.getElementById('api-key').value.trim();
      const query = document.getElementById('query').value.trim();

      if (!apiKey) { alert('OpenAI API Key를 입력하세요'); return; }
      if (!query) { alert('리서치 쿼리를 입력하세요'); return; }

      isRunning = true;
      startTime = Date.now();

      // UI 초기화
      document.getElementById('run-btn').disabled = true;
      document.getElementById('run-btn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> 실행 중...';
      document.getElementById('pipeline-view').classList.remove('hidden');
      document.getElementById('report-section').classList.add('hidden');
      document.getElementById('agents-container').innerHTML = '';
      document.getElementById('status-badge').classList.remove('hidden');
      document.getElementById('status-text').textContent = '에이전트 실행 중...';

      timerInterval = setInterval(updateTimer, 100);

      // 에이전트 placeholder 카드 미리 표시
      const agents = [
        { agentRole: 'researcher', agentName: '🔍 리서처 에이전트', status: 'idle', message: '대기 중', toolCalls: [], output: '' },
        { agentRole: 'analyst', agentName: '📊 분석가 에이전트', status: 'idle', message: '대기 중', toolCalls: [], output: '' },
        { agentRole: 'critic', agentName: '⚖️ 비평가 에이전트', status: 'idle', message: '대기 중', toolCalls: [], output: '' },
        { agentRole: 'synthesizer', agentName: '✨ 종합 에이전트', status: 'idle', message: '대기 중', toolCalls: [], output: '' },
      ];
      agents.forEach(a => renderAgentCard(a));

      try {
        const response = await fetch('/api/harness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, apiKey })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              const event = line.slice(7).trim();
              const nextLine = lines[lines.indexOf(line) + 1];
              if (nextLine && nextLine.startsWith('data: ')) {
                try {
                  const data = JSON.parse(nextLine.slice(6));
                  handleSSEEvent(event, data);
                } catch(e) {}
              }
            }
          }
        }

      } catch (err) {
        alert('오류: ' + err.message);
      } finally {
        clearInterval(timerInterval);
        isRunning = false;
        document.getElementById('run-btn').disabled = false;
        document.getElementById('run-btn').innerHTML = '<i class="fas fa-play"></i> Harness 실행';
        document.getElementById('status-badge').classList.add('hidden');
      }
    }

    function handleSSEEvent(event, data) {
      switch(event) {
        case 'start':
          document.getElementById('status-text').textContent = 'Harness 시작됨';
          break;
          
        case 'agent_complete':
          renderAgentCard(data);
          document.getElementById('status-text').textContent = data.agentName + ' 완료';
          break;
          
        case 'complete':
          // 최종 보고서 표시
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          document.getElementById('final-report').textContent = data.finalReport;
          document.getElementById('report-stats').textContent = 
            \`\${elapsed}s · 에이전트 \${data.agentsExecuted}개 · MCP 도구: \${data.mcpToolsUsed.join(', ')}\`;
          document.getElementById('report-section').classList.remove('hidden');
          document.getElementById('report-section').scrollIntoView({ behavior: 'smooth' });
          break;
          
        case 'error':
          alert('오류: ' + data.message);
          break;
      }
    }
  </script>
</body>
</html>`;
}

export default app;
