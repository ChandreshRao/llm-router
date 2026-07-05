export type Api = ReturnType<typeof makeApi>;

export function makeApi(adminToken: string) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      const text = await response.text();
      let message = text;
      try {
        const body = JSON.parse(text) as { error?: string };
        if (body.error) {
          message = body.error;
        }
      } catch {
        // keep raw response text
      }
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }

  return {
    get: <T,>(path: string) => request<T>(path),
    post: <T = { ok: boolean },>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
    put: <T = { ok: boolean },>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
    patch: <T = { ok: boolean },>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
    delete: <T = { ok: boolean },>(path: string) => request<T>(path, { method: "DELETE" })
  };
}
