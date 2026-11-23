import { AIMessage } from "@langchain/core/messages";
import { END } from "@langchain/langgraph";
import { supervisorConfig } from "../agents/config.ts";
import { ChatClaudeCode } from "../claude/claude-code-chat.ts";
import type { State } from "../state.ts";
import { AGENTS } from "../agents/enums.ts";
import { routingTool } from "../tools/routing.ts";

const supervisorAi = new ChatClaudeCode(supervisorConfig);

export const supervisorAgent: typeof State.Node = async (state) => {
  console.log("Supervisor escolhendo o próximo");

  const aiWithTool = supervisorAi.bindTools([routingTool], {
    tool_choice: "routingTool",
  });

  const response = await aiWithTool.invoke([
    state.input,
    ...state.output,
    { role: "user", content: "Escolha o próximo estado!" },
  ]);

  const call = response.tool_calls?.[0];
  const next = call?.args.next as string | undefined;

  return {
    next: next && next !== END ? [next] : [],
    output: [
      new AIMessage({
        content: `Próximo: ${next ?? END}`,
        name: AGENTS.SUPERVISOR,
      }),
    ],
  };
};
