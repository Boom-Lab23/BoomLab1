import { z } from "zod";
import { router, publicProcedure } from "./init";

const personalityEnum = z.enum(["Introvertido", "Extrovertido", "Misto"]);

export const clientCommercialsRouter = router({
  /**
   * Lista todos os comerciais activos de um cliente, ordenados por nome.
   */
  list: publicProcedure
    .input(z.object({ clientId: z.string(), includeInactive: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.clientCommercial.findMany({
        where: {
          clientId: input.clientId,
          ...(input.includeInactive ? {} : { isActive: true }),
        },
        orderBy: { name: "asc" },
      });
    }),

  /**
   * Cria um comercial novo OU actualiza um existente (por id).
   * Para criar: passa clientId + name. Para actualizar: passa id.
   */
  upsert: publicProcedure
    .input(
      z.object({
        id: z.string().optional(),
        clientId: z.string(),
        name: z.string().min(1, "Nome obrigatorio").trim(),
        personality: personalityEnum.nullable().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, clientId, name, personality, isActive } = input;
      if (id) {
        return ctx.prisma.clientCommercial.update({
          where: { id },
          data: {
            name: name.trim(),
            ...(personality !== undefined ? { personality: personality } : {}),
            ...(isActive !== undefined ? { isActive } : {}),
          },
        });
      }
      // Create — usar upsert por (clientId, name) para idempotencia
      return ctx.prisma.clientCommercial.upsert({
        where: { clientId_name: { clientId, name: name.trim() } },
        create: {
          clientId,
          name: name.trim(),
          personality: personality ?? null,
          isActive: isActive ?? true,
        },
        update: {
          ...(personality !== undefined ? { personality: personality } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
      });
    }),

  /**
   * Remove (soft-delete: marca isActive=false).
   * Mantemos historico para nao partir analises antigas.
   */
  remove: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.clientCommercial.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  /**
   * Get por id - usado pelo analisador de chamadas para obter a personalidade.
   */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.clientCommercial.findUnique({
        where: { id: input.id },
      });
    }),
});
