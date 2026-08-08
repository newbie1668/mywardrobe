function normaliseReview(review) {
  return {
    accepted: review?.accepted === true,
    reasons: Array.isArray(review?.reasons)
      ? review.reasons.filter((reason) => typeof reason === "string" && reason.trim()).slice(0, 8)
      : [],
  };
}

// A generated image is discarded only after the confirmation pass agrees with
// the first rejection. This protects valid previews from a single visual-model
// hallucination while retaining a strict, evidence-based quality gate.
export function resolveModeledPreviewReview(firstReview, confirmationReview = null) {
  const first = normaliseReview(firstReview);
  if (first.accepted || !confirmationReview) return first;
  return normaliseReview(confirmationReview);
}
