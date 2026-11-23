import { AIMessage, SystemMessage } from "@langchain/core/messages";
import { financialConfig } from "../agents/config.ts";
import { ChatClaudeCode } from "../claude/claude-code-chat.ts";
import type { State } from "../state.ts";
import { AGENTS } from "../agents/enums.ts";
import { createAgent } from "langchain";
import { createBill, getBill, payBill } from "../tools/bill.ts";

const financialAgentAI = createAgent({
  model: new ChatClaudeCode(financialConfig),
  tools: [payBill, getBill, createBill],
  systemPrompt: new SystemMessage(
    `
      Você é um analista financeiro de um consutório
      analise a conversa e tome a melhor decisão
      para atender o usuário.
    `,
  ),
});

export const financialAgent: typeof State.Node = async (state) => {
  console.log("Financial Agent foi chamado!");

  const response = await financialAgentAI.invoke(state);

  const lastMessage =
    response.messages[response.messages.length - 1]?.content ?? "Sem conteúdo";

  return {
    messages: [
      new AIMessage({
        content: lastMessage,
        name: AGENTS.FINANCIAL,
      }),
    ],
  };
};
