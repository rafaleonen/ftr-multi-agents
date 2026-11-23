import { StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { AGENTS } from "./agents/enums.ts";
import { supervisorAgent } from "./workers/supervisor.ts";
import { State } from "./state.ts";
import { financialAgent } from "./workers/financial.ts";
import { schedulingAgent } from "./workers/scheduling.ts";
import { commsAgent } from "./workers/comms.ts";

const WORKERS = [AGENTS.FINANCIAL, AGENTS.SCHEDULING, AGENTS.COMMS];

const graph = new StateGraph(State)
  .addNode(AGENTS.SUPERVISOR, supervisorAgent)
  .addNode(AGENTS.FINANCIAL, financialAgent)
  .addNode(AGENTS.SCHEDULING, schedulingAgent)
  .addNode(AGENTS.COMMS, commsAgent)
  .addEdge(START, AGENTS.SUPERVISOR)
  // Única saída do supervisor: lista de workers (paralelo) ou END
  .addConditionalEdges(
    AGENTS.SUPERVISOR,
    (state) => (state.next.length > 0 ? state.next : END),
    [...WORKERS, END],
  )
  // Workers voltam para o supervisor avaliar
  .addEdge(AGENTS.FINANCIAL, AGENTS.SUPERVISOR)
  .addEdge(AGENTS.SCHEDULING, AGENTS.SUPERVISOR)
  .addEdge(AGENTS.COMMS, AGENTS.SUPERVISOR)
  .compile();

const result = await graph.invoke(
  { input: new HumanMessage("Olá do Humano") },
  { recursionLimit: 10 }, // trava de segurança caso a lógica de parada falhe
);

console.log(result.output.map((m) => `${m.name}: ${m.content}`));
