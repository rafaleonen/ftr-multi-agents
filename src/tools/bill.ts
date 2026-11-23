import { tool } from "langchain";
import z from "zod";

const emptyBillSchema = z.object({});
const createBillSchema = z.object({
  price: z.number(),
});

export const payBill = tool(
  async () => {
    console.log("Pagando conta...");
    return "Conta paga com sucesso!";
  },
  {
    name: "pay_bill",
    description: "Pagar a conta do usuário",
    schema: emptyBillSchema,
  },
);

export const getBill = tool(
  async () => {
    console.log("Buscando valor da conta...");
    return "Sua conta tem o valor de R$500,00!";
  },
  {
    name: "get_bill",
    description: "Buscar a conta do usuário",
    schema: emptyBillSchema,
  },
);

export const createBill = tool(
  async ({ price }) => {
    console.log("Criando conta...");
    return `Conta de ${price} criada com sucesso!`;
  },
  {
    name: "create_bill",
    description: "Cria uma nova conta do usuário para ser paga",
    schema: createBillSchema,
  },
);
