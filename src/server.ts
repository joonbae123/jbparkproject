import { Hono } from "hono";
import { serve } from "@hono/node-server";
import api from "./routes/api.js";

const app = new Hono();
app.route("/api", api);
app.get("/", (c) => c.html(getHTML()));

const PORT = 3000;
console.log(`\n🚀 AI Harness + MCP Demo Server v3`);
console.log(`📍 http://localhost:${PORT}`);
console.log(`📡 API: http://localhost:${PORT}/api/health\n`);

serve({ fetch: app.fetch, port: PORT });

function getHTML(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Harness + MCP Demo v3</title>
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

    /* 슬라이더 커스텀 스타일 */
    input[type=range] { -webkit-appearance:none; appearance:none; height:6px; border-radius:3px; outline:none; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:18px; height:18px; border-radius:50%; background:#3b82f6; cursor:pointer; border:2px solid #1d4ed8; }
    input[type=range].unlimited::-webkit-slider-thumb { background:#a855f7; border-color:#7c3aed; }
    input[type=range].target-slider::-webkit-slider-thumb { background:#10b981; border-color:#059669; }
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
          <span class="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full ml-1">v3 커스텀 루프</span>
        </h1>
        <p class="text-xs text-gray-400 mt-1">재시도 횟수 · 목표 점수를 직접 설정하세요</p>
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
          <div class="text-gray-500 text-xs">점수 ≥ 목표? 승인/반려</div>
        </div>
        <div class="flex flex-col items-center gap-1">
          <div class="text-xs text-red-400 flex items-center gap-1"><i class="fas fa-redo text-xs"></i> 반려 → 재시도</div>
          <i class="fas fa-arrow-right text-gray-500"></i>
          <div class="text-xs text-green-400 flex items-center gap-1"><i class="fas fa-check text-xs"></i> 승인 → 진행</div>
        </div>
        <div class="bg-green-900/40 border border-green-600 rounded-lg px-3 py-2 text-center">
          <div class="text-green-300 font-medium">✨ Synthesizer</div>
          <div class="text-gray-500 text-xs">최종 보고서</div>
        </div>
      </div>
    </div>

    <!-- 입력 + 설정 섹션 -->
    <div class="bg-gray-900 rounded-xl p-5 border border-gray-700 space-y-4">
      <h2 class="text-sm font-semibold text-gray-300 flex items-center gap-2">
        <i class="fas fa-sliders-h text-blue-400"></i> 설정
      </h2>

      <!-- API Key -->
      <div>
        <label class="block text-xs text-gray-400 mb-1">OpenAI API Key</label>
        <input id="api-key" type="password" placeholder="sk-proj-... 또는 sk-..."
          class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"/>
      </div>

      <!-- 재시도 횟수 + 목표 점수 슬라이더 (2열) -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

        <!-- 옵션 A: 최대 재시도 횟수 -->
        <div class="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div class="flex items-center justify-between mb-2">
            <div class="text-xs font-semibold text-blue-300 flex items-center gap-1">
              <i class="fas fa-redo text-blue-400"></i> 옵션 A: 최대 재시도 횟수
            </div>
            <div id="retry-display" class="text-lg font-bold text-blue-400">3회</div>
          </div>
          <input id="max-retry" type="range" min="0" max="10" value="3" step="1"
            oninput="updateRetryDisplay(this.value)"
            class="w-full bg-gray-700"
            style="accent-color:#3b82f6"/>
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span class="text-purple-400 font-medium">0 = 무제한</span>
            <span>1</span><span>3</span><span>5</span><span>7</span><span>10</span>
          </div>
          <div id="retry-desc" class="text-xs text-gray-400 mt-2 min-h-[2.5rem] leading-relaxed">
            반려되어도 최대 3번까지 재시도합니다. 3번 모두 반려되면 강제 종료.
          </div>
        </div>

        <!-- 옵션 B: 목표 점수 -->
        <div class="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div class="flex items-center justify-between mb-2">
            <div class="text-xs font-semibold text-green-300 flex items-center gap-1">
              <i class="fas fa-bullseye text-green-400"></i> 옵션 B: 합격 기준 점수
            </div>
            <div id="score-display" class="text-lg font-bold text-green-400">80점</div>
          </div>
          <input id="target-score" type="range" min="0" max="100" value="80" step="5"
            oninput="updateScoreDisplay(this.value)"
            class="w-full bg-gray-700 target-slider"
            style="accent-color:#10b981"/>
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
          </div>
          <div id="score-desc" class="text-xs text-gray-400 mt-2 min-h-[2.5rem] leading-relaxed">
            Critic 평가 점수가 80점 이상이면 자동 승인. 80점 미만은 반려.
          </div>
        </div>
      </div>

      <!-- 쿼리 입력 -->
      <div>
        <label class="block text-xs text-gray-400 mb-1">리서치 쿼리</label>
        <div class="flex gap-2 flex-wrap mb-2">
          <button onclick="setQuery('AI Harness와 MCP의 미래 전망')" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-600">AI Harness 미래</button>
          <button onclick="setQuery('2024년 대규모 언어 모델 트렌드')" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-600">LLM 트렌드</button>
          <button onclick="setQuery('멀티 에이전트 시스템의 기업 활용 사례')" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-600">기업 활용사례</button>
        </div>
        <textarea id="query" rows="2" placeholder="리서치할 주제를 입력하세요..."
          class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 resize-none">AI Harness와 MCP의 미래 전망</textarea>
      </div>

      <!-- 실행 요약 배너 -->
      <div id="run-summary" class="bg-gray-800 rounded-lg px-4 py-2.5 border border-gray-600 flex items-center gap-3 flex-wrap text-xs text-gray-300">
        <i class="fas fa-info-circle text-blue-400"></i>
        <span>최대 <strong id="sum-retry" class="text-blue-300">3회</strong> 재시도 ·
        합격 기준 <strong id="sum-score" class="text-green-300">80점</strong> 이상 ·
        <span id="sum-mode" class="text-yellow-300">3번 반려 시 강제 종료</span></span>
      </div>

      <button id="run-btn" onclick="runHarness()"
        class="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
        <i class="fas fa-play"></i> Harness 실행
      </button>
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

        <!-- 요약 통계 4칸 -->
        <div id="retry-stats" class="grid grid-cols-4 gap-3"></div>

        <!-- 품질 점수 추이 -->
        <div id="quality-chart" class="hidden">
          <div class="text-xs text-gray-400 mb-2 font-medium flex items-center gap-2">
            <i class="fas fa-chart-bar text-blue-400"></i> 시도별 품질 점수 추이
            <span id="target-score-line" class="text-green-400 ml-auto"></span>
          </div>
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

  </div><!-- /max-w -->

  <script>
    let isRunning = false;
    let startTime = null;
    let timerInterval = null;

    function setQuery(t) { document.getElementById('query').value = t; }

    // ───────────────── 슬라이더 업데이트 ─────────────────
    function updateRetryDisplay(val) {
      const n = parseInt(val);
      const display = document.getElementById('retry-display');
      const desc    = document.getElementById('retry-desc');
      const btn     = document.getElementById('max-retry');

      if (n === 0) {
        display.textContent = '∞ 무제한';
        display.className = 'text-lg font-bold text-purple-400';
        btn.classList.add('unlimited');
        desc.textContent = '점수 목표를 달성할 때까지 계속 재시도합니다. 안전장치: 최대 10회.';
      } else {
        display.textContent = n + '회';
        display.className = 'text-lg font-bold text-blue-400';
        btn.classList.remove('unlimited');
        if (n === 1)      desc.textContent = '딱 1번만 시도합니다. 반려되면 바로 강제 종료.';
        else if (n <= 3)  desc.textContent = \`반려되어도 최대 \${n}번까지 재시도합니다. \${n}번 모두 반려되면 강제 종료.\`;
        else              desc.textContent = \`최대 \${n}번까지 재시도합니다. 많을수록 더 좋은 결과를 기대할 수 있지만 API 비용이 늘어납니다.\`;
      }
      updateSummary();
    }

    function updateScoreDisplay(val) {
      const n = parseInt(val);
      const display = document.getElementById('score-display');
      const desc    = document.getElementById('score-desc');

      let color = n >= 80 ? 'text-green-400' : n >= 60 ? 'text-yellow-400' : n >= 40 ? 'text-orange-400' : 'text-red-400';
      display.textContent = n + '점';
      display.className = 'text-lg font-bold ' + color;

      if (n === 0)       desc.textContent = '점수 0점 이상이면 무조건 승인. 사실상 항상 1차 통과.';
      else if (n <= 30)  desc.textContent = \`기준이 매우 낮습니다 (\${n}점). 대부분 1차에 통과될 거예요.\`;
      else if (n <= 60)  desc.textContent = \`기준이 낮습니다 (\${n}점). 보통 1~2차에 통과됩니다.\`;
      else if (n <= 79)  desc.textContent = \`적당한 기준 (\${n}점). 2~3차 시도가 필요할 수 있습니다.\`;
      else if (n <= 89)  desc.textContent = \`엄격한 기준 (\${n}점). 여러 번 재시도가 필요할 수 있습니다.\`;
      else if (n <= 95)  desc.textContent = \`매우 엄격한 기준 (\${n}점). 재시도 횟수를 넉넉히 설정하세요.\`;
      else               desc.textContent = \`극도로 엄격한 기준 (\${n}점). 거의 통과가 어려울 수 있습니다.\`;
      updateSummary();
    }

    function updateSummary() {
      const maxRetry     = parseInt(document.getElementById('max-retry').value);
      const targetScore  = parseInt(document.getElementById('target-score').value);

      document.getElementById('sum-retry').textContent  = maxRetry === 0 ? '무제한' : maxRetry + '회';
      document.getElementById('sum-score').textContent  = targetScore + '점';

      const modeEl = document.getElementById('sum-mode');
      if (maxRetry === 0) {
        modeEl.textContent = '목표 점수 달성까지 계속 재시도 (안전장치: 10회)';
        modeEl.className = 'text-purple-300';
      } else {
        modeEl.textContent = maxRetry + '번 반려 시 강제 종료';
        modeEl.className = 'text-yellow-300';
      }
    }

    // 페이지 로드 시 초기화
    updateRetryDisplay(3);
    updateScoreDisplay(80);

    // ───────────────── 타이머 ─────────────────
    function updateTimer() {
      if (!startTime) return;
      const e = ((Date.now() - startTime) / 1000).toFixed(1);
      document.getElementById('timer').textContent = e + 's 경과';
    }

    // ───────────────── 에이전트 카드 렌더링 ─────────────────
    function renderAgentCard(log) {
      const container = document.getElementById('agents-container');
      const existing  = document.getElementById('card-' + log.agentId);

      const attemptBadge = (log.attempt > 1)
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

      const durationHTML = log.duration
        ? \`<span class="text-xs text-gray-600 ml-auto">\${(log.duration/1000).toFixed(1)}s</span>\`
        : '';

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

      if (existing) { existing.outerHTML = html; }
      else          { container.insertAdjacentHTML('beforeend', html); }
    }

    // ───────────────── 반려 이벤트 카드 ─────────────────
    function renderRetryEvent(event) {
      document.getElementById('retry-report-section').classList.remove('hidden');
      const eventsContainer = document.getElementById('retry-events');

      const issuesHTML      = event.judgement.issues.map(i => \`<li class="text-red-300">\${i}</li>\`).join('');
      const suggestionsHTML = event.judgement.suggestions.map(s => \`<li class="text-blue-300">\${s}</li>\`).join('');

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

    // ───────────────── 최종 리포트 렌더링 ─────────────────
    function renderRetryReport(retryReport, targetScore) {
      document.getElementById('retry-report-section').classList.remove('hidden');

      // 강제 종료 여부 판별
      const forcedStop = retryReport.finalVerdict === 'rejected';

      // 4칸 통계
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
        <div class="bg-gray-800 rounded-lg p-3 text-center border border-blue-700">
          <div class="text-2xl font-bold text-blue-400">\${targetScore}점</div>
          <div class="text-xs text-gray-400 mt-1">합격 기준</div>
        </div>
        <div class="bg-gray-800 rounded-lg p-3 text-center border \${forcedStop ? 'border-orange-700' : 'border-green-700'}">
          <div class="text-2xl font-bold \${forcedStop ? 'text-orange-400' : 'text-green-400'}">
            \${forcedStop ? '⚠️' : '✅'}
          </div>
          <div class="text-xs text-gray-400 mt-1">\${forcedStop ? '강제 종료' : '정상 승인'}</div>
        </div>
      \`;

      // 품질 점수 추이 바 차트
      if (retryReport.qualityProgression.length > 0) {
        document.getElementById('quality-chart').classList.remove('hidden');
        document.getElementById('target-score-line').textContent = '● 합격 기준: ' + targetScore + '점';

        document.getElementById('quality-bars').innerHTML = retryReport.qualityProgression.map((score, i) => {
          const isLast  = i === retryReport.qualityProgression.length - 1;
          const passed  = score >= targetScore;
          const color   = passed ? 'bg-green-500' : score >= targetScore * 0.8 ? 'bg-yellow-500' : 'bg-red-500';
          const label   = isLast
            ? (forcedStop ? \`\${i+1}차 (강제종료)\` : \`\${i+1}차 (승인)\`)
            : \`\${i+1}차 (반려)\`;
          const badge   = passed
            ? '<span class="text-xs text-green-300 ml-2">✅ 통과</span>'
            : \`<span class="text-xs text-red-300 ml-2">❌ -\${targetScore - score}점 부족</span>\`;
          return \`
            <div class="flex items-center gap-3">
              <div class="text-xs text-gray-400 w-24 shrink-0">\${label}</div>
              <div class="flex-1 relative bg-gray-800 rounded-full h-5 overflow-hidden">
                <div class="\${color} h-5 rounded-full score-bar flex items-center justify-end pr-2"
                  style="width:\${score}%">
                  <span class="text-xs text-white font-bold">\${score}점</span>
                </div>
                <!-- 목표 기준선 -->
                <div class="absolute top-0 bottom-0 border-l-2 border-white/50 border-dashed"
                  style="left:\${targetScore}%"></div>
              </div>
              \${badge}
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

    // ───────────────── 전역 에러 ─────────────────
    function showGlobalError(msg) {
      const el = document.getElementById('global-error');
      document.getElementById('global-error-msg').textContent = msg;
      el.classList.remove('hidden');
      el.scrollIntoView({ behavior: 'smooth' });
    }

    // ───────────────── 메인 실행 ─────────────────
    async function runHarness() {
      if (isRunning) return;
      const apiKey      = document.getElementById('api-key').value.trim();
      const query       = document.getElementById('query').value.trim();
      const maxRetry    = parseInt(document.getElementById('max-retry').value);
      const targetScore = parseInt(document.getElementById('target-score').value);

      if (!apiKey)  { alert('OpenAI API Key를 입력하세요'); return; }
      if (!query)   { alert('리서치 쿼리를 입력하세요'); return; }

      isRunning = true;
      startTime = Date.now();

      // UI 초기화
      document.getElementById('run-btn').disabled = true;
      document.getElementById('run-btn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> 실행 중...';
      document.getElementById('pipeline-view').classList.remove('hidden');
      document.getElementById('report-section').classList.add('hidden');
      document.getElementById('retry-report-section').classList.add('hidden');
      document.getElementById('global-error').classList.add('hidden');
      document.getElementById('agents-container').innerHTML  = '';
      document.getElementById('retry-events').innerHTML      = '';
      document.getElementById('retry-stats').innerHTML       = '';
      document.getElementById('quality-bars').innerHTML      = '';
      document.getElementById('status-badge').classList.remove('hidden');
      document.getElementById('status-badge').classList.add('flex');
      document.getElementById('status-text').textContent = '에이전트 실행 중...';
      document.getElementById('attempt-counter').textContent = '1차 시도';
      timerInterval = setInterval(updateTimer, 100);

      try {
        const response = await fetch('/api/harness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, apiKey, maxRetry, targetScore })
        });

        const reader  = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '', lastEvent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event: '))       { lastEvent = line.slice(7).trim(); }
            else if (line.startsWith('data: ') && lastEvent) {
              try { handleSSEEvent(lastEvent, JSON.parse(line.slice(6)), targetScore); } catch(e) {}
              lastEvent = '';
            }
          }
        }
      } catch (err) {
        showGlobalError('네트워크 오류: ' + err.message);
      } finally {
        clearInterval(timerInterval);
        isRunning = false;
        document.getElementById('run-btn').disabled = false;
        document.getElementById('run-btn').innerHTML = '<i class="fas fa-play"></i> Harness 실행';
        document.getElementById('status-badge').classList.add('hidden');
        document.getElementById('status-badge').classList.remove('flex');
      }
    }

    // ───────────────── SSE 이벤트 핸들러 ─────────────────
    function handleSSEEvent(event, data, targetScore) {
      switch(event) {
        case 'start':
          document.getElementById('status-text').textContent = 'Harness 시작됨';
          break;

        case 'retry_event':
          renderRetryEvent(data);
          document.getElementById('attempt-counter').textContent = (data.attempt + 1) + '차 시도 (재시도)';
          document.getElementById('status-text').textContent = data.attempt + '차 반려 → 재시도 중';
          break;

        case 'agent_complete':
          renderAgentCard(data);
          if (data.attempt) {
            document.getElementById('attempt-counter').textContent = data.attempt + '차 시도';
          }
          document.getElementById('status-text').textContent = data.agentName + ' 완료';
          break;

        case 'complete': {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          document.getElementById('final-report').textContent = data.finalReport;
          document.getElementById('report-stats').textContent =
            \`\${elapsed}s · 에이전트 \${data.agentsExecuted}개 · MCP: \${data.mcpToolsUsed.join(', ')}\`;
          document.getElementById('report-section').classList.remove('hidden');
          renderRetryReport(data.retryReport, targetScore);
          document.getElementById('retry-report-section').scrollIntoView({ behavior: 'smooth' });
          break;
        }

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
