import { Hono } from "hono";
import { serve } from "@hono/node-server";
import api from "./routes/api.js";

const app = new Hono();
app.route("/api", api);
app.get("/", (c) => c.html(getHTML()));

const PORT = 3000;
console.log(`\n🚀 AI Harness + MCP Demo Server v2`);
console.log(`📍 http://localhost:${PORT}`);
console.log(`📡 API: http://localhost:${PORT}/api/health\n`);

serve({ fetch: app.fetch, port: PORT });

function getHTML(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Harness + MCP Demo v2</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    @keyframes fadeInUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes pulse-border { 0%,100%{border-color:#3b82f6} 50%{border-color:#8b5cf6} }
    @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
    .fade-in { animation: fadeInUp 0.4s ease-out; }
    .running-border { animation: pulse-border 1.5s infinite; border-width:2px; border-style:solid; }
    .rejected-shake { animation: shake 0.4s ease-out; }
    pre { white-space:pre-wrap; word-break:break-word; }
    .score-bar { transition: width 0.8s ease-out; }
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
          <span class="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full ml-1">v2 피드백 루프</span>
        </h1>
        <p class="text-xs text-gray-400 mt-1">비평가 반려 → 리서처 재시도 · 최대 3회</p>
      </div>
      <div id="status-badge" class="hidden items-center gap-2 bg-gray-800 px-3 py-1 rounded-full text-xs">
        <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
        <span id="status-text">실행 중...</span>
      </div>
    </div>
  </div>

  <div class="max-w-5xl mx-auto px-6 py-6 space-y-5">

    <!-- 아키텍처 다이어그램 -->
    <div class="bg-gray-900 rounded-xl p-4 border border-gray-700">
      <h2 class="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
        <i class="fas fa-sitemap text-blue-400"></i> 피드백 루프 아키텍처
      </h2>
      <div class="flex items-center justify-center gap-2 flex-wrap text-xs">
        <div class="bg-blue-900/40 border border-blue-600 rounded-lg px-3 py-2 text-center">
          <div class="text-blue-300 font-medium">🔍 Researcher</div>
          <div class="text-gray-500 text-xs">web_search</div>
        </div>
        <i class="fas fa-arrow-right text-gray-500"></i>
        <div class="bg-purple-900/40 border border-purple-600 rounded-lg px-3 py-2 text-center">
          <div class="text-purple-300 font-medium">📊 Analyst</div>
          <div class="text-gray-500 text-xs">analyze_text</div>
        </div>
        <i class="fas fa-arrow-right text-gray-500"></i>
        <div class="bg-yellow-900/40 border border-yellow-600 rounded-lg px-3 py-2 text-center">
          <div class="text-yellow-300 font-medium">⚖️ Critic</div>
          <div class="text-gray-500 text-xs">승인/반려 판정</div>
        </div>
        <div class="flex flex-col items-center gap-1">
          <div class="text-xs text-red-400 flex items-center gap-1">
            <i class="fas fa-redo text-xs"></i> 반려 시 재시도
          </div>
          <i class="fas fa-arrow-right text-gray-500"></i>
          <div class="text-xs text-green-400 flex items-center gap-1">
            <i class="fas fa-check text-xs"></i> 승인 시 진행
          </div>
        </div>
        <div class="bg-green-900/40 border border-green-600 rounded-lg px-3 py-2 text-center">
          <div class="text-green-300 font-medium">✨ Synthesizer</div>
          <div class="text-gray-500 text-xs">최종 보고서</div>
        </div>
      </div>
    </div>

    <!-- 입력 섹션 -->
    <div class="bg-gray-900 rounded-xl p-5 border border-gray-700">
      <h2 class="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
        <i class="fas fa-key text-yellow-400"></i> 설정
      </h2>
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-gray-400 mb-1">OpenAI API Key</label>
          <input id="api-key" type="password" placeholder="sk-proj-... 또는 sk-..."
            class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"/>
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">리서치 쿼리</label>
          <div class="flex gap-2 flex-wrap mb-2">
            <button onclick="setQuery('AI Harness와 MCP의 미래 전망')" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded">AI Harness 미래</button>
            <button onclick="setQuery('2024년 대규모 언어 모델 트렌드')" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded">LLM 트렌드</button>
            <button onclick="setQuery('멀티 에이전트 시스템의 기업 활용 사례')" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded">기업 활용사례</button>
          </div>
          <textarea id="query" rows="2" placeholder="리서치할 주제를 입력하세요..."
            class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 resize-none">AI Harness와 MCP의 미래 전망</textarea>
        </div>
        <button id="run-btn" onclick="runHarness()"
          class="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
          <i class="fas fa-play"></i> Harness 실행 (피드백 루프)
        </button>
      </div>
    </div>

    <!-- 파이프라인 실행 뷰 -->
    <div id="pipeline-view" class="hidden">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <i class="fas fa-stream text-blue-400"></i> 파이프라인 실행 현황
        </h2>
        <div class="flex items-center gap-3 text-xs text-gray-500">
          <span id="attempt-counter"></span>
          <span id="timer"></span>
        </div>
      </div>
      <div id="agents-container" class="space-y-2"></div>
    </div>

    <!-- 반려/재시도 리포트 -->
    <div id="retry-report-section" class="hidden fade-in">
      <h2 class="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
        <i class="fas fa-clipboard-list text-yellow-400"></i> 반려/재시도 리포트
      </h2>
      <div class="bg-gray-900 border border-yellow-800 rounded-xl p-5 space-y-4">

        <!-- 요약 통계 -->
        <div id="retry-stats" class="grid grid-cols-3 gap-3"></div>

        <!-- 품질 점수 추이 -->
        <div id="quality-chart" class="hidden">
          <div class="text-xs text-gray-400 mb-2 font-medium">품질 점수 추이</div>
          <div id="quality-bars" class="space-y-2"></div>
        </div>

        <!-- 반려 이벤트 상세 -->
        <div id="retry-events" class="space-y-3"></div>

        <!-- 개선 요약 -->
        <div id="improvement-summary" class="hidden bg-gray-800 rounded-lg p-3">
          <div class="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1">
            <i class="fas fa-chart-line text-green-400"></i> 개선 과정 요약
          </div>
          <div id="improvement-text" class="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap"></div>
        </div>
      </div>
    </div>

    <!-- 전역 에러 표시 -->
    <div id="global-error" class="hidden fade-in bg-red-950 border border-red-700 rounded-xl p-4">
      <div class="flex items-start gap-3">
        <i class="fas fa-exclamation-circle text-red-400 mt-0.5 text-lg"></i>
        <div>
          <div class="text-sm font-semibold text-red-300 mb-1">실행 오류 발생</div>
          <div id="global-error-msg" class="text-xs text-red-200 font-mono leading-relaxed"></div>
          <div class="mt-2 text-xs text-gray-400">
            💡 <strong>API Key 오류라면:</strong> <a href="https://platform.openai.com/api-keys" target="_blank" class="text-blue-400 underline">platform.openai.com/api-keys</a>에서 새 키를 발급하세요
          </div>
        </div>
      </div>
    </div>

    <!-- 최종 보고서 -->
    <div id="report-section" class="hidden fade-in">
      <h2 class="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
        <i class="fas fa-file-alt text-green-400"></i> 최종 보고서
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

    function setQuery(t) { document.getElementById('query').value = t; }

    function updateTimer() {
      if (!startTime) return;
      const e = ((Date.now() - startTime) / 1000).toFixed(1);
      document.getElementById('timer').textContent = e + 's 경과';
    }

    function renderAgentCard(log) {
      const container = document.getElementById('agents-container');
      const existing = document.getElementById('card-' + log.agentId);

      const attemptBadge = log.attempt > 1
        ? \`<span class="text-xs bg-orange-900 text-orange-300 px-1.5 py-0.5 rounded ml-1">\${log.attempt}차 시도</span>\`
        : '';

      const statusColors = {
        idle: 'border-gray-600',
        running: 'border-blue-500 running-border',
        tool_calling: 'border-yellow-500 running-border',
        completed: log.agentRole === 'critic'
          ? (log.message.includes('반려') ? 'border-red-700 rejected-shake' : 'border-green-700')
          : 'border-green-700',
        error: 'border-red-700'
      };

      const statusIcons = {
        idle: '<i class="fas fa-circle text-gray-600"></i>',
        running: '<i class="fas fa-spinner fa-spin text-blue-400"></i>',
        tool_calling: '<i class="fas fa-plug fa-pulse text-yellow-400"></i>',
        completed: log.message.includes('반려')
          ? '<i class="fas fa-times-circle text-red-400"></i>'
          : '<i class="fas fa-check-circle text-green-400"></i>',
        error: '<i class="fas fa-times-circle text-red-400"></i>'
      };

      const roleColors = {
        researcher: 'text-blue-300',
        analyst: 'text-purple-300',
        critic: log.message.includes('반려') ? 'text-red-300' : 'text-yellow-300',
        synthesizer: 'text-green-300'
      };

      const toolCallHTML = log.toolCalls?.length > 0 ? \`
        <div class="mt-2 space-y-1">
          \${log.toolCalls.map(tc => \`
            <div class="bg-gray-950 rounded p-2 text-xs">
              <div class="text-blue-300 font-mono mb-1"><i class="fas fa-plug text-xs mr-1"></i>MCP: \${tc.toolName}</div>
              <details><summary class="text-gray-500 cursor-pointer text-xs">결과 보기</summary>
                <pre class="text-gray-400 mt-1 text-xs">\${tc.result}</pre>
              </details>
            </div>
          \`).join('')}
        </div>
      \` : '';

      const errorHTML = log.status === 'error' ? \`
        <div class="mt-2 bg-red-950 border border-red-800 rounded p-2 text-xs text-red-300">
          <div class="font-semibold mb-1">❌ 에러:</div>
          <div class="font-mono">\${log.output || log.message}</div>
        </div>
      \` : '';

      const outputHTML = log.output && log.status !== 'error' ? \`
        <details class="mt-2" \${log.agentRole === 'synthesizer' ? 'open' : ''}>
          <summary class="text-gray-400 cursor-pointer hover:text-gray-200 text-xs flex items-center gap-1">
            <i class="fas fa-comment-alt text-xs"></i> 에이전트 출력
          </summary>
          <div class="mt-1 bg-gray-950 rounded p-2 text-xs text-gray-300 leading-relaxed">
            \${log.output.replace(/\\n/g, '<br>')}
          </div>
        </details>
      \` : '';

      const durationHTML = log.duration ? \`<span class="text-xs text-gray-600 ml-auto">\${(log.duration/1000).toFixed(1)}s</span>\` : '';

      const html = \`
        <div id="card-\${log.agentId}"
          class="fade-in bg-gray-900 rounded-lg p-4 border \${statusColors[log.status] || 'border-gray-700'}">
          <div class="flex items-center gap-2">
            \${statusIcons[log.status] || ''}
            <span class="font-medium text-sm \${roleColors[log.agentRole] || 'text-gray-300'}">\${log.agentName}</span>
            \${attemptBadge}
            <span class="text-xs text-gray-500">\${log.message}</span>
            \${durationHTML}
          </div>
          \${errorHTML}
          \${toolCallHTML}
          \${outputHTML}
        </div>
      \`;

      if (existing) {
        existing.outerHTML = html;
      } else {
        container.insertAdjacentHTML('beforeend', html);
      }
    }

    function renderRetryEvent(event) {
      const section = document.getElementById('retry-report-section');
      const eventsContainer = document.getElementById('retry-events');
      section.classList.remove('hidden');

      const issuesHTML = event.judgement.issues.map(i =>
        \`<li class="text-red-300">\${i}</li>\`
      ).join('');
      const suggestionsHTML = event.judgement.suggestions.map(s =>
        \`<li class="text-blue-300">\${s}</li>\`
      ).join('');

      eventsContainer.insertAdjacentHTML('beforeend', \`
        <div class="fade-in bg-red-950/30 border border-red-800 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-3">
            <i class="fas fa-times-circle text-red-400"></i>
            <span class="text-sm font-semibold text-red-300">\${event.attempt}차 시도 반려</span>
            <span class="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full ml-auto">
              품질 점수: \${event.judgement.score}점
            </span>
          </div>
          <div class="text-xs text-gray-300 mb-2">
            <span class="text-gray-500">반려 이유:</span> \${event.judgement.reason}
          </div>
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div class="text-gray-500 mb-1 font-medium">발견된 문제점</div>
              <ul class="space-y-1 list-disc list-inside">\${issuesHTML}</ul>
            </div>
            <div>
              <div class="text-gray-500 mb-1 font-medium">개선 제안</div>
              <ul class="space-y-1 list-disc list-inside">\${suggestionsHTML}</ul>
            </div>
          </div>
        </div>
      \`);
    }

    function showGlobalError(msg) {
      const el = document.getElementById('global-error');
      document.getElementById('global-error-msg').textContent = msg;
      el.classList.remove('hidden');
      el.scrollIntoView({ behavior: 'smooth' });
    }

    function renderRetryReport(retryReport) {
      const section = document.getElementById('retry-report-section');
      section.classList.remove('hidden');

      // 요약 통계
      const statsColor = retryReport.totalRejections === 0 ? 'border-green-700' : 'border-yellow-700';
      document.getElementById('retry-stats').innerHTML = \`
        <div class="bg-gray-800 rounded-lg p-3 text-center border \${statsColor}">
          <div class="text-2xl font-bold text-white">\${retryReport.totalAttempts}</div>
          <div class="text-xs text-gray-400 mt-1">총 시도 횟수</div>
        </div>
        <div class="bg-gray-800 rounded-lg p-3 text-center border \${retryReport.totalRejections > 0 ? 'border-red-700' : 'border-green-700'}">
          <div class="text-2xl font-bold \${retryReport.totalRejections > 0 ? 'text-red-400' : 'text-green-400'}">\${retryReport.totalRejections}</div>
          <div class="text-xs text-gray-400 mt-1">반려 횟수</div>
        </div>
        <div class="bg-gray-800 rounded-lg p-3 text-center border \${retryReport.finalVerdict === 'approved' ? 'border-green-700' : 'border-yellow-700'}">
          <div class="text-2xl font-bold \${retryReport.finalVerdict === 'approved' ? 'text-green-400' : 'text-yellow-400'}">
            \${retryReport.finalVerdict === 'approved' ? '✅' : '⚠️'}
          </div>
          <div class="text-xs text-gray-400 mt-1">최종 판정</div>
        </div>
      \`;

      // 품질 점수 추이
      if (retryReport.qualityProgression.length > 0) {
        const chartSection = document.getElementById('quality-chart');
        chartSection.classList.remove('hidden');
        const maxScore = 100;
        document.getElementById('quality-bars').innerHTML = retryReport.qualityProgression.map((score, i) => {
          const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500';
          const label = i < retryReport.qualityProgression.length - 1
            ? \`\${i+1}차 시도 (반려)\`
            : \`\${i+1}차 시도 (최종)\`;
          return \`
            <div class="flex items-center gap-3">
              <div class="text-xs text-gray-400 w-24 shrink-0">\${label}</div>
              <div class="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
                <div class="\${color} h-4 rounded-full score-bar flex items-center justify-end pr-2"
                  style="width:\${score}%">
                  <span class="text-xs text-white font-bold">\${score}점</span>
                </div>
              </div>
            </div>
          \`;
        }).join('');
      }

      // 개선 요약
      if (retryReport.improvementSummary) {
        document.getElementById('improvement-summary').classList.remove('hidden');
        document.getElementById('improvement-text').textContent = retryReport.improvementSummary;
      }
    }

    async function runHarness() {
      if (isRunning) return;
      const apiKey = document.getElementById('api-key').value.trim();
      const query = document.getElementById('query').value.trim();
      const projectId = '';

      if (!apiKey) { alert('OpenAI API Key를 입력하세요'); return; }
      if (!query) { alert('리서치 쿼리를 입력하세요'); return; }

      isRunning = true;
      startTime = Date.now();

      // UI 초기화
      document.getElementById('run-btn').disabled = true;
      document.getElementById('run-btn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> 실행 중...';
      document.getElementById('pipeline-view').classList.remove('hidden');
      document.getElementById('report-section').classList.add('hidden');
      document.getElementById('retry-report-section').classList.add('hidden');
      document.getElementById('global-error').classList.add('hidden');
      document.getElementById('agents-container').innerHTML = '';
      document.getElementById('retry-events').innerHTML = '';
      document.getElementById('retry-stats').innerHTML = '';
      document.getElementById('quality-bars').innerHTML = '';
      document.getElementById('status-badge').classList.remove('hidden');
      document.getElementById('status-badge').classList.add('flex');
      document.getElementById('status-text').textContent = '에이전트 실행 중...';
      document.getElementById('attempt-counter').textContent = '1차 시도';

      timerInterval = setInterval(updateTimer, 100);

      try {
        const response = await fetch('/api/harness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, apiKey, projectId })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let lastEvent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\\n');
          buffer = lines.pop() || '';

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('event: ')) {
              lastEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ') && lastEvent) {
              try {
                const data = JSON.parse(line.slice(6));
                handleSSEEvent(lastEvent, data);
              } catch(e) {}
              lastEvent = '';
            }
          }
        }
      } catch (err) {
        alert('오류: ' + err.message);
      } finally {
        clearInterval(timerInterval);
        isRunning = false;
        document.getElementById('run-btn').disabled = false;
        document.getElementById('run-btn').innerHTML = '<i class="fas fa-play"></i> Harness 실행 (피드백 루프)';
        document.getElementById('status-badge').classList.add('hidden');
        document.getElementById('status-badge').classList.remove('flex');
      }
    }

    function handleSSEEvent(event, data) {
      switch(event) {
        case 'start':
          document.getElementById('status-text').textContent = 'Harness 시작됨';
          break;

        case 'retry_event':
          renderRetryEvent(data);
          const nextAttempt = data.attempt + 1;
          document.getElementById('attempt-counter').textContent = nextAttempt + '차 시도 (재시도)';
          document.getElementById('status-text').textContent = data.attempt + '차 반려 → 재시도 중';
          break;

        case 'agent_complete':
          renderAgentCard(data);
          if (data.attempt) {
            document.getElementById('attempt-counter').textContent = data.attempt + '차 시도';
          }
          document.getElementById('status-text').textContent = data.agentName + ' 완료';
          break;

        case 'complete':
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          document.getElementById('final-report').textContent = data.finalReport;
          document.getElementById('report-stats').textContent =
            \`\${elapsed}s · 에이전트 \${data.agentsExecuted}개 · MCP: \${data.mcpToolsUsed.join(', ')}\`;
          document.getElementById('report-section').classList.remove('hidden');
          renderRetryReport(data.retryReport);
          document.getElementById('retry-report-section').scrollIntoView({ behavior: 'smooth' });
          break;

        case 'error':
          showGlobalError(data.message);
          break;
      }
    }
  </script>
</body>
</html>`;
}

export default app;
