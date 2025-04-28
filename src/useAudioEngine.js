import { useEffect, useRef, useState } from 'react';

export default function useAudioEngine() {
  const ctxRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ctxRef.current = new AudioContext();
    setReady(true);
    return () => ctxRef.current && ctxRef.current.close();
  }, []);

  return [ctxRef.current, ready];
}
