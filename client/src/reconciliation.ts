export interface ReconciliationEntity {
  id: string;
  kind: string;
}

export interface ReconciliationSnapshot {
  world?: {
    entities?: ReconciliationEntity[];
  };
}

export function reconcilePredictedBullets(
  predictedBullets: Map<string, unknown>,
  snapshot: ReconciliationSnapshot | null
): void {
  const entities = snapshot?.world?.entities || [];

  const serverBulletIds = new Set(
    entities
      .filter((entity) => entity.kind === 'bullet')
      .map((entity) => String(entity.id))
  );

  for (const shotId of predictedBullets.keys()) {
    if (serverBulletIds.has(String(shotId))) {
      predictedBullets.delete(shotId);
    }
  }
}
