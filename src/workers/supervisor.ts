import { AIMessage } from "@langchain/core/messages";
import { END } from "@langchain/langgraph";
import { supervisorConfig } from "../agents/config.ts";
import { ChatClaudeCode } from "../claude/claude-code-chat.ts";
import type { State } from "../state.ts";
import { AGENTS } from "../agents/enums.ts";
import { routingTool } from "../tools/routing.ts";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

const supervisorAi = new ChatClaudeCode(supervisorConfig);

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `
      Você é o supervisor de um consultório.
      Tome a melhor ação para atender a necessidade
      com base na conversa a seguir:
    `,
  ],
  // messages que serão inseridas a partir de state
  new MessagesPlaceholder("messages"),
  [
    "human",
    `
      Escolha um desses próximos estados:
      ${AGENTS.FINANCIAL}, ${AGENTS.SCHEDULING}, ${AGENTS.COMMS}
      ou END (estado terminal se não tiver mais nada para fazer)
    `,
  ],
]);

export const supervisorAgent: typeof State.Node = async (state) => {
  console.log("Supervisor escolhendo o próximo");

  const aiWithTool = supervisorAi.bindTools([routingTool], {
    tool_choice: routingTool.name,
  });

  const chain = prompt.pipe(aiWithTool);

  const response = await chain.invoke({
    messages: state.messages,
  });

  const call = response.tool_calls?.[0];
  const next = call?.args.next as string | undefined;

  return {
    next: next && next !== END ? [next] : [],
    messages: [
      new AIMessage({
        content: `Próximo: ${next ?? END}`,
        name: AGENTS.SUPERVISOR,
      }),
    ],
  };
};
