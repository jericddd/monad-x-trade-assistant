const CURSOR_HEADER = "x-cursor";

export async function getMentionCursor(coordinator: DurableObjectStub): Promise<string | null> {
  const response = await coordinator.fetch("https://trade-coordinator/cursor", {
    method: "GET",
  });

  if (response.status === 404) {
    return null;
  }

  return response.headers.get(CURSOR_HEADER);
}

export async function setMentionCursor(
  coordinator: DurableObjectStub,
  cursor: string,
): Promise<void> {
  await coordinator.fetch("https://trade-coordinator/cursor", {
    method: "PUT",
    headers: { [CURSOR_HEADER]: cursor },
  });
}

export function selectSinceId(
  cursor: string | null,
  newestProcessedId?: string | null,
): string | undefined {
  return newestProcessedId ?? cursor ?? undefined;
}
