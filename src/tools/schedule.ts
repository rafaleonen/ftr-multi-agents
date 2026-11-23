import { tool } from "langchain";
import z from "zod";

const emptyAppointmentSchema = z.object({});

export const scheduleAppointment = tool(
  async () => {
    console.log("Marcando uma nova consulta...");
    return "Consulta agendada!";
  },
  {
    name: "schedule_appointment",
    description: "Marca uma nova consulta",
    schema: emptyAppointmentSchema,
  },
);

export const rescheduleAppointment = tool(
  async () => {
    console.log("Remarcando uma nova consulta...");
    return "Consulta remarcada!";
  },
  {
    name: "reschedule_appointment",
    description: "Remarca uma consulta já agendada!",
    schema: emptyAppointmentSchema,
  },
);

export const cancelAppointment = tool(
  async () => {
    console.log("Cancelando consulta...");
    return "Consulta cancelada!";
  },
  {
    name: "cancela_appointment",
    description: "Cancela uma consulta já agendada!",
    schema: emptyAppointmentSchema,
  },
);
