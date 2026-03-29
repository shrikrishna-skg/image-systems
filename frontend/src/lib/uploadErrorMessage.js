import axios from "axios";
function uploadErrorMessage(err) {
  if (axios.isAxiosError(err)) {
    if (err.code === "ECONNABORTED" || err.message?.toLowerCase().includes("timeout")) {
      return "Upload timed out. Check the API terminal for errors, then try again.";
    }
    if (err.response?.status === 502) {
      return "Backend isn\u2019t reachable. From the project folder run npm run dev:full (API + web), or start the API on port 8000.";
    }
    if (!err.response) {
      return "Can\u2019t reach the API. Run npm run dev:full from the project folder, or use browser-only npm run dev.";
    }
    const d = err.response.data?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      return d.map((x) => typeof x?.msg === "string" ? x.msg : JSON.stringify(x)).join(" ");
    }
    if (d && typeof d === "object" && "message" in d && typeof d.message === "string") {
      return d.message;
    }
  }
  return "Upload failed";
}
export {
  uploadErrorMessage
};
