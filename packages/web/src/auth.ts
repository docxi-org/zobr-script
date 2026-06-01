import { useState, useCallback } from "react";
import { api, setTokens, clearTokens, getToken, type ApiError } from "./api/client";

export type Role = "architect" | "executor" | "admin";

export interface User {
  id: string;
  email: string;
  role: Role;
}

interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
}

interface MeResponse {
  id: string;
  email: string;
  role: string;
}

export function useAuth() {
  const [authed, setAuthed] = useState(() => !!getToken());
  const [user, setUser] = useState<User>({ id: "", email: "", role: "executor" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post<LoginResponse>("/auth/login", { email, password });
      setTokens(res.token, res.refreshToken);
      setUser({ id: res.user.id, email: res.user.email, role: res.user.role });
      setAuthed(true);
      return true;
    } catch (e) {
      const msg = (e as ApiError).message ?? "Login failed";
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setAuthed(false);
    setUser({ id: "", email: "", role: "executor" });
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const me = await api.get<MeResponse>("/auth/me");
      setUser({ id: me.id, email: me.email, role: me.role as Role });
      setAuthed(true);
    } catch {
      clearTokens();
      setAuthed(false);
    }
  }, []);

  return { authed, user, loading, error, login, logout, fetchMe } as const;
}
