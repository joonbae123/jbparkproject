/**
 * MCP Tools 정의
 * 
 * MCP에서 "Tool"이란?
 * - AI가 호출할 수 있는 함수들의 명세
 * - name: AI가 도구를 식별하는 이름
 * - description: AI가 "언제 이 도구를 쓸지" 판단하는 설명
 * - inputSchema: 도구에 전달할 인자의 JSON Schema
 * 
 * 이 파일은 3가지 도구를 정의합니다:
 * 1. web_search     - 웹 검색 시뮬레이션 (실제로는 키워드 기반 정보 생성)
 * 2. analyze_text   - 텍스트 분석 (감정, 키워드, 요약)
 * 3. fact_check     - 팩트 체크 (주장의 신뢰도 평가)
 */

export const MCP_TOOLS = [
  {
    name: "web_search",
    description: "주어진 쿼리로 웹을 검색하여 관련 정보를 가져옵니다. 최신 정보나 특정 주제에 대한 데이터가 필요할 때 사용합니다.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "검색할 쿼리 문자열"
        },
        max_results: {
          type: "number",
          description: "최대 결과 수 (기본값: 3)",
          default: 3
        }
      },
      required: ["query"]
    }
  },
  {
    name: "analyze_text",
    description: "텍스트를 분석하여 핵심 키워드, 감정 톤, 주요 주제를 추출합니다. 리서치 내용을 구조화할 때 사용합니다.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "분석할 텍스트"
        },
        analysis_type: {
          type: "string",
          enum: ["keywords", "sentiment", "topics", "all"],
          description: "분석 유형 (기본값: all)",
          default: "all"
        }
      },
      required: ["text"]
    }
  },
  {
    name: "fact_check",
    description: "주어진 주장이나 정보의 신뢰도를 평가합니다. 정보의 정확성이 중요할 때 검증 단계에서 사용합니다.",
    inputSchema: {
      type: "object",
      properties: {
        claim: {
          type: "string",
          description: "검증할 주장이나 사실"
        },
        context: {
          type: "string",
          description: "추가 맥락 정보 (선택사항)"
        }
      },
      required: ["claim"]
    }
  }
];

/**
 * MCP Tool 실행기
 * 
 * 실제 MCP 서버에서는 이 함수들이 외부 API를 호출하지만,
 * 이 데모에서는 구조를 이해하기 위해 시뮬레이션합니다.
 */
export async function executeMCPTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: string; metadata?: Record<string, unknown> }> {
  
  console.log(`[MCP Tool 실행] ${toolName}`, args);

  switch (toolName) {
    case "web_search": {
      const query = args.query as string;
      // 실제 환경에서는 여기서 검색 API (Brave, Google, Tavily 등) 호출
      return {
        content: `[웹 검색 결과: "${query}"]
검색 결과 1: ${query}에 관한 최근 연구에 따르면, 이 주제는 2024년부터 급격히 주목받고 있습니다.
검색 결과 2: 전문가들은 ${query}이(가) 향후 5년간 주요 트렌드가 될 것으로 전망합니다.
검색 결과 3: ${query} 관련 시장 규모는 연평균 25% 성장 중이며, 다양한 활용 사례가 보고되고 있습니다.`,
        metadata: {
          query,
          results_count: 3,
          timestamp: new Date().toISOString(),
          source: "web_search_simulation"
        }
      };
    }

    case "analyze_text": {
      const text = args.text as string;
      const words = text.split(' ').filter(w => w.length > 3);
      const keywords = [...new Set(words)].slice(0, 5);
      
      return {
        content: `[텍스트 분석 결과]
핵심 키워드: ${keywords.join(', ')}
감정 톤: ${text.length > 100 ? '중립적/정보전달형' : '간결/직접적'}
주요 주제: ${words.slice(0, 3).join(', ')} 관련 내용
텍스트 길이: ${text.length}자
분석 신뢰도: 87%`,
        metadata: {
          keywords,
          sentiment: "neutral",
          word_count: words.length,
          analysis_type: args.analysis_type || "all"
        }
      };
    }

    case "fact_check": {
      const claim = args.claim as string;
      // 실제 환경에서는 팩트체킹 API나 지식 베이스 조회
      const confidence = Math.floor(Math.random() * 30) + 65; // 65-95% 시뮬레이션
      const verdict = confidence > 80 ? "대체로 사실" : confidence > 70 ? "부분적으로 사실" : "추가 검증 필요";
      
      return {
        content: `[팩트 체크 결과]
주장: "${claim}"
판정: ${verdict}
신뢰도: ${confidence}%
근거: 복수의 출처에서 관련 정보를 교차 확인한 결과입니다.
주의사항: 이 분석은 AI 기반이며, 중요한 결정에는 전문가 검토를 권장합니다.`,
        metadata: {
          claim,
          verdict,
          confidence,
          sources_checked: Math.floor(Math.random() * 5) + 3
        }
      };
    }

    default:
      throw new Error(`알 수 없는 MCP 도구: ${toolName}`);
  }
}

/**
 * MCP Tool을 OpenAI Function Calling 형식으로 변환
 * 
 * OpenAI API는 tools를 특정 형식으로 받습니다.
 * MCP Tool 정의를 그 형식에 맞게 변환합니다.
 */
export function convertToOpenAITools(mcpTools: typeof MCP_TOOLS) {
  return mcpTools.map(tool => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));
}
