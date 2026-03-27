export interface ResearchIteration {
  id: string;
  iterationNum: number;
  userPrompt: string;
  generatedPrompt: string | null;
  resultMarkdown: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface ResearchSession {
  id: string;
  userId: string;
  title: string;
  status: "active" | "completed" | "archived";
  iterations: ResearchIteration[];
  createdAt: string;
  updatedAt: string;
}

// State machine for the client-side research flow
export type ResearchFlowState =
  | { step: "input" }
  | { step: "generating-prompt"; userQuestion: string }
  | { step: "editing-prompt"; userQuestion: string; generatedPrompt: string }
  | { step: "researching"; prompt: string; streamedText: string }
  | { step: "complete"; prompt: string; result: string }
  | { step: "error"; message: string };

export type ResearchAction =
  | { type: "START_GENERATE"; userQuestion: string }
  | { type: "PROMPT_GENERATED"; generatedPrompt: string }
  | { type: "START_RESEARCH"; prompt: string }
  | { type: "STREAM_CHUNK"; text: string }
  | { type: "COMPLETE"; result: string }
  | { type: "ERROR"; message: string }
  | { type: "RESET" };

export const MAX_ITERATIONS = 10;

export function researchReducer(
  state: ResearchFlowState,
  action: ResearchAction
): ResearchFlowState {
  switch (action.type) {
    case "START_GENERATE":
      return { step: "generating-prompt", userQuestion: action.userQuestion };
    case "PROMPT_GENERATED":
      if (state.step !== "generating-prompt") return state;
      return {
        step: "editing-prompt",
        userQuestion: state.userQuestion,
        generatedPrompt: action.generatedPrompt,
      };
    case "START_RESEARCH":
      return { step: "researching", prompt: action.prompt, streamedText: "" };
    case "STREAM_CHUNK":
      if (state.step !== "researching") return state;
      return { ...state, streamedText: action.text };
    case "COMPLETE":
      return {
        step: "complete",
        prompt: state.step === "researching" ? state.prompt : "",
        result: action.result,
      };
    case "ERROR":
      return { step: "error", message: action.message };
    case "RESET":
      return { step: "input" };
    default:
      return state;
  }
}
