import { AIMessage } from "@langchain/core/messages";
import { schedulingConfig } from "../agents/config.ts";
import { AGENTS } from "../agents/enums.ts";
import { ChatClaudeCode } from "../claude/claude-code-chat.ts";
import type { State } from "../state.ts";

const schedulingAi = new ChatClaudeCode(schedulingConfig);

export const schedulingAgent: typeof State.Node = async (state) => {
  console.log("Scheduling Agent foi chamado!");

  return {
    output: [new AIMessage({ content: "Olá!", name: AGENTS.FINANCIAL })],
  };
};
