import React from 'react';

// 响应式断点定义
export const BREAKPOINTS = {
  xs: 480,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
} as const;

// 屏幕尺寸类型
export type ScreenSize = keyof typeof BREAKPOINTS;

// 获取当前屏幕尺寸
export const getScreenSize = (): ScreenSize => {
  const width = window.innerWidth;
  
  if (width >= BREAKPOINTS.xxl) return 'xxl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
};

// 检查是否为移动设备
export const isMobile = (): boolean => {
  return window.innerWidth <= BREAKPOINTS.md;
};

// 检查是否为平板设备
export const isTablet = (): boolean => {
  return window.innerWidth > BREAKPOINTS.md && window.innerWidth <= BREAKPOINTS.lg;
};

// 检查是否为桌面设备
export const isDesktop = (): boolean => {
  return window.innerWidth > BREAKPOINTS.lg;
};

// 响应式Hook
export const useResponsive = () => {
  const [screenSize, setScreenSize] = React.useState<ScreenSize>(getScreenSize);
  const [isMobileDevice, setIsMobileDevice] = React.useState(isMobile);
  const [isTabletDevice, setIsTabletDevice] = React.useState(isTablet);
  const [isDesktopDevice, setIsDesktopDevice] = React.useState(isDesktop);

  React.useEffect(() => {
    const handleResize = () => {
      const newScreenSize = getScreenSize();
      setScreenSize(newScreenSize);
      setIsMobileDevice(isMobile());
      setIsTabletDevice(isTablet());
      setIsDesktopDevice(isDesktop());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    screenSize,
    isMobile: isMobileDevice,
    isTablet: isTabletDevice,
    isDesktop: isDesktopDevice,
    breakpoints: BREAKPOINTS,
  };
};

// 响应式样式生成器
export const getResponsiveStyles = (styles: Record<ScreenSize, React.CSSProperties>) => {
  return Object.entries(styles).reduce((acc, [breakpoint, style]) => {
    const minWidth = BREAKPOINTS[breakpoint as ScreenSize];
    if (minWidth) {
      acc[`@media (min-width: ${minWidth}px)`] = style;
    }
    return acc;
  }, {} as Record<string, React.CSSProperties>);
};

// 响应式类名生成器
export const getResponsiveClassNames = (classNames: Record<ScreenSize, string>) => {
  const currentSize = getScreenSize();
  return classNames[currentSize] || classNames.md || '';
};

// 响应式配置
export const RESPONSIVE_CONFIG = {
  // 布局配置
  layout: {
    sidebarWidth: {
      xs: 200,
      sm: 220,
      md: 240,
      lg: 256,
      xl: 280,
      xxl: 300,
    },
    headerHeight: {
      xs: 48,
      sm: 48,
      md: 56,
      lg: 56,
      xl: 64,
      xxl: 64,
    },
    contentPadding: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
    },
  },
  // 网格配置
  grid: {
    columns: {
      xs: 1,
      sm: 2,
      md: 2,
      lg: 3,
      xl: 4,
      xxl: 4,
    },
    gap: {
      xs: 8,
      sm: 10,
      md: 12,
      lg: 16,
      xl: 20,
      xxl: 24,
    },
  },
  // 卡片配置
  card: {
    padding: {
      xs: 16,
      sm: 18,
      md: 20,
      lg: 22,
      xl: 24,
      xxl: 28,
    },
    borderRadius: {
      xs: 8,
      sm: 10,
      md: 12,
      lg: 14,
      xl: 16,
      xxl: 18,
    },
  },
} as const;

// 获取响应式值
export const getResponsiveValue = <T>(
  values: Record<ScreenSize, T>,
  defaultValue?: T
): T => {
  const currentSize = getScreenSize();
  return values[currentSize] || defaultValue || values.md;
};

// 响应式工具函数
export const responsiveUtils = {
  getScreenSize,
  isMobile,
  isTablet,
  isDesktop,
  getResponsiveStyles,
  getResponsiveClassNames,
  getResponsiveValue,
  breakpoints: BREAKPOINTS,
  config: RESPONSIVE_CONFIG,
};
