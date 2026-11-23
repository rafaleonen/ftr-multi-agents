import { AIMessage, SystemMessage } from "@langchain/core/messages";
import { commsConfig } from "../agents/config.ts";
import { AGENTS } from "../agents/enums.ts";
import { ChatClaudeCode } from "../claude/claude-code-chat.ts";
import type { State } from "../state.ts";
import { createAgent } from "langchain";
import { sendEmail } from "../tools/message.ts";

const commsAgentAi = createAgent({
  model: new ChatClaudeCode(commsConfig),
  tools: [sendEmail],
  systemPrompt: new SystemMessage(
    `
      Você é um secretário de um consutório responsável por enviar
      comunicações para os clientes. Sumarize todas as conversas
      e envie um email para o cliente. Apenas envie o email e não
      espere nenhuma confirmação.
    `,
  ),
});

export const commsAgent: typeof State.Node = async (state) => {
  console.log("Comms Agent foi chamado!");

  const response = await commsAgentAi.invoke(state);

  const lastMessage =
    response.messages[response.messages.length - 1]?.content ?? "Sem conteúdo";

  return {
    messages: [new AIMessage({ content: lastMessage, name: AGENTS.COMMS })],
  };
};
