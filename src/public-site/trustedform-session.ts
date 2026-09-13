type Session = {
  owner: symbol;
  closed: boolean;
  stopCalled: boolean;
  releaseTimer?: number;
};

// The SDK records one page session and cannot restart after it has stopped.
let session: Session | undefined;

function stopRecording(current: Session) {
  if (current.stopCalled || typeof window === "undefined") return;
  const stop = Reflect.get(window, "trustedFormStopRecording");
  if (typeof stop !== "function") return;
  current.stopCalled = true;
  try {
    stop();
  } catch {
    // An SDK failure must not interrupt the request/receipt UI. This page's
    // session remains closed; starting another recording requires a reload.
  }
}

export function acquireTrustedFormSession(owner: symbol) {
  if (!session) session = { owner, closed: false, stopCalled: false };
  if (session.owner !== owner || session.closed)
    return { requiresReload: true };
  window.clearTimeout(session.releaseTimer);
  session.releaseTimer = undefined;
  return { requiresReload: false };
}

export function stopTrustedFormSession(owner: symbol) {
  if (!session || session.owner !== owner) return;
  window.clearTimeout(session.releaseTimer);
  session.releaseTimer = undefined;
  session.closed = true;
  stopRecording(session);
}

export function releaseTrustedFormSession(owner: symbol) {
  if (!session || session.owner !== owner || session.closed) return;
  window.clearTimeout(session.releaseTimer);
  // React StrictMode immediately reacquires with the same stable owner. Only
  // a real unmount consumes the recording and stops the SDK on the next task.
  session.releaseTimer = window.setTimeout(
    () => stopTrustedFormSession(owner),
    0,
  );
}

export function finalizeReleasedTrustedFormSession(owner: symbol) {
  // A script download can finish after unmount. Retry stopping only after the
  // lease actually closed, never from a superseded StrictMode effect alone.
  if (session?.owner === owner && session.closed) stopRecording(session);
}
