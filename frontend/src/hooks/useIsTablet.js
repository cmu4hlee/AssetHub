import { useEffect, useState } from 'react';

const getIsTabletViewport = (tabletBreakpoint = 992, mobileBreakpoint = 768) => {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.innerWidth >= mobileBreakpoint && window.innerWidth < tabletBreakpoint;
};

const useIsTablet = (tabletBreakpoint = 992, mobileBreakpoint = 768) => {
  const [isTablet, setIsTablet] = useState(() => getIsTabletViewport(tabletBreakpoint, mobileBreakpoint));

  useEffect(() => {
    const update = () => {
      setIsTablet(getIsTabletViewport(tabletBreakpoint, mobileBreakpoint));
    };

    update();
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, [tabletBreakpoint, mobileBreakpoint]);

  return isTablet;
};

export default useIsTablet;
