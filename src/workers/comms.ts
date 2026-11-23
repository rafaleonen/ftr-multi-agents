import { AIMessage } from "@langchain/core/messages";
import { commsConfig } from "../agents/config.ts";
import { AGENTS } from "../agents/enums.ts";
import { ChatClaudeCode } from "../claude/claude-code-chat.ts";
import type { State } from "../state.ts";

const commsAi = new ChatClaudeCode(commsConfig);

export const commsAgent: typeof State.Node = async (state) => {
  console.log("Comms Agent foi chamado!");

  return {
    output: [new AIMessage({ content: "Olá!", name: AGENTS.COMMS })],
  };
};
