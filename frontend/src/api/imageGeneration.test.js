import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import client from "./client";
import { generateImageFromDescription, uploadLikeToImageInfo } from "./imageGeneration";
vi.mock("./client", () => ({
  default: {
    post: vi.fn()
  }
}));
describe("Phase 16 \u2014 image generation API client", () => {
  beforeEach(() => {
    vi.mocked(client.post).mockReset();
  });
  it("uploadLikeToImageInfo maps generation response to ImageInfo", () => {
    const info = uploadLikeToImageInfo({
      id: "img-1",
      original_filename: "gen_test.png",
      width: 1536,
      height: 1024,
      file_size_bytes: 12e4,
      mime_type: "image/png",
      created_at: "2026-03-29T12:00:00",
      versions: []
    });
    expect(info.id).toBe("img-1");
    expect(info.width).toBe(1536);
    expect(info.height).toBe(1024);
    expect(info.versions).toEqual([]);
  });
  it("generateImageFromDescription passes AbortSignal to axios, not JSON body", async () => {
    const post = vi.mocked(client.post);
    post.mockResolvedValue({
      data: {
        id: "x",
        original_filename: "f.png",
        width: 1,
        height: 1,
        file_size_bytes: 1,
        mime_type: "image/png",
        created_at: "2026-01-01T00:00:00",
        versions: [],
        resolved_prompt: "p",
        used_interpretation: false
      }
    });
    const ac = new AbortController();
    await generateImageFromDescription({
      description: "test prompt here",
      provider: "openai",
      interpret: false,
      model: "gpt-image-1",
      quality: "high",
      output_format: "png",
      signal: ac.signal
    });
    expect(post).toHaveBeenCalledTimes(1);
    const [, body, cfg] = post.mock.calls[0];
    expect(body).not.toHaveProperty("signal");
    expect(body.description).toBe("test prompt here");
    expect(cfg).toMatchObject({ signal: ac.signal });
  });
  it("cancelled generate rejects with axios cancel semantics", async () => {
    const post = vi.mocked(client.post);
    const ac = new AbortController();
    post.mockImplementation(
      () => new Promise((_resolve, reject) => {
        ac.signal.addEventListener("abort", () => {
          reject(new axios.CanceledError());
        });
      })
    );
    const p = generateImageFromDescription({
      description: "wide shot interior",
      provider: "openai",
      interpret: false,
      model: "gpt-image-1",
      quality: "low",
      output_format: "webp",
      signal: ac.signal
    });
    ac.abort();
    let caught;
    try {
      await p;
    } catch (e) {
      caught = e;
    }
    expect(
      axios.isCancel(caught) || axios.isAxiosError(caught) && caught.code === "ERR_CANCELED"
    ).toBe(true);
  });
});
