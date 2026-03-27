export async function apiGet(path: string) {
  const res = await fetch(path, { credentials: 'include' });
  if (!res.ok) throw new Error((await safeJson(res)).error || `GET ${path} failed`);
  return res.json();
}

export async function apiPost(path: string, body?: any) {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error((await safeJson(res)).error || `POST ${path} failed`);
  return res.json();
}

export async function apiPut(path: string, body?: any) {
  const res = await fetch(path, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error((await safeJson(res)).error || `PUT ${path} failed`);
  return res.json();
}

export async function apiDelete(path: string) {
  const res = await fetch(path, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error((await safeJson(res)).error || `DELETE ${path} failed`);
  return res.json();
}

export async function getHabitHistory(id: number) {
  return apiGet(`/api/habits/${id}/history`);
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}
