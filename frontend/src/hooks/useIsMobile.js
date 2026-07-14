import { useEffect, useState } from 'react';

const getIsMobileViewport = breakpoint => {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.innerWidth < breakpoint;
};

const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(() => getIsMobileViewport(breakpoint));

  useEffect(() => {
    const update = () => {
      setIsMobile(getIsMobileViewport(breakpoint));
    };

    update();
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, [breakpoint]);

  return isMobile;
};

export default useIsMobile;
