import client from "./client";
import type { JobInfo } from "../types";

export const getJob = async (jobId: string) => {
  const res = await client.get<JobInfo>(`/jobs/${jobId}`);
  return res.data;
};

export const listJobs = async (skip = 0, limit = 20) => {
  const res = await client.get<JobInfo[]>(`/jobs?skip=${skip}&limit=${limit}`);
  return res.data;
};
