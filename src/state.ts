import type { HumanMessage } from "@langchain/core/messages";
import { MessagesValue, StateSchema } from "@langchain/langgraph";
import z from "zod";

export const State = new StateSchema({
  input: z.custom<HumanMessage>(),
  output: MessagesValue,
  next: z.array(z.string()).default(() => []), // decisão do supervisor (só ele escreve)
});
