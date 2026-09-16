import { request } from "./client";
export async function register(name: string, id: string, password: string) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, user_id: id, password }),
  });
}
