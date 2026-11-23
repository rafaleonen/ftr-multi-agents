export const PROMPTS = {
  "comms:email":
    "Envie um email para o cliente falando que houve despesas no almoxarifado e que os avanços do projeto estão dentro do prazo",
  "bill:get": "Quero ver a minha conta",
  "bill:create": "Crie uma conta no valor de $150.00",
  "bill:pay": "Pague a minha conta",
  "appointment:schedule": "Faça o agendamento da consulta",
  "appointment:reschedule": "Reagende a consulta",
  "appointment:cancel": "Cancela a consulta agendada",
} as const;

export type PromptName = keyof typeof PROMPTS;

/**
 * Resolve o texto do prompt a partir dos args da CLI:
 * - `node src/main.ts bill:get`          → prompt pré-definido
 * - `node src/main.ts "qualquer texto"`  → usa o texto livre
 */
export function resolvePrompt(args: string[]): string {
  const input = args.join(" ").trim();
  if (!input) {
    const names = Object.keys(PROMPTS).join(", ");
    throw new Error(`Informe um prompt. Pré-definidos: ${names}`);
  }
  return input in PROMPTS ? PROMPTS[input as PromptName] : input;
}
