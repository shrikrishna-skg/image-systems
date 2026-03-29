import client from "./client";
async function getHealth() {
  const { data } = await client.get("/health");
  return data;
}
export {
  getHealth
};
