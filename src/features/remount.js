/**
 * Re-mounting a feature when something it depends on changes (B70).
 */

/**
 * Mounts now and again (disposing the previous mount) each time `type`
 * fires on `target`.
 * @param {EventTarget} target
 * @param {string} type
 * @param {() => ((() => void)|undefined|void)} mount  returns the dispose
 * @returns {() => void}
 */
export function remountOnEvent(target, type, mount) {
  /** @type {(() => void)|undefined|void} */
  let dispose = mount();
  const unmount = () => {
    try {
      dispose?.();
    } catch (_) {}
    dispose = undefined;
  };
  const onEvent = () => {
    unmount();
    dispose = mount();
  };
  target.addEventListener(type, onEvent);
  return () => {
    target.removeEventListener(type, onEvent);
    unmount();
  };
}
