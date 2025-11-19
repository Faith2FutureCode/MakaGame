export function createEventBus(){
  const listeners = new Map();
  return {
    on(type, handler){
      if(typeof handler !== 'function'){
        return () => {};
      }
      if(!listeners.has(type)){
        listeners.set(type, new Set());
      }
      const bucket = listeners.get(type);
      bucket.add(handler);
      return () => bucket.delete(handler);
    },
    emit(type, payload){
      const bucket = listeners.get(type);
      if(!bucket || bucket.size === 0){
        return;
      }
      bucket.forEach((handler) => {
        try {
          handler(payload);
        } catch(err){
          console.error('[events] handler error', err);
        }
      });
    },
    clear(type){
      if(typeof type === 'string'){
        listeners.delete(type);
      } else {
        listeners.clear();
      }
    }
  };
}
