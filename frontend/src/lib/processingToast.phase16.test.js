import { describe, expect, it, vi, beforeEach } from "vitest";
import axios from "axios";
import { toast } from "sonner";
import { toastProcessingError } from "./processingToast";
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn()
  }
}));
describe("Phase 16 \u2014 processingToast + rate limits", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });
  it("surfaces provider rate-limit detail from 429 response", () => {
    const err = new axios.AxiosError("Request failed");
    err.response = {
      status: 429,
      data: { detail: "rate limit exceeded \u2014 try again later" },
      statusText: "Too Many Requests",
      headers: {},
      config: {}
    };
    toastProcessingError(err, "Generation failed");
    expect(toast.error).toHaveBeenCalledWith(
      "Request failed",
      expect.objectContaining({
        description: "rate limit exceeded \u2014 try again later"
      })
    );
  });
});
