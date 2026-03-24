/** REST /v2/.../events/by-date ou /events/{id} item */
export type SuperbetEventItem = {
  eventId: number;
  matchName: string;
  tournamentId: number;
  sportId: number;
  categoryId: number;
  utcDate: string;
  matchDate?: string;
  /** Metadados da oferta: `counts.odds["1"]` = linhas em prematch ativo (87 típ.); by-date só manda ~3 em `odds[]`. */
  counts?: {
    odds?: Record<string, number>;
    markets?: Record<string, number>;
  };
  marketCount?: number;
  odds?: Array<{
    marketName: string;
    name: string;
    price: number;
    info?: string;
  }>;
};

export type EventsByDateResponse = {
  error: boolean;
  data?: SuperbetEventItem[];
};

/** SSE /v3/subscription/... payload item */
export type SubscriptionFixture = {
  uuid: string;
  home_team_id: string;
  away_team_id: string;
  category_id: number;
  event_date: string;
  event_name: string;
  sport_id: number;
  tournament_id: number;
  utc_date: string;
  offer_state_status?: Record<string, number>;
};

export type SubscriptionInplayStats = {
  home_team_score?: string;
  away_team_score?: string;
  periods?: Array<{
    home_team_score: string;
    away_team_score: string;
    num: number;
    type: number;
  }>;
};

export type SubscriptionInplayMetadata = {
  status?: string;
  event_status_label?: string;
  period_status?: string;
};

export type SubscriptionEventPayload = {
  event_id: number;
  increment_id?: number;
  fixture: SubscriptionFixture;
  inplay_stats?: SubscriptionInplayStats;
  inplay_stats_metadata?: SubscriptionInplayMetadata;
  markets?: unknown[];
};

export type CollectorRunResult = {
  ok: boolean;
  at: string;
  eventsListed: number;
  subscriptionBatches: number;
  upsertedEvents: number;
  updatedFromSubscription: number;
  newResults: number;
  signalsCreated: number;
  signalsResolved: number;
  /** Sinais pendentes apagados (gerados com janela antiga / jogo longe demais). */
  signalsPruned: number;
  /** `true` quando `ENABLE_SIGNALS=false`: só oferta, odds, resultados e liquidação. */
  captureOnly?: boolean;
  errors: string[];
};
