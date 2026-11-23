import { randomUUID } from "node:crypto";
import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import {
  BaseChatModel,
  type BaseChatModelCallOptions,
  type BaseChatModelParams,
  type BindToolsInput,
} from "@langchain/core/language_models/chat_models";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { AIMessage, type BaseMessage, type AIMessageChunk } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import type { Runnable } from "@langchain/core/runnables";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import type { AgentConfig } from "../agents/config.ts";

export interface ChatClaudeCodeParams extends BaseChatModelParams, AgentConfig {}

export interface ChatClaudeCodeCallOptions extends BaseChatModelCallOptions {
  tools?: BindToolsInput[];
}

type ToolDef = { name: string; description?: string; parameters: Record<string, unknown> };

export class ChatClaudeCode extends BaseChatModel<ChatClaudeCodeCallOptions> {
  model: string;
  effort?: Options["effort"];
  allowedTools: string[];
  maxTurns: number;
  systemPrompt?: string;

  constructor(fields: ChatClaudeCodeParams = {}) {
    super(fields);
    this.model = fields.model ?? "haiku"; // "haiku", "sonnet", "opus" ou o ID completo
    this.effort = fields.effort ?? "medium";
    this.allowedTools = fields.allowedTools ?? [];
    // Sem ferramentas basta 1 turno; com ferramentas o agente precisa de turnos
    // extras para chamar a ferramenta e responder com o resultado.
    this.maxTurns =
      fields.maxTurns ?? (this.allowedTools.length > 0 ? 10 : 1);
    this.systemPrompt = fields.systemPrompt;
  }

  _llmType() {
    return "claude-code";
  }

  /**
   * As tools do LangChain NÃO são executadas pelo Claude Code: viram um JSON
   * schema (structured output) e a resposta volta como `AIMessage.tool_calls`,
   * igual a qualquer chat model com tool calling.
   */
  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<ChatClaudeCodeCallOptions>,
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, ChatClaudeCodeCallOptions> {
    return this.withConfig({ tools, ...kwargs }) as unknown as Runnable<
      BaseLanguageModelInput,
      AIMessageChunk,
      ChatClaudeCodeCallOptions
    >;
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    // systemPrompt da config + mensagens de sistema viram o systemPrompt;
    // o resto vira um transcript
    const system = [
      this.systemPrompt,
      ...messages.filter((m) => m.type === "system").map((m) => m.text),
    ]
      .filter(Boolean)
      .join("\n\n");

    const prompt = messages
      .filter((m) => m.type !== "system")
      .map((m) => `${m.type === "human" ? "User" : "Assistant"}: ${m.text}`)
      .join("\n\n");

    const toolDefs = this.selectTools(options);
    const outputFormat = toolDefs.length
      ? buildToolCallSchema(toolDefs, options.tool_choice)
      : undefined;

    const abort = new AbortController();
    options.signal?.addEventListener("abort", () => abort.abort());

    let text = "";
    let structured: unknown;
    for await (const msg of query({
      prompt,
      options: {
        model: this.model,
        systemPrompt: system || undefined,
        effort: this.effort,
        tools: this.allowedTools, // só estas ferramentas existem ([] = "chat puro")
        allowedTools: this.allowedTools, // e são aprovadas sem pedir permissão
        // structured output usa uma tool interna + retries de validação
        maxTurns: outputFormat ? Math.max(this.maxTurns, 3) : this.maxTurns,
        outputFormat,
        settingSources: [], // não carrega CLAUDE.md nem settings do projeto
        abortController: abort,
      },
    })) {
      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text") {
            text += block.text;
            await runManager?.handleLLMNewToken(block.text);
          }
        }
      } else if (msg.type === "result") {
        if (msg.subtype !== "success") {
          throw new Error(`Claude Code falhou: ${msg.subtype}`);
        }
        structured = msg.structured_output;
      }
    }

    const message = outputFormat
      ? toAIMessage(structured)
      : new AIMessage({ content: text });

    return { generations: [{ text: String(message.content), message }] };
  }

  /** Normaliza as tools bindadas e aplica tool_choice "none". */
  private selectTools(options: ChatClaudeCodeCallOptions): ToolDef[] {
    if (!options.tools?.length || options.tool_choice === "none") return [];
    return options.tools.map((t) => {
      const { function: fn } = convertToOpenAITool(t);
      return {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters as Record<string, unknown>,
      };
    });
  }
}

/** Nome da tool forçada por tool_choice (string ou formatos objeto), se houver. */
function forcedToolName(choice: unknown): string | undefined {
  if (typeof choice === "string") {
    return ["auto", "any", "required", "none"].includes(choice) ? undefined : choice;
  }
  if (choice && typeof choice === "object") {
    const c = choice as { name?: string; function?: { name?: string } };
    return c.function?.name ?? c.name;
  }
  return undefined;
}

/**
 * Schema da resposta: { content, tool_calls: [{ name, args }] }.
 * - tool_choice "<nome>": só aquela tool, obrigatória
 * - "any" / "required": pelo menos uma tool
 * - "auto" (padrão): pode responder só com texto
 */
function buildToolCallSchema(
  tools: ToolDef[],
  choice: unknown,
): NonNullable<Options["outputFormat"]> {
  const forced = forcedToolName(choice);
  const selected = forced ? tools.filter((t) => t.name === forced) : tools;
  if (forced && !selected.length) {
    throw new Error(`tool_choice "${forced}" não está entre as tools bindadas`);
  }
  const mustCall = Boolean(forced) || choice === "any" || choice === "required";

  return {
    type: "json_schema",
    schema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Resposta em texto (opcional)" },
        tool_calls: {
          type: "array",
          ...(mustCall ? { minItems: 1 } : {}),
          items: {
            anyOf: selected.map((t) => ({
              type: "object",
              description: t.description,
              properties: { name: { const: t.name }, args: t.parameters },
              required: ["name", "args"],
              additionalProperties: false,
            })),
          },
        },
      },
      required: ["tool_calls"],
      additionalProperties: false,
    },
  };
}

function toAIMessage(structured: unknown): AIMessage {
  const out = (structured ?? {}) as {
    content?: string;
    tool_calls?: { name: string; args: Record<string, unknown> }[];
  };
  return new AIMessage({
    content: out.content ?? "",
    tool_calls: (out.tool_calls ?? []).map((tc) => ({
      id: `call_${randomUUID()}`,
      name: tc.name,
      args: tc.args,
      type: "tool_call" as const,
    })),
  });
}
