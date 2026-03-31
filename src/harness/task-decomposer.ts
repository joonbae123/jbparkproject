/**
 * TaskDecomposer - 대형 프로젝트 태스크 분해기 v2
 *
 * 핵심 원칙:
 *   - 각 태스크는 서로 다른 파일명을 가짐 (절대 모두 solution.js 금지)
 *   - 태스크 간 의존성을 명시 (require로 연결)
 *   - 마지막 태스크는 통합 파일 (main.js 또는 solution.js)
 *   - 최소 4개, 최대 8개 태스크
 *   - 각 파일은 진짜 독립적으로 실행 가능해야 함
 */

export interface DevTask {
  id: number;
  title: string;           // 태스크 제목 (한 줄)
  filename: string;        // 생성할 파일명 (서로 달라야 함!)
  description: string;     // 상세 구현 내용 (Developer에게 전달)
  dependsOn: string[];     // 의존하는 파일 목록
  testable: boolean;       // Node.js로 단독 실행 검증 가능 여부
  priority: number;        // 실행 순서 (낮을수록 먼저)
  exportedFunctions: string[]; // 이 파일이 export할 함수/클래스 목록
}

export interface DecompositionPlan {
  projectName: string;
  totalTasks: number;
  tasks: DevTask[];
  techStack: string;
  entryFile: string;       // 최종 진입점 파일
  notes: string;
}

// Claude API 호출
async function callClaude(
  anthropicKey: string,
  userMessage: string,
  systemPrompt: string,
  maxTokens: number = 3000
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    })
  });

  const text = await res.text();
  if (!res.ok) {
    let errMsg = `Anthropic HTTP ${res.status}`;
    try { errMsg = JSON.parse(text).error?.message || errMsg; } catch {}
    throw new Error(errMsg);
  }
  return JSON.parse(text).content[0]?.text || "";
}

// OpenAI API 호출
async function callOpenAI(
  apiKey: string,
  userMessage: string,
  systemPrompt: string,
  maxTokens: number = 3000
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: maxTokens,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ]
    })
  });

  const text = await res.text();
  if (!res.ok) {
    let errMsg = `OpenAI HTTP ${res.status}`;
    try { errMsg = JSON.parse(text).error?.message || errMsg; } catch {}
    throw new Error(errMsg);
  }
  return JSON.parse(text).choices[0]?.message?.content || "";
}

/**
 * 개발 요청을 단위 태스크로 분해
 */
export async function decomposeProject(
  devRequest: string,
  anthropicKey: string,
  openAIKey: string
): Promise<DecompositionPlan> {

  const systemPrompt = `당신은 시니어 소프트웨어 아키텍트입니다.
개발 요청을 독립적으로 구현 가능한 모듈 단위 태스크로 분해하세요.

절대 규칙:
1. 각 태스크는 서로 다른 파일명을 가져야 합니다 (모두 solution.js이면 절대 안 됨)
2. 마지막 태스크만 main.js 또는 solution.js (모든 모듈 통합)
3. 중간 태스크들은 역할별 다른 파일명: calculator.js, validator.js, formatter.js 등
4. 각 파일은 module.exports = { 함수명 } 형식으로 export
5. 의존 파일은 require('./파일명')으로 불러옴
6. 순수 Node.js JavaScript만 사용 (외부 npm 패키지 금지)
7. 태스크 수: 최소 4개, 최대 8개
8. 각 태스크의 description에 구현할 함수명, 입력/출력, 예시 코드를 포함

좋은 분해 예시 (MES KPI 계산기):
- Task 1: timeCalc.js → calculateTimeUtilization(workStart, workEnd, actualWorkMin) 함수
- Task 2: effCalc.js → calculateWorkEfficiency(actualOutput, theoreticalOutput) 함수  
- Task 3: gradeCalc.js → assignGrade(score) 함수 (A/B/C/D/F)
- Task 4: validator.js → validateWorkerData(data) 함수 (이상값 필터링)
- Task 5: reporter.js → generateReport(workers) 함수 (콘솔 표 출력)
- Task 6: solution.js → 모든 모듈 통합 실행 (샘플 데이터로 전체 검증)

나쁜 분해 예시 (이렇게 하지 마세요):
- Task 1: solution.js → 모든 기능 구현 ← 금지! 하나로 뭉치지 마세요

반드시 아래 JSON 형식으로만 응답 (다른 텍스트 없이):
{
  "projectName": "프로젝트명",
  "techStack": "Node.js JavaScript (CommonJS)",
  "entryFile": "solution.js",
  "notes": "구현 시 주의사항",
  "tasks": [
    {
      "id": 1,
      "title": "태스크 제목",
      "filename": "calculator.js",
      "description": "구체적인 구현 내용:\\n- 함수명: calculateXxx(param1, param2)\\n- 입력: param1 (숫자), param2 (숫자)\\n- 출력: { result, isValid }\\n- 예시: calculateXxx(100, 80) → { result: 80, isValid: true }\\n- module.exports = { calculateXxx }",
      "dependsOn": [],
      "testable": true,
      "priority": 1,
      "exportedFunctions": ["calculateXxx"]
    }
  ]
}`;

  const userMessage = `다음 개발 요청을 모듈 단위 태스크로 분해하세요:\n\n${devRequest.slice(0, 3000)}`;

  try {
    const raw = anthropicKey
      ? await callClaude(anthropicKey, userMessage, systemPrompt, 3000)
      : await callOpenAI(openAIKey, userMessage, systemPrompt, 3000);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 파싱 실패");

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      throw new Error("태스크 목록 없음");
    }

    // 유효성 검사: 파일명 중복 체크
    const filenames = parsed.tasks.map((t: DevTask) => t.filename);
    const uniqueFilenames = new Set(filenames);
    if (uniqueFilenames.size < filenames.length) {
      console.warn("[TaskDecomposer] 중복 파일명 감지 - 자동 수정");
      // 중복 파일명 자동 수정
      const seen = new Map<string, number>();
      parsed.tasks.forEach((t: DevTask, idx: number) => {
        const count = seen.get(t.filename) || 0;
        if (count > 0) {
          const ext = t.filename.includes('.') ? t.filename.split('.').pop() : 'js';
          const base = t.filename.replace(`.${ext}`, '');
          t.filename = `${base}_${count}.${ext}`;
        }
        seen.set(t.filename, (seen.get(t.filename) || 0) + 1);
      });
    }

    // priority 순 정렬
    parsed.tasks.sort((a: DevTask, b: DevTask) => a.priority - b.priority);

    return {
      projectName: parsed.projectName || "프로젝트",
      totalTasks: parsed.tasks.length,
      tasks: parsed.tasks,
      techStack: parsed.techStack || "Node.js JavaScript (CommonJS)",
      entryFile: parsed.entryFile || "solution.js",
      notes: parsed.notes || ""
    };

  } catch (err) {
    console.error("[TaskDecomposer] 분해 실패, 기본 플랜 사용:", err);
    return getDefaultDecomposition(devRequest);
  }
}

/**
 * 기본 분해 플랜 (API 실패 시 fallback)
 * - 요청에서 키워드를 뽑아 실제로 의미있는 모듈 구조 생성
 */
function getDefaultDecomposition(devRequest: string): DecompositionPlan {
  const req = devRequest.slice(0, 500);

  return {
    projectName: "기능 구현",
    totalTasks: 4,
    techStack: "Node.js JavaScript (CommonJS)",
    entryFile: "solution.js",
    notes: "각 모듈을 독립적으로 구현 후 solution.js에서 통합",
    tasks: [
      {
        id: 1,
        title: "핵심 계산 모듈",
        filename: "calculator.js",
        description: `다음 요청의 핵심 계산 로직을 구현하세요:\n${req}\n\n요구사항:\n- 핵심 함수를 구현하고 module.exports로 export\n- 각 함수는 console.log로 결과 검증\n- 엣지케이스(null, 0, 빈 배열) 처리 포함`,
        dependsOn: [],
        testable: true,
        priority: 1,
        exportedFunctions: ["calculate"]
      },
      {
        id: 2,
        title: "데이터 검증 모듈",
        filename: "validator.js",
        description: "입력 데이터 검증 함수 구현:\n- validateInput(data): 유효성 검사 (타입, 범위, null 체크)\n- filterOutliers(data): 이상값 필터링\n- module.exports = { validateInput, filterOutliers }",
        dependsOn: [],
        testable: true,
        priority: 2,
        exportedFunctions: ["validateInput", "filterOutliers"]
      },
      {
        id: 3,
        title: "결과 포맷팅 모듈",
        filename: "formatter.js",
        description: "출력 포맷팅 함수 구현:\n- formatResult(data): 결과를 읽기 좋은 형식으로 변환\n- printTable(rows): 콘솔에 표 형식으로 출력\n- module.exports = { formatResult, printTable }",
        dependsOn: ["calculator.js"],
        testable: true,
        priority: 3,
        exportedFunctions: ["formatResult", "printTable"]
      },
      {
        id: 4,
        title: "통합 실행 파일",
        filename: "solution.js",
        description: "모든 모듈을 통합하고 샘플 데이터로 전체 기능 검증:\n- require('./calculator.js'), require('./validator.js'), require('./formatter.js') 사용\n- 샘플 데이터 5~10개로 전체 플로우 실행\n- 최종 결과를 콘솔에 출력",
        dependsOn: ["calculator.js", "validator.js", "formatter.js"],
        testable: true,
        priority: 4,
        exportedFunctions: []
      }
    ]
  };
}
