# ftr-multi-agents

Sistema multi-agente de um consultório fictício, construído com **LangChain / LangGraph** e usando o **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) como modelo de linguagem.

## Sumário

- [Objetivo](#objetivo)
- [Como rodar](#como-rodar)
- [Arquitetura](#arquitetura)
  - [O grafo](#o-grafo)
  - [Estado](#estado)
  - [Supervisor](#supervisor)
  - [Workers](#workers)
  - [Tools](#tools)
- [ChatClaudeCode: o adapter](#chatclaudecode-o-adapter)
- [Configuração dos agentes](#configuração-dos-agentes)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Limitações conhecidas](#limitações-conhecidas)

## Objetivo

Este projeto é **de estudo**. O intuito é aprender a usar o ecossistema LangChain (`@langchain/core`, `@langchain/langgraph`, `langchain`) tendo o **Claude Agent SDK** como "motor" do modelo, em vez de um provedor tradicional como `ChatAnthropic` ou `ChatOpenAI`.

Os principais conceitos praticados:

- Escrever um **chat model customizado** (`BaseChatModel`) que conversa com o Claude Agent SDK.
- Implementar **tool calling** em um modelo que não tem isso nativamente no formato do LangChain.
- Montar um **grafo com LangGraph** (`StateGraph`) com nós, arestas condicionais e estado compartilhado.
- Usar o padrão **supervisor + workers** para rotear pedidos entre agentes especializados.
- Usar **agentes ReAct** (`createAgent` do `langchain`) que decidem sozinhos quais tools chamar.

As tools são simuladas (só fazem `console.log` e retornam texto fixo). O foco está no fluxo entre os agentes, não na lógica de negócio.

## Como rodar

### Pré-requisitos

- **Node.js 24+**: o projeto roda arquivos `.ts` direto com `node`, sem etapa de build. O Node faz só a remoção de tipos, então recursos que geram código JavaScript, como `enum`, não funcionam (por isso `AGENTS` é um objeto `as const`).
- **pnpm**
- **Autenticação do Claude**: o Claude Agent SDK usa o login do Claude Code instalado na máquina ou a variável `ANTHROPIC_API_KEY`.

### Instalação

```bash
pnpm install
```

### Comandos

Cada script envia um prompt pré-definido (veja `src/prompts.ts`) como primeira mensagem do usuário:

| Comando                       | Prompt enviado                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm bill:get`               | Quero ver a minha conta                                                                                                    |
| `pnpm bill:create`            | Crie uma conta no valor de $150.00                                                                                         |
| `pnpm bill:pay`               | Pague a minha conta                                                                                                        |
| `pnpm appointment:schedule`   | Faça o agendamento da consulta                                                                                             |
| `pnpm appointment:reschedule` | Reagende a consulta                                                                                                        |
| `pnpm appointment:cancel`     | Cancela a consulta agendada                                                                                                |
| `pnpm comms:email`            | Envie um email para o cliente falando que houve despesas no almoxarifado e que os avanços do projeto estão dentro do prazo |

Também dá para mandar um texto livre:

```bash
pnpm chat "Quanto devo?"
```

Exemplo de saída:

```
Supervisor escolhendo o próximo
Financial Agent foi chamado!
Buscando valor da conta...
Supervisor escolhendo o próximo
[
  'Human: Quanto devo?',
  'supervisor_agent: Próximo: financial_agent',
  'financial_agent: Sua conta tem o valor de R$500,00. ...',
  'supervisor_agent: Próximo: __end__'
]
```

## Arquitetura

### O grafo

Definido em `src/main.ts` com `StateGraph`:

```
              ┌──────────────────────────────┐
              ▼                              │
START ──► supervisor ──┬──► financial ───────┤
                       ├──► scheduling ──────┤
                       ├──► comms ───────────┘
                       └──► END
```

1. Todo pedido começa no **supervisor**.
2. O supervisor escolhe um worker ou `END` (aresta condicional baseada em `state.next`).
3. O worker resolve sua parte e **volta para o supervisor**, que decide se ainda falta algo.
4. O ciclo termina quando o supervisor escolhe `END`. O `recursionLimit: 10` é uma trava de segurança caso a lógica de parada falhe.

### Estado

`src/state.ts`:

```ts
export const State = new StateSchema({
  messages: MessagesValue,
  next: z.array(z.string()).default(() => []),
});
```

- **`messages`**: histórico da conversa. `MessagesValue` usa o reducer `messagesStateReducer`, então cada nó **retorna só as mensagens novas**, que são concatenadas ao histórico (mensagens com o mesmo `id` são substituídas).
- **`next`**: decisão do supervisor. Não tem reducer, então cada retorno **sobrescreve** o valor anterior.

### Supervisor

`src/workers/supervisor.ts`

Monta um `ChatPromptTemplate` (system + histórico via `MessagesPlaceholder` + instrução final) e o encadeia com o modelo:

```ts
const aiWithTool = supervisorAi.bindTools([routingTool], {
  tool_choice: routingTool.name, // força o modelo a usar a routing tool
});

const chain = prompt.pipe(aiWithTool);
const response = await chain.invoke({ messages: state.messages });

const next = response.tool_calls?.[0]?.args.next;
```

A `routingTool` **nunca é executada**: ela serve só como schema para obrigar o modelo a devolver `{ next: "<agente>" | "__end__" }` de forma estruturada.

### Workers

`src/workers/{financial,scheduling,comms}.ts`

Cada worker é um agente ReAct criado com `createAgent` (do pacote `langchain`, substituto do `createReactAgent` que está deprecated):

```ts
const financialAgentAI = createAgent({
  model: new ChatClaudeCode(financialConfig),
  tools: [payBill, getBill, createBill],
  systemPrompt: new SystemMessage("Você é um analista financeiro..."),
});
```

O agente repete este ciclo: **modelo → tool_calls → executa tools → ToolMessage → modelo**, até o modelo responder sem tool calls. O nó do grafo pega a última mensagem e a devolve como `AIMessage` com o `name` do agente.

| Worker       | Responsabilidade          | Tools                                                                   |
| ------------ | ------------------------- | ----------------------------------------------------------------------- |
| `financial`  | Contas do usuário         | `get_bill`, `create_bill`, `pay_bill`                                   |
| `scheduling` | Agenda de consultas       | `schedule_appointment`, `reschedule_appointment`, `cancela_appointment` |
| `comms`      | Comunicação com o cliente | `send_email`                                                            |

### Tools

`src/tools/*.ts`

Criadas com a função `tool()`, que gera um `DynamicStructuredTool`:

```ts
export const getBill = tool(async () => "Sua conta tem o valor de R$500,00!", {
  name: "get_bill",
  description: "Buscar a conta do usuário",
  schema: z.object({}),
});
```

Boas práticas usadas:

- O schema é sempre um `z.object(...)`, mesmo sem parâmetros (`z.object({})`), porque provedores exigem JSON Schema do tipo `object`.
- Os nomes seguem `snake_case`, o formato mais compatível entre provedores.

## ChatClaudeCode: o adapter

`src/claude/claude-code-chat.ts` é o coração do projeto. Ele estende `BaseChatModel` e traduz entre o mundo LangChain e o `query()` do Claude Agent SDK, ocupando o lugar que o `ChatAnthropic` teria.

**Mensagens → prompt**

- O `systemPrompt` da config e todas as `SystemMessage` recebidas são **concatenados** no `systemPrompt` do SDK. Ou seja, o `systemPrompt` passado no `createAgent` ou no template **não substitui** o da config: os dois são somados.
- As demais mensagens viram um transcript `User: ... / Assistant: ...`.

**Tool calling via structured output**

O Claude Agent SDK não executa as tools do LangChain. Em vez disso:

1. `bindTools()` guarda as tools nas call options.
2. No `_generate`, as tools viram um JSON Schema de resposta (`outputFormat`) no formato `{ content, tool_calls: [{ name, args }] }`.
3. O `structured_output` retornado pelo SDK é convertido em `AIMessage.tool_calls`, o formato padrão do LangChain.

Por isso, qualquer componente do LangChain que espera um chat model com tool calling (`createAgent`, `ToolNode`, `bindTools` + `tool_choice`) funciona com ele.

`tool_choice` suportado:

| Valor                | Comportamento                                  |
| -------------------- | ---------------------------------------------- |
| `"auto"` (padrão)    | Pode responder só com texto (`tool_calls: []`) |
| `"any"`/`"required"` | Precisa chamar pelo menos uma tool             |
| `"<nome_da_tool>"`   | Só aquela tool, obrigatória                    |
| `"none"`             | Ignora as tools                                |

**Isolamento**

- `settingSources: []`: não carrega `CLAUDE.md` nem os settings do projeto.
- `tools` / `allowedTools`: só as ferramentas nativas do Claude Code listadas na config ficam disponíveis (`[]` = chat puro).

## Configuração dos agentes

`src/agents/config.ts` define, por agente, as opções repassadas ao SDK:

```ts
export const financialConfig: AgentConfig = {
  model: "claude-sonnet-5-5",
  effort: "medium",
  allowedTools: ["Read", "Grep", "Glob"], // ferramentas nativas do Claude Code
  systemPrompt: "Você é o agente financeiro.",
};
```

- `model`: alias (`haiku`, `sonnet`, `opus`) ou ID completo.
- `maxTurns`: padrão de 1 sem ferramentas nativas, ou 10 com elas. Com structured output o mínimo é 3, porque o SDK usa uma tool interna e faz retries de validação.

## Estrutura de pastas

```
src/
├── main.ts                  # monta o grafo e lê o prompt dos args da CLI
├── prompts.ts               # prompts pré-definidos dos scripts pnpm
├── state.ts                 # schema do estado do grafo
├── agents/
│   ├── config.ts            # modelo, effort, tools e systemPrompt de cada agente
│   └── enums.ts             # nomes dos agentes (AGENTS)
├── claude/
│   └── claude-code-chat.ts  # adapter LangChain ⇄ Claude Agent SDK
├── tools/
│   ├── bill.ts              # get/create/pay bill
│   ├── message.ts           # send_email
│   ├── routing.ts           # routing_tool do supervisor
│   └── schedule.ts          # schedule/reschedule/cancel appointment
└── workers/
    ├── supervisor.ts        # roteador
    ├── financial.ts
    ├── scheduling.ts
    └── comms.ts
```

## Limitações conhecidas

- **Histórico de tools no transcript:** o adapter transforma `AIMessage` com `tool_calls` e `ToolMessage` em linhas `Assistant: <texto>`. Assim o modelo não vê as chamadas que já fez nem os resultados delas, e pode chamar a mesma tool mais de uma vez dentro do ciclo ReAct.
- **Sem streaming real de tokens:** o texto chega por bloco de mensagem do SDK, não token a token.
- **Cada chamada do modelo é um `query()` novo:** o histórico é reenviado inteiro a cada vez, sem sessão persistente no Claude Code.
