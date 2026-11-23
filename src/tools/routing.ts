import z from "zod";
import { AGENTS } from "../agents/enums.ts";
import { END } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";

const routingSchema = z.object({
  next: z.enum([AGENTS.FINANCIAL, AGENTS.SCHEDULING, AGENTS.COMMS, END]),
});

export const routingTool = tool(async ({ next }) => next, {
  name: "routingTool",
  description: "Selecione o próximo estado",
  schema: routingSchema,
});
