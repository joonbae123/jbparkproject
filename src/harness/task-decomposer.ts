/**
 * TaskDecomposer - 대형 프로젝트 태스크 분해기
 *
 * 역할:
 *   큰 개발 요청(예: IPR 전체 앱)을 받아서
 *   AI가 독립적으로 실행 가능한 단위 태스크로 쪼갭니다.
 *
 * 핵심 원칙:
 *   - 각 태스크는 "파일 1~2개" 단위로 쪼개기
 *   - 태스크 간 의존성을 명시 (어떤 파일에 의존하는지)
 *   - 각 태스크는 독립 실행 가능해야 함 (Node.js로 검증 가능)
 *   - 최대 10개 태스크 (너무 많으면 관리 불가)
 *
 * 예시:
 *   입력: "IPR 웹앱 전체 구현"
 *   출력:
 *     Task 1: "시간 활용도 계산 함수 (utils/timeCalc.js)"
 *     Task 2: "작업 효율 계산 함수 (utils/effCalc.js)"
 *     Task 3: "Grade 분류 함수 (utils/grade.js)"
 *     Task 4: "Excel 파싱 함수 (utils/excelParser.js)"
 *     Task 5: "통합 테스트 (solution.js - 모든 함수 조합)"
 */

export interface DevTask {
  id: number;
  title: string;           // 태스크 제목 (한 줄)
  filename: string;        // 생성할 파일명 (예: utils/timeCalc.js)
  description: string;     // 상세 구현 내용 (Developer에게 전달)
  dependsOn: string[];     // 의존하는 파일 목록
  testable: boolean;       // Node.js로 단독 실행 검증 가능 여부
  priority: number;        // 실행 순서 (낮을수록 먼저)
}

export interface DecompositionPlan {
  projectName: string;
  totalTasks: number;
  tasks: DevTask[];
  techStack: string;
  entryFile: string;       // 최종 진입점 파일
  notes: string;           // 구현 시 주의사항
}

// Claude API 호출
async function callClaude(
  anthropicKey: string,
  userMessage: string,
  systemPrompt: string,
  maxTokens: number = 2000
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

// OpenAI API 호출 (Anthropic 키 없을 때 fallback)
async function callOpenAI(
  apiKey: string,
  userMessage: string,
  systemPrompt: string,
  maxTokens: number = 2000
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
 * 메인: 개발 요청을 태스크로 분해
 */
export async function decomposeProject(
  devRequest: string,
  anthropicKey: string,
  openAIKey: string
): Promise<DecompositionPlan> {

  const systemPrompt = `당신은 시니어 소프트웨어 아키텍트입니다.
개발 요청을 받아 독립적으로 구현 가능한 단위 태스크로 분해하세요.

핵심 규칙:
1. 각 태스크는 파일 1~2개 단위 (절대 전체 앱을 하나로 묶지 않음)
2. 순수 Node.js JavaScript만 사용 (외부 라이브러리 설치 불가)
3. 각 태스크는 console.log로 실행 결과 확인 가능해야 함
4. 태스크 수: 최소 3개, 최대 8개
5. 의존성 순서대로 priority 번호 부여 (1이 가장 먼저)
6. 복잡한 UI/프레임워크는 "핵심 로직만" 추출해서 구현
   예: React 앱 → "데이터 계산 로직"만 JS로 구현

반드시 아래 JSON 형식으로만 응답 (다른 텍스트 없이):
{
  "projectName": "프로젝트명",
  "techStack": "사용 기술 (예: Node.js JavaScript)",
  "entryFile": "최종 통합 파일명 (예: solution.js)",
  "notes": "구현 시 주의사항 1~2문장",
  "tasks": [
    {
      "id": 1,
      "title": "태스크 제목",
      "filename": "파일명.js",
      "description": "구체적인 구현 내용 (함수명, 입출력, 예시 포함)",
      "dependsOn": [],
      "testable": true,
      "priority": 1
    }
  ]
}`;

  const userMessage = `다음 개발 요청을 단위 태스크로 분해하세요:\n\n${devRequest.slice(0, 3000)}`;

  try {
    // Anthropic 키 있으면 Claude, 없으면 GPT-4o-mini
    const raw = anthropicKey
      ? await callClaude(anthropicKey, userMessage, systemPrompt, 2000)
      : await callOpenAI(openAIKey, userMessage, systemPrompt, 2000);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 파싱 실패");

    const parsed = JSON.parse(jsonMatch[0]);

    // 유효성 검사
    if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      throw new Error("태스크 목록 없음");
    }

    // priority 순 정렬
    parsed.tasks.sort((a: DevTask, b: DevTask) => a.priority - b.priority);

    return {
      projectName: parsed.projectName || "프로젝트",
      totalTasks: parsed.tasks.length,
      tasks: parsed.tasks,
      techStack: parsed.techStack || "Node.js JavaScript",
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
 */
function getDefaultDecomposition(devRequest: string): DecompositionPlan {
  // 요청에서 핵심 키워드 추출
  const isCalc = /계산|함수|알고리즘|로직/.test(devRequest);
  const isData = /데이터|파싱|변환|처리/.test(devRequest);

  if (isCalc || isData) {
    return {
      projectName: "기능 구현",
      totalTasks: 3,
      techStack: "Node.js JavaScript",
      entryFile: "solution.js",
      notes: "각 함수를 독립적으로 구현 후 통합",
      tasks: [
        {
          id: 1,
          title: "핵심 계산 함수 구현",
          filename: "calculator.js",
          description: `다음 요청의 핵심 계산 로직을 구현하세요: ${devRequest.slice(0, 200)}`,
          dependsOn: [],
          testable: true,
          priority: 1
        },
        {
          id: 2,
          title: "유틸리티 함수 구현",
          filename: "utils.js",
          description: "데이터 검증, 포맷팅 등 보조 함수 구현",
          dependsOn: ["calculator.js"],
          testable: true,
          priority: 2
        },
        {
          id: 3,
          title: "통합 실행 파일",
          filename: "solution.js",
          description: "모든 함수를 통합하고 샘플 데이터로 실행 검증",
          dependsOn: ["calculator.js", "utils.js"],
          testable: true,
          priority: 3
        }
      ]
    };
  }

  return {
    projectName: "프로젝트",
    totalTasks: 2,
    techStack: "Node.js JavaScript",
    entryFile: "solution.js",
    notes: "",
    tasks: [
      {
        id: 1,
        title: "기능 구현",
        filename: "solution.js",
        description: devRequest.slice(0, 500),
        dependsOn: [],
        testable: true,
        priority: 1
      },
      {
        id: 2,
        title: "테스트",
        filename: "solution.test.js",
        description: "위 기능에 대한 테스트 코드",
        dependsOn: ["solution.js"],
        testable: true,
        priority: 2
      }
    ]
  };
}
