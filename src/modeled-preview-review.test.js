import { describe, expect, it } from "vitest";
import { resolveModeledPreviewReview } from "./modeled-preview-review.js";

describe("Modeled Preview review resolution", () => {
  it("promotes a visibly valid preview when an independent confirmation overturns an unsupported rejection", () => {
    const resolved = resolveModeledPreviewReview(
      {
        accepted: false,
        reasons: ["The head is cropped and the V-neck shirt was replaced."],
      },
      {
        accepted: true,
        reasons: ["The candidate is full-body and the selected V-neck shirt, shorts, and boots are visible."],
      },
    );

    expect(resolved).toEqual({
      accepted: true,
      reasons: ["The candidate is full-body and the selected V-neck shirt, shorts, and boots are visible."],
    });
  });
});
