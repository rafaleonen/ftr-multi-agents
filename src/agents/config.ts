import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { AGENTS } from "./enums.ts";

export type AgentConfig = Pick<
  Options,
  "model" | "effort" | "allowedTools" | "maxTurns"
> & {
  systemPrompt?: string; // só string: é concatenado com as SystemMessages do LangChain
};

export const supervisorConfig: AgentConfig = {
  model: "claude-sonnet-5-5",
  effort: "medium",
  allowedTools: [],
  maxTurns: 1,
  systemPrompt: "Você coordena os agentes financial, scheduling e comms.",
};

export const financialConfig: AgentConfig = {
  model: "claude-sonnet-5-5",
  effort: "medium",
  allowedTools: ["Read", "Grep", "Glob"],
  systemPrompt: "Você é o agente financeiro.",
};

export const schedulingConfig: AgentConfig = {
  model: "claude-sonnet-5-5",
  effort: "medium",
  allowedTools: ["Read", "Grep", "Glob"],
  systemPrompt: "Você é o agente de agendamento.",
};

export const commsConfig: AgentConfig = {
  model: "claude-haiku-5-5",
  allowedTools: ["Read", "Grep", "Glob"],
  systemPrompt: "Você é o agente de comunicação.",
};

export const AGENT_CONFIG: Record<AGENTS, AgentConfig> = {
  [AGENTS.SUPERVISOR]: supervisorConfig,
  [AGENTS.FINANCIAL]: financialConfig,
  [AGENTS.SCHEDULING]: schedulingConfig,
  [AGENTS.COMMS]: commsConfig,
};
