import client from "./client";
import type { User } from "../types";

export const getMe = async () => {
  const res = await client.get<User>("/auth/me");
  return res.data;
};
