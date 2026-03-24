import { prisma } from "@/lib/prisma";

/**
 * Apaga todos os dados de negócio (mantém schema). Útil para “começar do zero”
 * sem apagar o ficheiro SQLite.
 */
export async function truncateApplicationData(): Promise<{
  deleted: Record<string, number>;
}> {
  const r1 = await prisma.signalPrediction.deleteMany();
  const r2 = await prisma.event.deleteMany();
  const r3 = await prisma.tournament.deleteMany();
  const r4 = await prisma.strategySimRun.deleteMany();

  await prisma.telegramGaleState.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      maxAttempts: 4,
    },
    update: {
      messageId: null,
      galeLevel: 0,
      currentAttempt: 0,
      pendingEditNext: false,
    },
  });

  return {
    deleted: {
      signalPredictions: r1.count,
      events: r2.count,
      tournaments: r3.count,
      strategySimRuns: r4.count,
    },
  };
}
