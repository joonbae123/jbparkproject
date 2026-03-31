import { Hono } from "hono";
import { serve } from "@hono/node-server";
import api from "./routes/api.js";

const app = new Hono();
app.route("/api", api);
app.get("/", (c) => c.html(getHTML()));

const PORT = 3000;
console.log(`\n🚀 AI Harness + MCP Demo Server v5 (완전 동적 워크플로우)`);
console.log(`📍 http://localhost:${PORT}`);
console.log(`📡 API: http://localhost:${PORT}/api/health\n`);

serve({ fetch: app.fetch, port: PORT });

function getHTML(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Harness v6 - 개발 자동화</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    @keyframes fadeInUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes pulse-border { 0%,100%{border-color:#3b82f6} 50%{border-color:#8b5cf6} }
    @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
    @keyframes slideRight { from{width:0} to{width:100%} }
    @keyframes brainPulse { 0%,100%{box-shadow:0 0 0 0 rgba(168,85,247,0.4)} 50%{box-shadow:0 0 0 8px rgba(168,85,247,0)} }
    .fade-in { animation: fadeInUp 0.35s ease-out; }
    .running-border { animation: pulse-border 1.5s infinite; border-width:2px; border-style:solid; }
    .rejected-shake { animation: shake 0.4s ease-out; }
    .brain-pulse { animation: brainPulse 1.5s infinite; }
    pre { white-space:pre-wrap; word-break:break-word; }
    .score-bar { transition: width 0.8s ease-out; }
    input[type=range] { -webkit-appearance:none; appearance:none; height:6px; border-radius:3px; outline:none; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:#3b82f6; cursor:pointer; border:2px solid #1d4ed8; }
    input[type=range].unlimited::-webkit-slider-thumb { background:#a855f7; border-color:#7c3aed; }
    input[type=range].target-slider::-webkit-slider-thumb { background:#10b981; border-color:#059669; }
    .decision-arrow { border-left: 2px dashed #6b7280; margin-left: 16px; padding-left: 12px; }
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
          <span class="text-xs bg-green-700 text-white px-2 py-0.5 rounded-full ml-1">v6 개발 자동화</span>
        </h1>
        <p class="text-xs text-gray-400 mt-1">Claude가 개발팀(PM·개발자·리뷰어·QA)을 조율 · 실제 코드 실행 검증</p>
      </div>
      <div id="status-badge" class="hidden items-center gap-2 bg-gray-800 px-3 py-1 rounded-full text-xs">
        <div class="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
        <span id="status-text">대기 중...</span>
      </div>
    </div>
  </div>

  <!-- 탭 네비게이션 -->
  <div class="bg-gray-900 border-b border-gray-700 px-6">
    <div class="max-w-5xl mx-auto flex gap-1">
      <button id="tab-research" onclick="switchTab('research')"
        class="tab-btn px-4 py-3 text-sm font-medium border-b-2 border-blue-500 text-blue-400">
        <i class="fas fa-search mr-1"></i>리서치 하네스 v5
      </button>
      <button id="tab-dev" onclick="switchTab('dev')"
        class="tab-btn px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-400 hover:text-gray-200">
        <i class="fas fa-code mr-1"></i>개발 하네스 v6 ✨
      </button>
    </div>
  </div>

  <!-- 리서치 하네스 섹션 -->
  <div id="section-research" class="max-w-5xl mx-auto px-6 py-6 space-y-5">

    <!-- v4 vs v5 비교 -->
    <div class="bg-gray-900 rounded-xl p-4 border border-purple-800">
      <h2 class="text-xs font-semibold text-purple-300 mb-3 flex items-center gap-2">
        <i class="fas fa-code-branch text-purple-400"></i> v4 vs v5 핵심 차이
      </h2>
      <div class="grid grid-cols-2 gap-3 text-xs">
        <div class="bg-gray-800 rounded-lg p-3 border border-gray-600">
          <div class="text-gray-400 font-semibold mb-2">⬅ v4 (반정적)</div>
          <div class="text-gray-500 space-y-1">
            <div>① Claude: steps[] 배열 한번에 생성</div>
            <div>② 그 배열을 순서대로 실행</div>
            <div class="text-red-400 mt-1">계획은 동적, 실행은 고정</div>
          </div>
        </div>
        <div class="bg-purple-900/30 rounded-lg p-3 border border-purple-700">
          <div class="text-purple-300 font-semibold mb-2">➡ v5 (완전 동적) ✨</div>
          <div class="text-gray-300 space-y-1">
            <div>① Claude: 첫 에이전트만 결정</div>
            <div>② 에이전트 완료 후 <strong>결과를 보고</strong> 다음 결정</div>
            <div class="text-green-400 mt-1">결과에 따라 계획이 바뀜</div>
          </div>
        </div>
      </div>
      <div class="mt-3 text-xs text-gray-500 bg-gray-800 rounded p-2">
        <span class="text-yellow-400">예시:</span>
        Researcher 결과가 풍부 → Claude: "Analyst 건너뛰고 바로 Critic" |
        결과가 빈약 → Claude: "Researcher 한번 더, 다른 각도로"
      </div>
    </div>

    <!-- 설정 -->
    <div class="bg-gray-900 rounded-xl p-5 border border-gray-700 space-y-4">
      <h2 class="text-sm font-semibold text-gray-300 flex items-center gap-2">
        <i class="fas fa-sliders-h text-blue-400"></i> 설정
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-gray-400 mb-1">
            <i class="fas fa-key text-green-400 mr-1"></i>OpenAI API Key <span class="text-gray-600">(에이전트용)</span>
          </label>
          <input id="api-key" type="password" placeholder="sk-proj-... 또는 sk-..."
            class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-green-500"/>
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">
            <i class="fas fa-key text-purple-400 mr-1"></i>Anthropic API Key <span class="text-gray-600">(Claude 동적 결정용)</span>
          </label>
          <input id="anthropic-key" type="password" placeholder="sk-ant-..."
            class="w-full bg-gray-800 border border-purple-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500"/>
          <div class="text-xs text-gray-600 mt-1">비워두면 기본 코드 순서로 실행</div>
        </div>
      </div>

      <!-- 슬라이더 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div class="flex items-center justify-between mb-2">
            <div class="text-xs font-semibold text-blue-300"><i class="fas fa-redo mr-1"></i>최대 재시도 횟수</div>
            <div id="retry-display" class="text-lg font-bold text-blue-400">3회</div>
          </div>
          <input id="max-retry" type="range" min="0" max="10" value="3" step="1"
            oninput="updateRetryDisplay(this.value)" class="w-full bg-gray-700" style="accent-color:#3b82f6"/>
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span class="text-purple-400">0=무제한</span><span>1</span><span>3</span><span>5</span><span>7</span><span>10</span>
          </div>
          <div id="retry-desc" class="text-xs text-gray-400 mt-2 min-h-[2rem]"></div>
        </div>
        <div class="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div class="flex items-center justify-between mb-2">
            <div class="text-xs font-semibold text-green-300"><i class="fas fa-bullseye mr-1"></i>합격 기준 점수</div>
            <div id="score-display" class="text-lg font-bold text-green-400">80점</div>
          </div>
          <input id="target-score" type="range" min="0" max="100" value="80" step="5"
            oninput="updateScoreDisplay(this.value)" class="w-full bg-gray-700 target-slider" style="accent-color:#10b981"/>
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
          </div>
          <div id="score-desc" class="text-xs text-gray-400 mt-2 min-h-[2rem]"></div>
        </div>
      </div>

      <!-- 쿼리 -->
      <div>
        <label class="block text-xs text-gray-400 mb-1">리서치 쿼리</label>
        <div class="flex gap-2 flex-wrap mb-2">
          <button onclick="setQuery('AI Harness와 MCP의 미래 전망')" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-600">AI Harness</button>
          <button onclick="setQuery('2024년 대규모 언어 모델 트렌드')" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-600">LLM 트렌드</button>
          <button onclick="setQuery('멀티 에이전트 시스템의 기업 활용 사례')" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-600">기업 활용</button>
          <button onclick="setQuery('양자컴퓨팅 최신 동향')" class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-600">양자컴퓨팅</button>
        </div>
        <textarea id="query" rows="2" placeholder="리서치할 주제를 입력하세요..."
          class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 resize-none">AI Harness와 MCP의 미래 전망</textarea>
      </div>

      <!-- 실행 요약 -->
      <div class="bg-gray-800 rounded-lg px-4 py-2.5 border border-gray-600 flex items-center gap-3 flex-wrap text-xs text-gray-300">
        <i class="fas fa-info-circle text-blue-400"></i>
        <span>최대 <strong id="sum-retry" class="text-blue-300">3회</strong> 재시도 ·
        합격 <strong id="sum-score" class="text-green-300">80점</strong> 이상 ·
        <span id="sum-mode" class="text-yellow-300">3번 반려 시 강제 종료</span></span>
      </div>

      <button id="run-btn" onclick="runHarness()"
        class="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
        <i class="fas fa-play"></i> Harness v5 실행 (Claude 동적 결정)
      </button>
    </div>

    <!-- Claude 전략 표시 -->
    <div id="strategy-section" class="hidden fade-in">
      <div class="flex items-center gap-2 mb-3">
        <div id="brain-icon" class="w-8 h-8 bg-purple-700 rounded-full flex items-center justify-center brain-pulse">
          <i class="fas fa-brain text-white text-sm"></i>
        </div>
        <h2 class="text-sm font-semibold text-purple-300">Claude의 동적 판단 흐름</h2>
        <span class="text-xs text-gray-500 ml-auto" id="decision-count"></span>
      </div>
      <div class="bg-gray-900 border border-purple-800 rounded-xl p-4 space-y-3">
        <!-- 전체 전략 -->
        <div class="bg-purple-900/20 rounded-lg p-3 border border-purple-900">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-purple-400 text-xs font-semibold">전체 전략</span>
            <span id="complexity-badge" class="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300"></span>
          </div>
          <div id="overall-strategy" class="text-xs text-gray-300 leading-relaxed"></div>
        </div>
        <!-- 결정 흐름 (실시간 추가) -->
        <div id="decision-flow" class="space-y-2"></div>
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
        <div id="retry-stats" class="grid grid-cols-4 gap-3"></div>
        <div id="quality-chart" class="hidden">
          <div class="text-xs text-gray-400 mb-2 font-medium flex items-center gap-2">
            <i class="fas fa-chart-bar text-blue-400"></i> 시도별 품질 점수 추이
            <span id="target-score-line" class="text-green-400 ml-auto"></span>
          </div>
          <div id="quality-bars" class="space-y-2"></div>
        </div>
        <div id="retry-events" class="space-y-3"></div>
        <div id="improvement-summary" class="hidden bg-gray-800 rounded-lg p-3">
          <div class="text-xs text-gray-400 font-medium mb-1"><i class="fas fa-chart-line text-green-400 mr-1"></i>개선 과정 요약</div>
          <div id="improvement-text" class="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap"></div>
        </div>
      </div>
    </div>

    <!-- 에러 -->
    <div id="global-error" class="hidden fade-in bg-red-950 border border-red-700 rounded-xl p-4">
      <div class="flex items-start gap-3">
        <i class="fas fa-exclamation-circle text-red-400 mt-0.5 text-lg"></i>
        <div>
          <div class="text-sm font-semibold text-red-300 mb-1">실행 오류 발생</div>
          <div id="global-error-msg" class="text-xs text-red-200 font-mono leading-relaxed"></div>
          <div class="mt-2 text-xs text-gray-400">
            💡 OpenAI: <a href="https://platform.openai.com/api-keys" target="_blank" class="text-blue-400 underline">platform.openai.com/api-keys</a> ·
            Anthropic: <a href="https://console.anthropic.com/settings/keys" target="_blank" class="text-purple-400 underline">console.anthropic.com</a>
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
    let decisionCount = 0;

    function setQuery(t) { document.getElementById('query').value = t; }
    function updateTimer() {
      if (!startTime) return;
      document.getElementById('timer').textContent = ((Date.now()-startTime)/1000).toFixed(1)+'s';
    }

    function updateRetryDisplay(val) {
      const n = parseInt(val);
      const display = document.getElementById('retry-display');
      if (n === 0) {
        display.textContent = '∞ 무제한'; display.className = 'text-lg font-bold text-purple-400';
        document.getElementById('max-retry').classList.add('unlimited');
        document.getElementById('retry-desc').textContent = '목표 점수 달성까지 계속 재시도 (안전장치 10회)';
      } else {
        display.textContent = n+'회'; display.className = 'text-lg font-bold text-blue-400';
        document.getElementById('max-retry').classList.remove('unlimited');
        document.getElementById('retry-desc').textContent = n===1?'딱 1번만 시도.':\`최대 \${n}번 재시도.\`;
      }
      updateSummary();
    }
    function updateScoreDisplay(val) {
      const n = parseInt(val);
      const c = n>=80?'text-green-400':n>=60?'text-yellow-400':n>=40?'text-orange-400':'text-red-400';
      document.getElementById('score-display').textContent = n+'점';
      document.getElementById('score-display').className = 'text-lg font-bold '+c;
      document.getElementById('score-desc').textContent =
        n===0?'항상 통과.':n<=30?'기준 매우 낮음.':n<=60?'기준 낮음.':n<=79?'적당한 기준.':n<=89?'엄격한 기준.':'극도로 엄격.';
      updateSummary();
    }
    function updateSummary() {
      const r = parseInt(document.getElementById('max-retry').value);
      const s = parseInt(document.getElementById('target-score').value);
      document.getElementById('sum-retry').textContent = r===0?'무제한':r+'회';
      document.getElementById('sum-score').textContent = s+'점';
      const m = document.getElementById('sum-mode');
      if (r===0) { m.textContent='목표 점수 달성까지 계속'; m.className='text-purple-300'; }
      else { m.textContent=r+'번 반려 시 강제 종료'; m.className='text-yellow-300'; }
    }
    updateRetryDisplay(3); updateScoreDisplay(80);

    // ── Claude 전략 표시 ──
    function renderStrategy(data) {
      document.getElementById('strategy-section').classList.remove('hidden');
      document.getElementById('overall-strategy').textContent = data.overallStrategy;
      const cMap = { low:'🟢 단순', medium:'🟡 보통', high:'🔴 복잡' };
      const cColor = { low:'bg-green-900 text-green-300', medium:'bg-yellow-900 text-yellow-300', high:'bg-red-900 text-red-300' };
      const c = data.estimatedComplexity || 'medium';
      document.getElementById('complexity-badge').textContent = cMap[c] || c;
      document.getElementById('complexity-badge').className = 'text-xs px-2 py-0.5 rounded-full ' + (cColor[c] || 'bg-gray-700 text-gray-300');
    }

    // ── Claude 결정 흐름 (핵심 v5 UI) ──
    function renderDecision(data) {
      decisionCount++;
      document.getElementById('decision-count').textContent = \`결정 \${decisionCount}회\`;
      const flow = document.getElementById('decision-flow');

      const roleColors = {
        researcher: 'bg-blue-900/40 border-blue-700 text-blue-300',
        analyst:    'bg-purple-900/40 border-purple-700 text-purple-300',
        critic:     'bg-yellow-900/40 border-yellow-700 text-yellow-300',
        synthesizer:'bg-green-900/40 border-green-700 text-green-300'
      };
      const roleEmojis = { researcher:'🔍', analyst:'📊', critic:'⚖️', synthesizer:'✨' };
      const roleNames = { researcher:'Researcher', analyst:'Analyst', critic:'Critic', synthesizer:'Synthesizer' };

      const role = data.decision.nextRole;
      const isJudge = data.decision.isJudge;
      const colorClass = roleColors[role] || 'bg-gray-800 border-gray-600 text-gray-300';

      flow.insertAdjacentHTML('beforeend', \`
        <div class="fade-in flex items-start gap-2">
          <div class="text-xs text-purple-400 font-bold w-6 shrink-0 pt-1.5 text-center">\${data.stepNumber}</div>
          <div class="flex-1 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <div class="border rounded-lg px-2.5 py-1.5 text-xs font-semibold \${colorClass}">
                \${roleEmojis[role] || ''} \${roleNames[role] || role}\${isJudge ? ' (판정)' : ''}
              </div>
              \${data.completedCount > 0 ? \`<span class="text-xs text-gray-600">완료된 에이전트 \${data.completedCount}개 기반 결정</span>\` : '<span class="text-xs text-gray-600">초기 결정</span>'}
            </div>
            <div class="text-xs text-gray-500 italic pl-1">
              <i class="fas fa-comment text-purple-700 mr-1"></i>\${data.decision.reasoning}
            </div>
          </div>
        </div>
      \`);
    }

    // ── 에이전트 카드 ──
    function renderAgentCard(log) {
      const container = document.getElementById('agents-container');
      const existing = document.getElementById('card-'+log.agentId);
      const attemptBadge = (log.attempt>1) ? \`<span class="text-xs bg-orange-900 text-orange-300 px-1.5 py-0.5 rounded ml-1">\${log.attempt}차</span>\` : '';
      const statusColors = {
        idle:'border-gray-600', running:'border-blue-500 running-border',
        tool_calling:'border-yellow-500 running-border',
        completed: log.agentRole==='critic'?(log.message.includes('반려')?'border-red-700 rejected-shake':'border-green-700'):'border-green-700',
        error:'border-red-700'
      };
      const statusIcons = {
        idle:'<i class="fas fa-circle text-gray-600"></i>',
        running:'<i class="fas fa-spinner fa-spin text-blue-400"></i>',
        tool_calling:'<i class="fas fa-plug fa-pulse text-yellow-400"></i>',
        completed: log.message.includes('반려') ? '<i class="fas fa-times-circle text-red-400"></i>' : '<i class="fas fa-check-circle text-green-400"></i>',
        error:'<i class="fas fa-times-circle text-red-400"></i>'
      };
      const roleColors = {
        researcher:'text-blue-300', analyst:'text-purple-300',
        critic: log.message.includes('반려')?'text-red-300':'text-yellow-300',
        synthesizer:'text-green-300'
      };
      const toolCallHTML = log.toolCalls?.length > 0 ? \`
        <div class="mt-2 space-y-1">\${log.toolCalls.map(tc=>\`
          <div class="bg-gray-950 rounded p-2 text-xs">
            <div class="text-blue-300 font-mono mb-1"><i class="fas fa-plug text-xs mr-1"></i>MCP: \${tc.toolName}</div>
            <details><summary class="text-gray-500 cursor-pointer text-xs">결과 보기</summary>
              <pre class="text-gray-400 mt-1 text-xs">\${tc.result}</pre></details>
          </div>\`).join('')}
        </div>\` : '';
      const errorHTML = log.status==='error' ? \`
        <div class="mt-2 bg-red-950 border border-red-800 rounded p-2 text-xs text-red-300">
          <div class="font-semibold mb-1">❌ 에러:</div><div class="font-mono">\${log.output||log.message}</div>
        </div>\` : '';
      const outputHTML = log.output && log.status!=='error' ? \`
        <details class="mt-2" \${log.agentRole==='synthesizer'?'open':''}>
          <summary class="text-gray-400 cursor-pointer hover:text-gray-200 text-xs">
            <i class="fas fa-comment-alt text-xs"></i> 에이전트 출력</summary>
          <div class="mt-1 bg-gray-950 rounded p-2 text-xs text-gray-300 leading-relaxed">\${log.output.replace(/\\n/g,'<br>')}</div>
        </details>\` : '';
      const durationHTML = log.duration ? \`<span class="text-xs text-gray-600 ml-auto">\${(log.duration/1000).toFixed(1)}s</span>\` : '';
      const html = \`
        <div id="card-\${log.agentId}" class="fade-in bg-gray-900 rounded-lg p-4 border \${statusColors[log.status]||'border-gray-700'}">
          <div class="flex items-center gap-2">
            \${statusIcons[log.status]||''}
            <span class="font-medium text-sm \${roleColors[log.agentRole]||'text-gray-300'}">\${log.agentName}</span>
            \${attemptBadge}
            <span class="text-xs text-gray-500">\${log.message}</span>
            \${durationHTML}
          </div>
          \${errorHTML}\${toolCallHTML}\${outputHTML}
        </div>\`;
      if (existing) existing.outerHTML = html;
      else container.insertAdjacentHTML('beforeend', html);
    }

    // ── 반려 이벤트 ──
    function renderRetryEvent(event) {
      document.getElementById('retry-report-section').classList.remove('hidden');
      const issuesHTML = event.judgement.issues.map(i=>\`<li class="text-red-300">\${i}</li>\`).join('');
      const suggestionsHTML = event.judgement.suggestions.map(s=>\`<li class="text-blue-300">\${s}</li>\`).join('');
      document.getElementById('retry-events').insertAdjacentHTML('beforeend', \`
        <div class="fade-in bg-red-950/30 border border-red-800 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-3">
            <i class="fas fa-times-circle text-red-400"></i>
            <span class="text-sm font-semibold text-red-300">\${event.attempt}차 반려</span>
            <span class="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full ml-auto">점수: \${event.judgement.score}점</span>
          </div>
          <div class="text-xs text-gray-300 mb-2"><span class="text-gray-500">이유:</span> \${event.judgement.reason}</div>
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div><div class="text-gray-500 mb-1">문제점</div><ul class="space-y-1 list-disc list-inside">\${issuesHTML}</ul></div>
            <div><div class="text-gray-500 mb-1">개선 제안</div><ul class="space-y-1 list-disc list-inside">\${suggestionsHTML}</ul></div>
          </div>
        </div>\`);
    }

    // ── 최종 리포트 ──
    function renderRetryReport(retryReport, targetScore) {
      document.getElementById('retry-report-section').classList.remove('hidden');
      const forcedStop = retryReport.finalVerdict === 'rejected';
      document.getElementById('retry-stats').innerHTML = \`
        <div class="bg-gray-800 rounded-lg p-3 text-center border border-gray-600">
          <div class="text-2xl font-bold text-white">\${retryReport.totalAttempts}</div>
          <div class="text-xs text-gray-400 mt-1">총 시도</div>
        </div>
        <div class="bg-gray-800 rounded-lg p-3 text-center border \${retryReport.totalRejections>0?'border-red-700':'border-green-700'}">
          <div class="text-2xl font-bold \${retryReport.totalRejections>0?'text-red-400':'text-green-400'}">\${retryReport.totalRejections}</div>
          <div class="text-xs text-gray-400 mt-1">반려 횟수</div>
        </div>
        <div class="bg-gray-800 rounded-lg p-3 text-center border border-blue-700">
          <div class="text-2xl font-bold text-blue-400">\${targetScore}점</div>
          <div class="text-xs text-gray-400 mt-1">합격 기준</div>
        </div>
        <div class="bg-gray-800 rounded-lg p-3 text-center border \${forcedStop?'border-orange-700':'border-green-700'}">
          <div class="text-2xl font-bold \${forcedStop?'text-orange-400':'text-green-400'}">\${forcedStop?'⚠️':'✅'}</div>
          <div class="text-xs text-gray-400 mt-1">\${forcedStop?'강제 종료':'정상 승인'}</div>
        </div>\`;

      if (retryReport.qualityProgression.length > 0) {
        document.getElementById('quality-chart').classList.remove('hidden');
        document.getElementById('target-score-line').textContent = '● 합격 기준: '+targetScore+'점';
        document.getElementById('quality-bars').innerHTML = retryReport.qualityProgression.map((score,i) => {
          const isLast = i===retryReport.qualityProgression.length-1;
          const passed = score>=targetScore;
          const color = passed?'bg-green-500':score>=targetScore*0.8?'bg-yellow-500':'bg-red-500';
          const label = isLast?(forcedStop?\`\${i+1}차(강제)\`:\`\${i+1}차(승인)\`):\`\${i+1}차(반려)\`;
          const badge = passed?\`<span class="text-xs text-green-300 ml-2">✅ 통과</span>\`:\`<span class="text-xs text-red-300 ml-2">❌ -\${targetScore-score}점</span>\`;
          return \`<div class="flex items-center gap-3">
            <div class="text-xs text-gray-400 w-24 shrink-0">\${label}</div>
            <div class="flex-1 relative bg-gray-800 rounded-full h-5 overflow-hidden">
              <div class="\${color} h-5 rounded-full score-bar flex items-center justify-end pr-2" style="width:\${score}%">
                <span class="text-xs text-white font-bold">\${score}점</span>
              </div>
              <div class="absolute top-0 bottom-0 border-l-2 border-white/50 border-dashed" style="left:\${targetScore}%"></div>
            </div>\${badge}
          </div>\`;
        }).join('');
      }

      if (retryReport.improvementSummary) {
        document.getElementById('improvement-summary').classList.remove('hidden');
        document.getElementById('improvement-text').textContent = retryReport.improvementSummary;
      }
    }

    function showGlobalError(msg) {
      const el = document.getElementById('global-error');
      document.getElementById('global-error-msg').textContent = msg;
      el.classList.remove('hidden');
      el.scrollIntoView({ behavior:'smooth' });
    }

    // ── 메인 실행 ──
    async function runHarness() {
      if (isRunning) return;
      const apiKey       = document.getElementById('api-key').value.trim();
      const anthropicKey = document.getElementById('anthropic-key').value.trim();
      const query        = document.getElementById('query').value.trim();
      const maxRetry     = parseInt(document.getElementById('max-retry').value);
      const targetScore  = parseInt(document.getElementById('target-score').value);

      if (!apiKey) { alert('OpenAI API Key를 입력하세요'); return; }
      if (!query)  { alert('리서치 쿼리를 입력하세요'); return; }

      isRunning = true; startTime = Date.now(); decisionCount = 0;
      document.getElementById('run-btn').disabled = true;
      document.getElementById('run-btn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> 실행 중...';
      document.getElementById('pipeline-view').classList.remove('hidden');
      document.getElementById('strategy-section').classList.add('hidden');
      document.getElementById('report-section').classList.add('hidden');
      document.getElementById('retry-report-section').classList.add('hidden');
      document.getElementById('global-error').classList.add('hidden');
      document.getElementById('agents-container').innerHTML = '';
      document.getElementById('retry-events').innerHTML = '';
      document.getElementById('retry-stats').innerHTML = '';
      document.getElementById('quality-bars').innerHTML = '';
      document.getElementById('decision-flow').innerHTML = '';
      document.getElementById('decision-count').textContent = '';
      document.getElementById('status-badge').classList.remove('hidden');
      document.getElementById('status-badge').classList.add('flex');
      document.getElementById('status-text').textContent = anthropicKey ? 'Claude 판단 중...' : '에이전트 실행 중...';
      document.getElementById('attempt-counter').textContent = '1차 시도';
      timerInterval = setInterval(updateTimer, 100);

      try {
        const response = await fetch('/api/harness', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ query, apiKey, anthropicKey, maxRetry, targetScore })
        });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '', lastEvent = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream:true });
          const lines = buffer.split('\\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('event: '))      { lastEvent = line.slice(7).trim(); }
            else if (line.startsWith('data: ') && lastEvent) {
              try { handleSSEEvent(lastEvent, JSON.parse(line.slice(6)), targetScore); } catch(e) {}
              lastEvent = '';
            }
          }
        }
      } catch(err) {
        showGlobalError('네트워크 오류: ' + err.message);
      } finally {
        clearInterval(timerInterval);
        isRunning = false;
        document.getElementById('run-btn').disabled = false;
        document.getElementById('run-btn').innerHTML = '<i class="fas fa-play"></i> Harness v5 실행 (Claude 동적 결정)';
        document.getElementById('status-badge').classList.add('hidden');
        document.getElementById('status-badge').classList.remove('flex');
        document.getElementById('brain-icon')?.classList.remove('brain-pulse');
      }
    }

    // ── SSE 핸들러 ──
    function handleSSEEvent(event, data, targetScore) {
      switch(event) {
        case 'start':
          document.getElementById('status-text').textContent = 'Harness 시작됨';
          break;
        case 'strategy':
          renderStrategy(data);
          document.getElementById('status-text').textContent = 'Claude 전략 수립 완료';
          break;
        case 'decision':
          renderDecision(data);
          document.getElementById('status-text').textContent = \`Claude: \${data.decision.nextRole} 결정\`;
          break;
        case 'retry_event':
          renderRetryEvent(data);
          document.getElementById('attempt-counter').textContent = (data.attempt+1)+'차 (재시도)';
          document.getElementById('status-text').textContent = data.attempt+'차 반려 → 재시도';
          break;
        case 'agent_complete':
          renderAgentCard(data);
          if (data.attempt) document.getElementById('attempt-counter').textContent = data.attempt+'차 시도';
          document.getElementById('status-text').textContent = data.agentName + ' 완료 → Claude 재판단';
          break;
        case 'complete': {
          const elapsed = ((Date.now()-startTime)/1000).toFixed(1);
          document.getElementById('final-report').textContent = data.finalReport;
          document.getElementById('report-stats').textContent =
            \`\${elapsed}s · 에이전트 \${data.agentsExecuted}개 · Claude 결정 \${decisionCount}회 · MCP: \${data.mcpToolsUsed.join(', ')}\`;
          document.getElementById('report-section').classList.remove('hidden');
          renderRetryReport(data.retryReport, targetScore);
          document.getElementById('retry-report-section').scrollIntoView({ behavior:'smooth' });
          break;
        }
        case 'error':
          showGlobalError(data.message);
          break;
      }
    }
  </script>

  <!-- 개발 하네스 섹션 v6 대형 프로젝트 모드 -->
  <div id="section-dev" class="hidden max-w-5xl mx-auto px-6 py-6 space-y-5">

    <!-- 설명 카드 -->
    <div class="bg-gray-900 rounded-xl p-4 border border-green-800">
      <h2 class="text-xs font-semibold text-green-300 mb-3 flex items-center gap-2">
        <i class="fas fa-project-diagram text-green-400"></i>
        개발 하네스 v6 — 대형 프로젝트 모드 · AI가 태스크를 쪼개고, 코드를 짜고, 실행하고, 고칩니다
      </h2>
      <div class="grid grid-cols-4 gap-2 text-xs">
        <div class="bg-gray-800 rounded-lg p-3 border border-gray-600 text-center">
          <div class="text-xl mb-1">🗂️</div>
          <div class="text-yellow-300 font-semibold">TaskDecomposer</div>
          <div class="text-gray-400 mt-1">요청을 3~8개<br/>독립 태스크로 분해</div>
        </div>
        <div class="bg-gray-800 rounded-lg p-3 border border-gray-600 text-center">
          <div class="text-xl mb-1">💻</div>
          <div class="text-blue-300 font-semibold">Developer</div>
          <div class="text-gray-400 mt-1">파일별 코드 작성<br/>Node.js 실행 검증</div>
        </div>
        <div class="bg-gray-800 rounded-lg p-3 border border-gray-600 text-center">
          <div class="text-xl mb-1">🔍</div>
          <div class="text-purple-300 font-semibold">Reviewer</div>
          <div class="text-gray-400 mt-1">코드 품질 검토<br/>0~100점 평가</div>
        </div>
        <div class="bg-gray-800 rounded-lg p-3 border border-green-700 text-center">
          <div class="text-xl mb-1">📦</div>
          <div class="text-green-300 font-semibold">ZIP 다운로드</div>
          <div class="text-gray-400 mt-1">전체 파일을<br/>한 번에 다운로드</div>
        </div>
      </div>
      <div class="mt-2 text-xs text-gray-500 bg-gray-800 rounded p-2">
        <span class="text-green-400">v6 핵심:</span>
        큰 요청 → <strong class="text-white">태스크 분해</strong> → 파일별 <strong class="text-white">코드 작성+실행</strong> → 전체 <strong class="text-white">ZIP 패키징</strong>
        — "이걸 어떻게 실행하나요?" → <strong class="text-green-300">ZIP에 README.md 포함</strong>
      </div>
    </div>

    <!-- 입력 폼 -->
    <div class="bg-gray-900 rounded-xl p-5 border border-gray-700 space-y-4">
      <h2 class="text-sm font-semibold text-gray-300 flex items-center gap-2">
        <i class="fas fa-terminal text-green-400"></i> 개발 요청
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-gray-400 mb-1">
            <i class="fas fa-key text-green-400 mr-1"></i>OpenAI API Key
            <span class="text-gray-600">(Developer·Reviewer 에이전트)</span>
          </label>
          <input id="dev-api-key" type="password" placeholder="sk-proj-..."
            class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-green-500"/>
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">
            <i class="fas fa-key text-purple-400 mr-1"></i>Anthropic API Key
            <span class="text-gray-600">(TaskDecomposer·오케스트레이터 — 선택)</span>
          </label>
          <input id="dev-anthropic-key" type="password" placeholder="sk-ant-..."
            class="w-full bg-gray-800 border border-purple-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500"/>
          <div class="text-xs text-gray-600 mt-1">비워두면 GPT-4o-mini로 태스크 분해</div>
        </div>
      </div>

      <!-- 빠른 예시 -->
      <div>
        <div class="text-xs text-gray-500 mb-2">예시 요청:</div>
        <div class="flex flex-wrap gap-2">
          <button onclick="setDevRequest('숫자 배열을 받아 버블 정렬하는 함수를 구현해줘. 오름차순/내림차순 옵션 포함.')"
            class="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded text-xs transition-colors">
            🔢 배열 정렬
          </button>
          <button onclick="setDevRequest('문자열에서 한글/영어/숫자 각각의 글자 수를 세는 함수를 구현해줘. 공백은 제외.')"
            class="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded text-xs transition-colors">
            📝 문자열 분석
          </button>
          <button onclick="setDevRequest('간단한 계산기를 구현해줘. 덧셈, 뺄셈, 곱셈, 나눗셈. 0으로 나누기 에러 처리 포함.')"
            class="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded text-xs transition-colors">
            🧮 계산기 모듈
          </button>
          <button onclick="setDevRequest('MES 작업자별 시간 활용도(Time Utilization Rate)를 계산하는 함수를 구현해줘. 총 근무시간 대비 실제 작업시간 비율. 이상값(0% 미만, 100% 초과) 필터링 포함. 그리고 작업 효율(Work Efficiency)도 함께 계산해줘: 실제 생산량 / 이론 생산량.')"
            class="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded text-xs transition-colors">
            🏭 MES KPI 계산기
          </button>
          <button onclick="setDevRequest('학생 성적 데이터를 입력받아 평균, 중앙값, 표준편차를 계산하고, A~F 학점을 부여하는 시스템을 구현해줘. 결과를 콘솔에 표로 출력.')"
            class="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded text-xs transition-colors">
            📊 성적 처리 시스템
          </button>
        </div>
      </div>

      <div>
        <label class="block text-xs text-gray-400 mb-1">개발 요청 내용</label>
        <textarea id="dev-request" rows="4"
          placeholder="어떤 코드를 만들까요? 복잡한 프로젝트도 OK — AI가 자동으로 작은 태스크들로 분해합니다.&#10;예: 'MES 분석 시스템 구현. KPI 계산(시간 활용도·작업 효율), Grade 분류(A~F), 통계 리포트 출력'"
          class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-green-500 resize-none"></textarea>
      </div>

      <button id="dev-run-btn" onclick="runDevHarness()"
        class="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
        <i class="fas fa-rocket"></i>
        개발 하네스 실행 — AI가 태스크를 분해하고 파일을 생성합니다
      </button>
    </div>

    <!-- 진행 상황 -->
    <div id="dev-progress-section" class="hidden space-y-4">

      <!-- 세션 헤더 + 상태바 -->
      <div class="bg-gray-900 rounded-xl p-4 border border-gray-700">
        <div class="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div>
            <div class="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <i class="fas fa-folder-open text-yellow-400"></i>
              <span id="dev-project-name-header">작업 세션</span>
              <span id="dev-session-id" class="text-xs text-gray-500 font-mono"></span>
            </div>
            <div class="mt-1 flex gap-4 text-xs text-gray-400">
              <span>태스크: <strong id="dev-task-progress" class="text-white">0/0</strong></span>
              <span>파일: <strong id="dev-file-count" class="text-green-400">0</strong>개</span>
              <span id="dev-tech-stack-badge" class="text-gray-600"></span>
            </div>
          </div>
          <!-- 다운로드 버튼 (완료 시 표시) -->
          <a id="dev-download-btn" href="#" target="_blank"
            class="hidden items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <i class="fas fa-download"></i> ZIP 다운로드
          </a>
        </div>
        <!-- 태스크 진행바 -->
        <div class="w-full bg-gray-800 rounded-full h-1.5">
          <div id="dev-progress-bar" class="bg-green-500 h-1.5 rounded-full transition-all duration-500" style="width:0%"></div>
        </div>
      </div>

      <!-- TaskDecomposer 결과 -->
      <div id="dev-task-list" class="hidden bg-gray-900 rounded-xl border border-yellow-800 overflow-hidden">
        <div class="px-4 py-3 border-b border-yellow-800/50 flex items-center gap-2 bg-yellow-900/10">
          <i class="fas fa-list-check text-yellow-400"></i>
          <span class="text-sm font-semibold text-yellow-300">🗂️ 태스크 분해 결과</span>
          <span id="dev-decompose-meta" class="text-xs text-gray-500 ml-auto"></span>
        </div>
        <div id="dev-task-items" class="p-3 grid grid-cols-1 gap-2"></div>
      </div>

      <!-- 실행 로그 -->
      <div class="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
          <i class="fas fa-terminal text-green-400"></i>
          <span class="text-sm font-semibold text-gray-300">실행 로그</span>
          <span class="text-xs text-gray-500 ml-auto">AI 팀의 실시간 작업 현황</span>
        </div>
        <div id="dev-agent-log" class="p-4 space-y-3 max-h-[700px] overflow-y-auto">
          <div class="text-xs text-gray-500 text-center py-6">
            <i class="fas fa-hourglass-start text-gray-600 text-2xl mb-2 block"></i>
            개발 하네스를 실행하면 AI 팀의 작업이 여기에 표시됩니다
          </div>
        </div>
      </div>
    </div>

    <!-- 최종 완료 카드 -->
    <div id="dev-result-section" class="hidden">
      <div class="bg-gray-900 rounded-xl p-5 border border-green-700">
        <div class="flex items-center gap-3 mb-4 flex-wrap">
          <i class="fas fa-check-circle text-green-400 text-2xl"></i>
          <div>
            <h3 class="text-base font-bold text-green-300">개발 완료!</h3>
            <div id="dev-result-summary" class="text-xs text-gray-400 mt-0.5"></div>
          </div>
          <a id="dev-result-download-btn" href="#" target="_blank"
            class="ml-auto flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors shadow-lg">
            <i class="fas fa-download"></i> ZIP 다운로드
          </a>
        </div>
        <div class="mb-3">
          <div class="text-xs text-gray-500 mb-2">생성된 파일:</div>
          <div id="dev-files-list" class="grid grid-cols-2 md:grid-cols-3 gap-2"></div>
        </div>
        <div class="text-xs text-gray-600 bg-gray-800 rounded p-3 font-mono">
          <div class="text-green-400 mb-1">실행 방법:</div>
          <div>1. ZIP 다운로드 → 압축 해제</div>
          <div>2. <span class="text-white">node solution.js</span> 실행</div>
          <div>3. README.md 참고</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    // ─── 탭 전환 ───
    function switchTab(tab) {
      const researchSection = document.getElementById('section-research');
      const devSection = document.getElementById('section-dev');
      const tabResearch = document.getElementById('tab-research');
      const tabDev = document.getElementById('tab-dev');

      if (tab === 'research') {
        researchSection.classList.remove('hidden');
        devSection.classList.add('hidden');
        tabResearch.classList.add('border-blue-500', 'text-blue-400');
        tabResearch.classList.remove('border-transparent', 'text-gray-400');
        tabDev.classList.add('border-transparent', 'text-gray-400');
        tabDev.classList.remove('border-green-500', 'text-green-400');
      } else {
        researchSection.classList.add('hidden');
        devSection.classList.remove('hidden');
        tabDev.classList.add('border-green-500', 'text-green-400');
        tabDev.classList.remove('border-transparent', 'text-gray-400');
        tabResearch.classList.add('border-transparent', 'text-gray-400');
        tabResearch.classList.remove('border-blue-500', 'text-blue-400');
      }
    }

    // ─── 개발 하네스 예시 ───
    function setDevRequest(text) {
      document.getElementById('dev-request').value = text;
    }

    // ─── 역할별 스타일 ───
    const DEV_ROLE_STYLE = {
      decomposer: { emoji: '🗂️', color: 'yellow',  label: 'TaskDecomposer' },
      pm:         { emoji: '🎯', color: 'yellow',  label: 'PM 에이전트' },
      developer:  { emoji: '💻', color: 'blue',    label: '개발자 에이전트' },
      reviewer:   { emoji: '🔍', color: 'purple',  label: '코드 리뷰어' },
      qa_tester:  { emoji: '🧪', color: 'green',   label: 'QA 테스터' }
    };

    const COLOR_MAP = {
      yellow: 'border-yellow-600 bg-yellow-900/20',
      blue:   'border-blue-600 bg-blue-900/20',
      purple: 'border-purple-600 bg-purple-900/20',
      green:  'border-green-600 bg-green-900/20',
    };

    // ─── 팀원 카드 렌더링 ───
    function renderDevAgentCard(data) {
      const role = data.devRole || 'developer';
      const style = DEV_ROLE_STYLE[role] || DEV_ROLE_STYLE.developer;
      const colorClass = COLOR_MAP[style.color] || COLOR_MAP.blue;

      const toolCallHtml = data.toolCalls && data.toolCalls.length > 0
        ? \`<div class="mt-2 space-y-1">
            \${data.toolCalls.map(tc => {
              const isExec = tc.toolName === 'execute_code' || tc.toolName === 'run_tests';
              const isWrite = tc.toolName === 'write_code';
              const isSuccess = !tc.result.includes('❌');
              const iconClass = isExec ? (isSuccess ? 'fa-play-circle text-green-400' : 'fa-exclamation-circle text-red-400') :
                                isWrite ? 'fa-file-code text-blue-400' : 'fa-tools text-gray-400';
              return \`<div class="flex items-start gap-2 text-xs bg-gray-800 rounded p-2">
                <i class="fas \${iconClass} mt-0.5 flex-shrink-0"></i>
                <div class="flex-1 min-w-0">
                  <span class="text-gray-300 font-mono">\${tc.toolName}</span>
                  \${tc.args.filename ? \`<span class="text-gray-500 ml-1">→ \${tc.args.filename}</span>\` : ''}
                  <details class="mt-1">
                    <summary class="text-gray-500 cursor-pointer hover:text-gray-300">결과 보기</summary>
                    <pre class="text-gray-400 mt-1 text-xs overflow-x-auto whitespace-pre-wrap">\${tc.result.slice(0, 600)}\${tc.result.length > 600 ? '\\n...(생략)' : ''}</pre>
                  </details>
                </div>
              </div>\`;
            }).join('')}
           </div>\`
        : '';

      const filesHtml = data.filesCreated && data.filesCreated.length > 0
        ? \`<div class="mt-2 flex flex-wrap gap-1">
            \${data.filesCreated.map(f => \`<span class="text-xs bg-blue-900/40 border border-blue-700 rounded px-2 py-0.5 font-mono text-blue-300"><i class="fas fa-file-code mr-1"></i>\${f}</span>\`).join('')}
           </div>\`
        : '';

      const scoreHtml = data.qualityScore != null
        ? \`<span class="ml-2 text-xs font-bold \${data.qualityScore >= 80 ? 'text-green-400' : data.qualityScore >= 60 ? 'text-yellow-400' : 'text-red-400'}">[\${data.qualityScore}점]</span>\`
        : '';

      const outputHtml = data.output
        ? \`<details class="mt-2">
            <summary class="text-xs text-gray-400 cursor-pointer hover:text-gray-200">에이전트 출력 보기</summary>
            <pre class="mt-1 text-xs text-gray-300 bg-gray-800 rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap">\${data.output.slice(0, 1500)}\${data.output.length > 1500 ? '\\n...(생략)' : ''}</pre>
           </details>\`
        : '';

      const card = document.createElement('div');
      card.className = \`fade-in rounded-xl p-4 border \${colorClass}\`;
      card.innerHTML = \`
        <div class="flex items-center gap-2 mb-2">
          <span class="text-lg">\${style.emoji}</span>
          <span class="text-sm font-semibold text-gray-200">\${style.label}</span>
          \${data.stepCount ? \`<span class="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">Task \${data.stepCount}</span>\` : ''}
          \${scoreHtml}
          <span class="ml-auto text-xs text-gray-500">\${data.duration ? (data.duration/1000).toFixed(1)+'s' : ''}</span>
        </div>
        \${filesHtml}
        \${toolCallHtml}
        \${outputHtml}
      \`;
      document.getElementById('dev-agent-log').appendChild(card);
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ─── 태스크 항목 렌더링 ───
    function renderTaskItem(task, status = 'pending') {
      const statusIcon = {
        pending:  '<i class="fas fa-clock text-gray-500"></i>',
        running:  '<i class="fas fa-spinner fa-spin text-blue-400"></i>',
        done:     '<i class="fas fa-check-circle text-green-400"></i>',
        failed:   '<i class="fas fa-times-circle text-red-400"></i>'
      }[status] || '';

      const el = document.getElementById(\`task-item-\${task.id}\`);
      const html = \`
        <div class="flex items-start gap-3 p-2 rounded-lg bg-gray-800 border border-gray-700">
          <span class="mt-0.5">\${statusIcon}</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-gray-300">Task \${task.id}</span>
              <span class="text-xs text-gray-400 truncate">\${task.title}</span>
            </div>
            <div class="text-xs text-gray-600 font-mono mt-0.5">\${task.filename}</div>
          </div>
        </div>
      \`;

      if (el) {
        el.outerHTML = \`<div id="task-item-\${task.id}">\${html}</div>\`;
      } else {
        const container = document.getElementById('dev-task-items');
        const div = document.createElement('div');
        div.id = \`task-item-\${task.id}\`;
        div.innerHTML = html;
        container.appendChild(div);
      }
    }

    // ─── 개발 하네스 실행 ───
    async function runDevHarness() {
      const apiKey = document.getElementById('dev-api-key').value.trim();
      const anthropicKey = document.getElementById('dev-anthropic-key').value.trim();
      const devRequest = document.getElementById('dev-request').value.trim();

      if (!apiKey) { alert('OpenAI API Key를 입력하세요'); return; }
      if (!devRequest) { alert('개발 요청을 입력하세요'); return; }

      // UI 초기화
      const runBtn = document.getElementById('dev-run-btn');
      runBtn.disabled = true;
      runBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>AI 팀 작업 중...';

      document.getElementById('dev-progress-section').classList.remove('hidden');
      document.getElementById('dev-result-section').classList.add('hidden');
      document.getElementById('dev-task-list').classList.add('hidden');
      document.getElementById('dev-agent-log').innerHTML = \`
        <div class="text-xs text-gray-500 text-center py-4">
          <i class="fas fa-robot text-gray-600 text-xl mb-2 block"></i>
          AI 팀이 작업을 시작합니다...
        </div>
      \`;
      document.getElementById('dev-download-btn').classList.add('hidden');
      document.getElementById('dev-download-btn').classList.remove('flex');
      document.getElementById('dev-task-items').innerHTML = '';
      document.getElementById('dev-file-count').textContent = '0';
      document.getElementById('dev-task-progress').textContent = '0/0';
      document.getElementById('dev-progress-bar').style.width = '0%';
      document.getElementById('dev-session-id').textContent = '';

      let currentSessionId = '';
      let totalTasks = 0;
      let doneTasks = 0;
      const allFiles = new Set();

      try {
        const response = await fetch('/api/dev-harness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ devRequest, apiKey, anthropicKey })
        });

        if (!response.ok) {
          throw new Error(\`서버 오류: \${response.status}\`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE 블록 단위 파싱 (빈 줄로 구분)
          const blocks = buffer.split('\\n\\n');
          buffer = blocks.pop() || '';

          for (const block of blocks) {
            if (!block.trim()) continue;
            try {
              const blockLines = block.split('\\n');
              let eventType = '';
              let dataStr = '';

              for (const bline of blockLines) {
                if (bline.startsWith('event:')) eventType = bline.slice(6).trim();
                if (bline.startsWith('data:'))  dataStr = bline.slice(5).trim();
              }

              if (!dataStr) continue;
              const data = JSON.parse(dataStr);

              // ── 이벤트 처리 ──
              switch (eventType) {

                case 'dev_start':
                  currentSessionId = data.sessionId;
                  document.getElementById('dev-session-id').textContent = data.sessionId.slice(-12);
                  document.getElementById('dev-agent-log').innerHTML = '';
                  break;

                case 'dev_decompose':
                  totalTasks = data.totalTasks;
                  document.getElementById('dev-task-progress').textContent = \`0/\${totalTasks}\`;
                  document.getElementById('dev-project-name-header').textContent = data.projectName || '작업 세션';
                  document.getElementById('dev-tech-stack-badge').textContent = data.techStack || '';
                  document.getElementById('dev-decompose-meta').textContent =
                    \`\${data.totalTasks}개 태스크 · \${data.techStack || 'Node.js'}\`;
                  document.getElementById('dev-task-list').classList.remove('hidden');

                  // 태스크 목록 렌더링
                  data.tasks.forEach(t => renderTaskItem(t, 'pending'));
                  break;

                case 'dev_task_start':
                  renderTaskItem(data, 'running');
                  // 태스크 시작 알림 카드
                  const startEl = document.createElement('div');
                  startEl.className = 'fade-in text-xs bg-yellow-900/20 border border-yellow-700 rounded-lg px-3 py-2 flex items-center gap-2';
                  startEl.innerHTML = \`
                    <i class="fas fa-play text-yellow-400"></i>
                    <strong class="text-yellow-300">태스크 \${data.taskId}/\${data.totalTasks}</strong>
                    <span class="text-gray-300">\${data.title}</span>
                    <span class="ml-auto font-mono text-gray-500">\${data.filename}</span>
                  \`;
                  document.getElementById('dev-agent-log').appendChild(startEl);
                  startEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  break;

                case 'dev_decision':
                  // 오케스트레이터 결정 카드 (간략)
                  const decisionEl = document.createElement('div');
                  decisionEl.className = 'fade-in text-xs bg-purple-900/10 border border-purple-800 rounded-lg px-3 py-2 flex items-center gap-2';
                  decisionEl.innerHTML = \`
                    <i class="fas fa-brain text-purple-400"></i>
                    <span class="text-purple-300">\${(DEV_ROLE_STYLE[data.nextRole]||{}).emoji||'?'} \${data.nextRole}</span>
                    <span class="text-gray-500 truncate">\${data.reasoning}</span>
                  \`;
                  document.getElementById('dev-agent-log').appendChild(decisionEl);
                  break;

                case 'dev_agent':
                  renderDevAgentCard(data);
                  if (data.filesCreated) {
                    data.filesCreated.forEach(f => allFiles.add(f));
                    document.getElementById('dev-file-count').textContent = allFiles.size;
                  }
                  break;

                case 'dev_task_done':
                  doneTasks++;
                  renderTaskItem(data, data.success ? 'done' : 'failed');
                  document.getElementById('dev-task-progress').textContent = \`\${doneTasks}/\${totalTasks}\`;
                  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
                  document.getElementById('dev-progress-bar').style.width = pct + '%';
                  break;

                case 'dev_complete':
                  // 진행바 100%
                  document.getElementById('dev-progress-bar').style.width = '100%';
                  document.getElementById('dev-task-progress').textContent = \`\${data.successTasks}/\${data.totalTasks}\`;

                  // 다운로드 버튼 활성화 (헤더)
                  const dlBtn = document.getElementById('dev-download-btn');
                  dlBtn.href = data.downloadUrl;
                  dlBtn.classList.remove('hidden');
                  dlBtn.classList.add('flex');

                  // 최종 결과 섹션
                  document.getElementById('dev-result-summary').textContent = data.summary;

                  const filesHtml = (data.filesCreated || []).map(f =>
                    \`<div class="text-xs font-mono bg-gray-800 border border-gray-700 rounded px-3 py-2 text-green-300 flex items-center gap-2">
                      <i class="fas fa-file-code text-blue-400"></i>\${f}
                    </div>\`
                  ).join('') || '<div class="text-xs text-gray-500">생성된 파일 없음</div>';

                  document.getElementById('dev-files-list').innerHTML = filesHtml;

                  // 다운로드 버튼 (결과 섹션)
                  document.getElementById('dev-result-download-btn').href = data.downloadUrl;
                  document.getElementById('dev-result-section').classList.remove('hidden');
                  document.getElementById('dev-result-section').scrollIntoView({ behavior: 'smooth' });
                  break;

                case 'dev_error':
                  const errEl = document.createElement('div');
                  errEl.className = 'fade-in bg-red-900/20 border border-red-700 rounded-lg p-3 text-xs text-red-300';
                  errEl.innerHTML = \`<i class="fas fa-exclamation-triangle mr-2"></i>\${data.message}\`;
                  document.getElementById('dev-agent-log').appendChild(errEl);
                  break;
              }

            } catch(e) { /* JSON 파싱 실패 무시 */ }
          }
        }

      } catch (err) {
        const errEl = document.createElement('div');
        errEl.className = 'fade-in bg-red-900/20 border border-red-700 rounded-lg p-3 text-xs text-red-300';
        errEl.innerHTML = \`<i class="fas fa-exclamation-triangle mr-2"></i>연결 오류: \${err.message}\`;
        document.getElementById('dev-agent-log').appendChild(errEl);
      } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fas fa-rocket mr-2"></i>개발 하네스 실행 — AI가 태스크를 분해하고 파일을 생성합니다';
      }
    }
  </script>
</body>
</html>`;
}

export default app;
