import client from "./client";
const getMe = async () => {
  const res = await client.get("/auth/me");
  return res.data;
};
export {
  getMe
};
