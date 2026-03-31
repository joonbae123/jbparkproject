import { Hono } from "hono";
import { serve } from "@hono/node-server";
import api from "./routes/api.js";

const app = new Hono();
app.route("/api", api);
app.get("/", (c) => c.html(getHTML()));

const PORT = 3000;
console.log(`\n🚀 AI Harness + MCP Demo Server v4 (Claude 오케스트레이터)`);
console.log(`📍 http://localhost:${PORT}`);
console.log(`📡 API: http://localhost:${PORT}/api/health\n`);

serve({ fetch: app.fetch, port: PORT });

function getHTML(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Harness + MCP Demo v4</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    @keyframes fadeInUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes pulse-border { 0%,100%{border-color:#3b82f6} 50%{border-color:#8b5cf6} }
    @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
    @keyframes planSlideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
    .fade-in { animation: fadeInUp 0.4s ease-out; }
    .plan-in { animation: planSlideIn 0.5s ease-out; }
    .running-border { animation: pulse-border 1.5s infinite; border-width:2px; border-style:solid; }
    .rejected-shake { animation: shake 0.4s ease-out; }
    pre { white-space:pre-wrap; word-break:break-word; }
    .score-bar { transition: width 0.8s ease-out; }
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
          <span class="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full ml-1">v4 Claude 오케스트레이터</span>
        </h1>
        <p class="text-xs text-gray-400 mt-1">Claude가 계획 수립 · GPT-4o-mini가 에이전트 실행</p>
      </div>
      <div id="status-badge" class="hidden items-center gap-2 bg-gray-800 px-3 py-1 rounded-full text-xs">
        <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
        <span id="status-text">실행 중...</span>
      </div>
    </div>
  </div>

  <div class="max-w-5xl mx-auto px-6 py-6 space-y-5">

    <!-- 구조 설명 -->
    <div class="bg-gray-900 rounded-xl p-4 border border-purple-800">
      <h2 class="text-xs font-semibold text-purple-300 mb-3 flex items-center gap-2">
        <i class="fas fa-sitemap text-purple-400"></i> v4 아키텍처: Claude 오케스트레이터 + GPT-4o-mini 에이전트
      </h2>
      <div class="flex items-start gap-4 flex-wrap text-xs">
        <!-- Claude 박스 -->
        <div class="bg-purple-900/40 border border-purple-600 rounded-xl px-4 py-3 text-center min-w-[120px]">
          <div class="text-purple-300 font-semibold text-sm mb-1">🧠 Claude</div>
          <div class="text-purple-400 text-xs">Haiku 3.5</div>
          <div class="text-gray-400 text-xs mt-1">① 계획 수립<br>③ 중간 검토</div>
        </div>
        <div class="flex flex-col items-center justify-center gap-1 text-gray-500 pt-4">
          <i class="fas fa-arrow-right"></i>
          <span class="text-xs">계획</span>
        </div>
        <!-- GPT 에이전트들 -->
        <div class="flex-1 border border-gray-600 rounded-xl p-3 bg-gray-800/50">
          <div class="text-xs text-gray-400 mb-2 font-medium">② GPT-4o-mini 에이전트 (Claude 계획대로 실행)</div>
          <div class="flex gap-2 flex-wrap">
            <div class="bg-blue-900/40 border border-blue-700 rounded-lg px-2 py-1.5 text-center">
              <div class="text-blue-300 text-xs font-medium">🔍 Researcher</div>
              <div class="text-gray-500 text-xs">web_search</div>
            </div>
            <i class="fas fa-arrow-right text-gray-600 self-center"></i>
            <div class="bg-purple-900/40 border border-purple-700 rounded-lg px-2 py-1.5 text-center">
              <div class="text-purple-300 text-xs font-medium">📊 Analyst</div>
              <div class="text-gray-500 text-xs">analyze_text</div>
            </div>
            <i class="fas fa-arrow-right text-gray-600 self-center"></i>
            <div class="bg-yellow-900/40 border border-yellow-700 rounded-lg px-2 py-1.5 text-center">
              <div class="text-yellow-300 text-xs font-medium">⚖️ Critic</div>
              <div class="text-gray-500 text-xs">fact_check + 판정</div>
            </div>
            <i class="fas fa-arrow-right text-gray-600 self-center"></i>
            <div class="bg-green-900/40 border border-green-700 rounded-lg px-2 py-1.5 text-center">
              <div class="text-green-300 text-xs font-medium">✨ Synthesizer</div>
              <div class="text-gray-500 text-xs">최종 보고서</div>
            </div>
          </div>
          <div class="text-xs text-gray-500 mt-2 italic">* Claude가 쿼리 복잡도에 따라 에이전트 순서/횟수를 동적으로 조정</div>
        </div>
      </div>
    </div>

    <!-- 설정 섹션 -->
    <div class="bg-gray-900 rounded-xl p-5 border border-gray-700 space-y-4">
      <h2 class="text-sm font-semibold text-gray-300 flex items-center gap-2">
        <i class="fas fa-sliders-h text-blue-400"></i> 설정
      </h2>

      <!-- API 키 2개 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-gray-400 mb-1">
            <i class="fas fa-key text-green-400 mr-1"></i>OpenAI API Key
            <span class="text-gray-600 ml-1">(에이전트용)</span>
          </label>
          <input id="api-key" type="password" placeholder="sk-proj-... 또는 sk-..."
            class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-green-500"/>
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">
            <i class="fas fa-key text-purple-400 mr-1"></i>Anthropic API Key
            <span class="text-gray-600 ml-1">(Claude 오케스트레이터용)</span>
          </label>
          <input id="anthropic-key" type="password" placeholder="sk-ant-..."
            class="w-full bg-gray-800 border border-purple-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500"/>
          <div class="text-xs text-gray-600 mt-1">
            비워두면 기본 계획(코드 오케스트레이터)으로 실행
          </div>
        </div>
      </div>

      <!-- 슬라이더 2개 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div class="flex items-center justify-between mb-2">
            <div class="text-xs font-semibold text-blue-300 flex items-center gap-1">
              <i class="fas fa-redo text-blue-400"></i> 최대 재시도 횟수
            </div>
            <div id="retry-display" class="text-lg font-bold text-blue-400">3회</div>
          </div>
          <input id="max-retry" type="range" min="0" max="10" value="3" step="1"
            oninput="updateRetryDisplay(this.value)" class="w-full bg-gray-700" style="accent-color:#3b82f6"/>
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span class="text-purple-400 font-medium">0=무제한</span>
            <span>1</span><span>3</span><span>5</span><span>7</span><span>10</span>
          </div>
          <div id="retry-desc" class="text-xs text-gray-400 mt-2 min-h-[2rem] leading-relaxed"></div>
        </div>
        <div class="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div class="flex items-center justify-between mb-2">
            <div class="text-xs font-semibold text-green-300 flex items-center gap-1">
              <i class="fas fa-bullseye text-green-400"></i> 합격 기준 점수
            </div>
            <div id="score-display" class="text-lg font-bold text-green-400">80점</div>
          </div>
          <input id="target-score" type="range" min="0" max="100" value="80" step="5"
            oninput="updateScoreDisplay(this.value)" class="w-full bg-gray-700 target-slider" style="accent-color:#10b981"/>
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
          </div>
          <div id="score-desc" class="text-xs text-gray-400 mt-2 min-h-[2rem] leading-relaxed"></div>
        </div>
      </div>

      <!-- 쿼리 -->
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

      <!-- 실행 요약 -->
      <div class="bg-gray-800 rounded-lg px-4 py-2.5 border border-gray-600 flex items-center gap-3 flex-wrap text-xs text-gray-300">
        <i class="fas fa-info-circle text-blue-400"></i>
        <span>최대 <strong id="sum-retry" class="text-blue-300">3회</strong> 재시도 ·
        합격 기준 <strong id="sum-score" class="text-green-300">80점</strong> 이상 ·
        <span id="sum-mode" class="text-yellow-300">3번 반려 시 강제 종료</span></span>
      </div>

      <button id="run-btn" onclick="runHarness()"
        class="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
        <i class="fas fa-play"></i> Harness 실행 (Claude 오케스트레이터)
      </button>
    </div>

    <!-- Claude 계획 표시 -->
    <div id="plan-section" class="hidden plan-in">
      <h2 class="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
        <i class="fas fa-brain text-purple-400"></i> Claude의 실행 계획
      </h2>
      <div class="bg-gray-900 border border-purple-800 rounded-xl p-4 space-y-3">
        <div class="flex items-start gap-3">
          <div class="text-purple-400 text-xs font-semibold w-16 shrink-0 pt-0.5">판단 이유</div>
          <div id="plan-reasoning" class="text-xs text-gray-300 leading-relaxed"></div>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-purple-400 text-xs font-semibold w-16 shrink-0">복잡도</div>
          <div id="plan-complexity" class="text-xs"></div>
        </div>
        <div>
          <div class="text-purple-400 text-xs font-semibold mb-2">실행 순서</div>
          <div id="plan-steps" class="flex flex-wrap gap-2"></div>
        </div>
        <!-- Claude 중간 검토 메시지 -->
        <div id="review-log" class="space-y-1"></div>
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
          <div class="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1">
            <i class="fas fa-chart-line text-green-400"></i> 개선 과정 요약
          </div>
          <div id="improvement-text" class="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap"></div>
        </div>
      </div>
    </div>

    <!-- 전역 에러 -->
    <div id="global-error" class="hidden fade-in bg-red-950 border border-red-700 rounded-xl p-4">
      <div class="flex items-start gap-3">
        <i class="fas fa-exclamation-circle text-red-400 mt-0.5 text-lg"></i>
        <div>
          <div class="text-sm font-semibold text-red-300 mb-1">실행 오류 발생</div>
          <div id="global-error-msg" class="text-xs text-red-200 font-mono leading-relaxed"></div>
          <div class="mt-2 text-xs text-gray-400">
            💡 OpenAI 키 오류: <a href="https://platform.openai.com/api-keys" target="_blank" class="text-blue-400 underline">platform.openai.com/api-keys</a> ·
            Anthropic 키 오류: <a href="https://console.anthropic.com/settings/keys" target="_blank" class="text-purple-400 underline">console.anthropic.com</a>
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
      document.getElementById('timer').textContent = ((Date.now()-startTime)/1000).toFixed(1)+'s 경과';
    }

    // ── 슬라이더 ──
    function updateRetryDisplay(val) {
      const n = parseInt(val);
      const display = document.getElementById('retry-display');
      const btn = document.getElementById('max-retry');
      if (n === 0) {
        display.textContent = '∞ 무제한'; display.className = 'text-lg font-bold text-purple-400';
        btn.classList.add('unlimited');
        document.getElementById('retry-desc').textContent = '목표 점수 달성까지 계속 재시도. 안전장치: 최대 10회.';
      } else {
        display.textContent = n+'회'; display.className = 'text-lg font-bold text-blue-400';
        btn.classList.remove('unlimited');
        document.getElementById('retry-desc').textContent = n===1 ? '딱 1번만 시도. 반려되면 강제 종료.' : \`최대 \${n}번 재시도. 모두 반려되면 강제 종료.\`;
      }
      updateSummary();
    }
    function updateScoreDisplay(val) {
      const n = parseInt(val);
      const colors = n>=80?'text-green-400':n>=60?'text-yellow-400':n>=40?'text-orange-400':'text-red-400';
      document.getElementById('score-display').textContent = n+'점';
      document.getElementById('score-display').className = 'text-lg font-bold '+colors;
      document.getElementById('score-desc').textContent =
        n===0?'사실상 항상 통과.':n<=30?'기준 매우 낮음. 대부분 1차 통과.':
        n<=60?'기준 낮음. 1~2차 통과.':n<=79?'적당한 기준. 2~3차 필요할 수도.':
        n<=89?'엄격한 기준. 재시도 많이 필요할 수 있음.':'극도로 엄격. 통과 어려울 수 있음.';
      updateSummary();
    }
    function updateSummary() {
      const r = parseInt(document.getElementById('max-retry').value);
      const s = parseInt(document.getElementById('target-score').value);
      document.getElementById('sum-retry').textContent = r===0?'무제한':r+'회';
      document.getElementById('sum-score').textContent = s+'점';
      const m = document.getElementById('sum-mode');
      if (r===0) { m.textContent='목표 점수 달성까지 계속 (안전장치 10회)'; m.className='text-purple-300'; }
      else { m.textContent=r+'번 반려 시 강제 종료'; m.className='text-yellow-300'; }
    }
    updateRetryDisplay(3); updateScoreDisplay(80);

    // ── Claude 계획 렌더링 ──
    function renderPlan(plan) {
      document.getElementById('plan-section').classList.remove('hidden');
      document.getElementById('plan-reasoning').textContent = plan.reasoning;
      const complexityMap = { low:'🟢 단순', medium:'🟡 보통', high:'🔴 복잡' };
      const complexityColor = { low:'text-green-400', medium:'text-yellow-400', high:'text-red-400' };
      const c = plan.estimatedComplexity || 'medium';
      document.getElementById('plan-complexity').innerHTML =
        \`<span class="\${complexityColor[c]} font-semibold">\${complexityMap[c]||c}</span>\`;

      const stepsEl = document.getElementById('plan-steps');
      stepsEl.innerHTML = '';
      plan.steps.forEach((step, i) => {
        const roleColors = {
          researcher:'bg-blue-900/50 border-blue-600 text-blue-300',
          analyst:'bg-purple-900/50 border-purple-600 text-purple-300',
          critic:'bg-yellow-900/50 border-yellow-600 text-yellow-300',
          synthesizer:'bg-green-900/50 border-green-600 text-green-300'
        };
        const roleEmojis = { researcher:'🔍', analyst:'📊', critic:'⚖️', synthesizer:'✨' };
        stepsEl.insertAdjacentHTML('beforeend', \`
          <div class="flex items-center gap-1">
            \${i > 0 ? '<i class="fas fa-arrow-right text-gray-600 text-xs"></i>' : ''}
            <div class="border rounded-lg px-2 py-1.5 text-xs \${roleColors[step.role]||'bg-gray-800 border-gray-600 text-gray-300'}" title="\${step.instruction}">
              \${roleEmojis[step.role]||''} \${step.role}\${step.isJudge?' (판정)':''}
            </div>
          </div>
        \`);
      });
    }

    function addReviewLog(comment, modified) {
      document.getElementById('review-log').insertAdjacentHTML('beforeend', \`
        <div class="text-xs flex items-center gap-2 text-gray-500 fade-in">
          <i class="fas fa-\${modified?'edit':'check'} text-\${modified?'yellow':'gray'}-400 text-xs"></i>
          <span>Claude 중간 검토: \${comment}</span>
          \${modified?'<span class="text-yellow-400 font-semibold">계획 수정됨</span>':''}
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
        completed: log.agentRole==='critic' ? (log.message.includes('반려')?'border-red-700 rejected-shake':'border-green-700') : 'border-green-700',
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
          <summary class="text-gray-400 cursor-pointer hover:text-gray-200 text-xs flex items-center gap-1">
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
            <span class="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full ml-auto">품질 점수: \${event.judgement.score}점</span>
          </div>
          <div class="text-xs text-gray-300 mb-2"><span class="text-gray-500">이유:</span> \${event.judgement.reason}</div>
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div><div class="text-gray-500 mb-1 font-medium">문제점</div><ul class="space-y-1 list-disc list-inside">\${issuesHTML}</ul></div>
            <div><div class="text-gray-500 mb-1 font-medium">개선 제안</div><ul class="space-y-1 list-disc list-inside">\${suggestionsHTML}</ul></div>
          </div>
        </div>\`);
    }

    // ── 최종 리포트 ──
    function renderRetryReport(retryReport, targetScore) {
      document.getElementById('retry-report-section').classList.remove('hidden');
      const forcedStop = retryReport.finalVerdict === 'rejected';
      const statsColor = retryReport.totalRejections===0?'border-green-700':'border-yellow-700';
      document.getElementById('retry-stats').innerHTML = \`
        <div class="bg-gray-800 rounded-lg p-3 text-center border \${statsColor}">
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
          const label = isLast?(forcedStop?\`\${i+1}차(강제종료)\`:\`\${i+1}차(승인)\`):\`\${i+1}차(반려)\`;
          const badge = passed?'<span class="text-xs text-green-300 ml-2">✅ 통과</span>':\`<span class="text-xs text-red-300 ml-2">❌ -\${targetScore-score}점</span>\`;
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

      isRunning = true; startTime = Date.now();
      document.getElementById('run-btn').disabled = true;
      document.getElementById('run-btn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> 실행 중...';
      document.getElementById('pipeline-view').classList.remove('hidden');
      document.getElementById('plan-section').classList.add('hidden');
      document.getElementById('report-section').classList.add('hidden');
      document.getElementById('retry-report-section').classList.add('hidden');
      document.getElementById('global-error').classList.add('hidden');
      document.getElementById('agents-container').innerHTML = '';
      document.getElementById('retry-events').innerHTML = '';
      document.getElementById('retry-stats').innerHTML = '';
      document.getElementById('quality-bars').innerHTML = '';
      document.getElementById('review-log').innerHTML = '';
      document.getElementById('status-badge').classList.remove('hidden');
      document.getElementById('status-badge').classList.add('flex');
      document.getElementById('status-text').textContent = anthropicKey ? 'Claude 계획 수립 중...' : '에이전트 실행 중...';
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
        document.getElementById('run-btn').innerHTML = '<i class="fas fa-play"></i> Harness 실행 (Claude 오케스트레이터)';
        document.getElementById('status-badge').classList.add('hidden');
        document.getElementById('status-badge').classList.remove('flex');
      }
    }

    // ── SSE 핸들러 ──
    function handleSSEEvent(event, data, targetScore) {
      switch(event) {
        case 'start':
          document.getElementById('status-text').textContent = 'Harness 시작됨';
          break;
        case 'plan_update':
          if (data.type === 'plan') {
            renderPlan(data.plan);
            document.getElementById('status-text').textContent = 'Claude 계획 완료 → 에이전트 실행 중';
          } else if (data.type === 'review') {
            addReviewLog(data.comment, data.modified);
          }
          break;
        case 'retry_event':
          renderRetryEvent(data);
          document.getElementById('attempt-counter').textContent = (data.attempt+1)+'차 (재시도)';
          document.getElementById('status-text').textContent = data.attempt+'차 반려 → 재시도';
          break;
        case 'agent_complete':
          renderAgentCard(data);
          if (data.attempt) document.getElementById('attempt-counter').textContent = data.attempt+'차 시도';
          document.getElementById('status-text').textContent = data.agentName+' 완료';
          break;
        case 'complete': {
          const elapsed = ((Date.now()-startTime)/1000).toFixed(1);
          document.getElementById('final-report').textContent = data.finalReport;
          document.getElementById('report-stats').textContent =
            \`\${elapsed}s · 에이전트 \${data.agentsExecuted}개 · MCP: \${data.mcpToolsUsed.join(', ')}\`;
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
</body>
</html>`;
}

export default app;
