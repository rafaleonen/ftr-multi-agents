import { tool } from "langchain";
import z from "zod";

const sendEmailSchema = z.object({
  emailContent: z.email(),
});

export const sendEmail = tool(
  async ({ emailContent }) => {
    console.log("Enviando email para o usuário...");
    console.log("Email Content: ", emailContent);
    return `Email enviado com sucesso!`;
  },
  {
    name: "send_email",
    description: "Marca uma nova consulta",
    schema: sendEmailSchema,
  },
);
