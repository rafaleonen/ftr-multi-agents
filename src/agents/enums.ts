export const AGENTS = {
  SUPERVISOR: "supervisor_agent",
  FINANCIAL: "financial_agent",
  SCHEDULING: "scheduling_agent",
  COMMS: "comms_agent",
} as const;

export type AGENTS = (typeof AGENTS)[keyof typeof AGENTS];
