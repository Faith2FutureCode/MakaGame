export function createEngine(){
  const systems = new Set();
  let running = false;
  let lastTime = 0;
  let frameHandle = null;

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
    frameHandle = requestAnimationFrame(step);
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
      lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      frameHandle = requestAnimationFrame(step);
    },
    stop(){
      if(!running){
        return;
      }
      running = false;
      if(frameHandle !== null){
        cancelAnimationFrame(frameHandle);
        frameHandle = null;
      }
    },
    isRunning(){
      return running;
    }
  };
}
