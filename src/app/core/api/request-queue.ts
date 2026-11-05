/**
 * One question at a time.
 *
 * Both of the renderer's stores talk to an API that answers every request
 * with the whole of the state it owns, so an answer is only meaningful beside
 * the others: install two out of order and the older snapshot quietly undoes
 * the newer change. Ordering the answers after the fact cannot be done from
 * this side -- the renderer knows when it asked, the server knows when it
 * committed, and those are not the same list. Two requests sent together can
 * even arrive inverted, and then the server commits the newer intent first
 * and the older one last, so the stored state ends up holding the change the
 * person made first.
 *
 * Asking one at a time removes the question instead of answering it. It is
 * what the server already does with its own writes, for the same reason, and
 * it costs a queued request the round trip ahead of it -- milliseconds, to a
 * server on this machine, while an optimistic guess is on screen already.
 *
 * The chain is continued from the settled promise either way, so a task that
 * threw cannot block the ones behind it.
 */
export type RequestQueue = (task: () => Promise<void>) => Promise<void>;

export function createRequestQueue(): RequestQueue {
  let pending: Promise<unknown> = Promise.resolve();

  return (task) => {
    const run = pending.then(task, task);
    pending = run;
    return run;
  };
}
