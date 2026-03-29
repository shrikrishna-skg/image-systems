import client from "./client";
const listKeys = async () => {
  const res = await client.get("/keys");
  return res.data;
};
const createKey = async (provider, apiKey, label, skipConnectionTest) => {
  const res = await client.post("/keys", {
    provider,
    api_key: apiKey,
    label,
    skip_connection_test: skipConnectionTest === true
  });
  return res.data;
};
const deleteKey = async (keyId) => {
  await client.delete(`/keys/${keyId}`);
};
const validateKey = async (provider, apiKey) => {
  const res = await client.post(
    "/keys/validate",
    { provider, api_key: apiKey }
  );
  return res.data;
};
const validateSavedKey = async (provider) => {
  const res = await client.post(
    "/keys/validate-saved",
    { provider }
  );
  return res.data;
};
export {
  createKey,
  deleteKey,
  listKeys,
  validateKey,
  validateSavedKey
};
