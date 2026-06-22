import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function paginationArgs(input: PaginationQuery) {
  return {
    skip: (input.page - 1) * input.limit,
    take: input.limit
  };
}

export function paginationMeta(total: number, input: PaginationQuery) {
  const totalPages = Math.max(1, Math.ceil(total / input.limit));
  return {
    page: input.page,
    limit: input.limit,
    total,
    totalPages,
    from: total === 0 ? 0 : (input.page - 1) * input.limit + 1,
    to: Math.min(input.page * input.limit, total)
  };
}
