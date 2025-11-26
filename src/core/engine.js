export function createEngine(){
  const systems = new Set();
  let running = false;
  let lastTime = 0;
  let frameHandle = null;
  const root = (typeof globalThis !== 'undefined' && globalThis) || (typeof window !== 'undefined' ? window : undefined);
  const getNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const raf = root && typeof root.requestAnimationFrame === 'function'
    ? root.requestAnimationFrame.bind(root)
    : (cb) => setTimeout(() => cb(getNow()), 16);
  const caf = root && typeof root.cancelAnimationFrame === 'function'
    ? root.cancelAnimationFrame.bind(root)
    : clearTimeout;

  function step(now){
    if(!running){
      return;
    }
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    systems.forEach(fn => {
      try {
        fn(dt, now);
      } catch (err){
        console.error('[engine] system error', err);
      }
    });
    frameHandle = raf(step);
  }

  return {
    registerSystem(fn){
      systems.add(fn);
      return () => systems.delete(fn);
    },
    start(){
      if(running){
        return;
      }
      running = true;
      lastTime = getNow();
      frameHandle = raf(step);
    },
    stop(){
      if(!running){
        return;
      }
      running = false;
      if(frameHandle !== null){
        caf(frameHandle);
        frameHandle = null;
      }
    },
    isRunning(){
      return running;
    }
  };
}
