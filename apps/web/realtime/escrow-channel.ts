/**
 * Subscription seam for `escrow:<id>` confirmation frames.
 *
 * STAGE-5 STUB: web has no WebSocket layer yet (S5.1). The escrow-sync hook
 * subscribes through this module so that wiring the real socket later is a
 * one-file change — until then every subscription is a no-op and the hook's
 * independent RPC poll is the sole confirmation path (it exists on mobile as
 * the missed-frame fallback, so correctness does not depend on frames).
 */
export interface EscrowFrame {
  tx_ref: string
}

export function subscribeEscrowChannel(
  escrowId: string,
  onFrame: (frame: EscrowFrame) => void,
): () => void {
  // Consumed for real by the S5.1 socket; referenced here so the stub keeps
  // the final signature without unused-parameter noise.
  void escrowId
  void onFrame
  return () => {}
}
