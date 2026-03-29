import client from "./client";
const getJob = async (jobId) => {
  const res = await client.get(`/jobs/${jobId}`);
  return res.data;
};
const listJobs = async (skip = 0, limit = 20) => {
  const res = await client.get(`/jobs?skip=${skip}&limit=${limit}`);
  return res.data;
};
export {
  getJob,
  listJobs
};
