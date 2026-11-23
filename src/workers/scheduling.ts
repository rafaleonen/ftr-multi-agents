import { AIMessage, SystemMessage } from "@langchain/core/messages";
import { schedulingConfig } from "../agents/config.ts";
import { AGENTS } from "../agents/enums.ts";
import { ChatClaudeCode } from "../claude/claude-code-chat.ts";
import type { State } from "../state.ts";
import { createAgent } from "langchain";
import {
  cancelAppointment,
  rescheduleAppointment,
  scheduleAppointment,
} from "../tools/schedule.ts";

const schedulingAgentAi = createAgent({
  model: new ChatClaudeCode(schedulingConfig),
  tools: [scheduleAppointment, rescheduleAppointment, cancelAppointment],
  systemPrompt: new SystemMessage(
    `
      Você é um secretário de um consutório, responsável
      por organizar a agenda. Você não precisa de informação adicional
      como data ou nome da consulta, apenas chame as tools.
      Analise a conversa e tome a melhor decisão para atender o usuário.
    `,
  ),
});

export const schedulingAgent: typeof State.Node = async (state) => {
  console.log("Scheduling Agent foi chamado!");

  const response = await schedulingAgentAi.invoke(state);

  const lastMessage =
    response.messages[response.messages.length - 1]?.content ?? "Sem conteúdo";

  return {
    messages: [new AIMessage({ content: lastMessage, name: AGENTS.FINANCIAL })],
  };
};
