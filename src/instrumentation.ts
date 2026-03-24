export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.ENABLE_COLLECTOR_CRON === "true"
  ) {
    const { runCollector } = await import("@/lib/collector");
    const INTERVAL = 60_000; // 1 min — virtual matches cycle every ~5 min
    const tick = async () => {
      try {
        const r = await runCollector();
        console.log(
          `[collector] ${r.eventsListed} listed, ${r.newResults} new, sinais +${r.signalsCreated} −${r.signalsPruned} velhos, ${r.signalsResolved} resolvidos, ${r.errors.length} err${r.captureOnly ? " [capture-only]" : ""}`,
        );
      } catch (e) {
        console.error("[collector]", e);
      }
    };
    tick();
    setInterval(tick, INTERVAL);
  }
}
