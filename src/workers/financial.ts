import { AIMessage } from "@langchain/core/messages";
import { financialConfig } from "../agents/config.ts";
import { ChatClaudeCode } from "../claude/claude-code-chat.ts";
import type { State } from "../state.ts";
import { AGENTS } from "../agents/enums.ts";

const financialAi = new ChatClaudeCode(financialConfig);

export const financialAgent: typeof State.Node = async (state) => {
  console.log("Financial Agent foi chamado!");

  return {
    output: [new AIMessage({ content: "Olá!", name: AGENTS.FINANCIAL })],
  };
};
