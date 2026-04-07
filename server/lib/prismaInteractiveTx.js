/**
 * Transações interativas longas (ex.: gravar MP3 em SourceAudio).
 * O padrão do Prisma (5s) estoura com BYTEA grande ou disco lento (P2028).
 */
export const interactiveTxOptions = {
  maxWait: 30_000,
  timeout: 120_000,
}
