/**
 * 图片懒加载组件
 * 支持加载占位、错误处理、淡入动画
 */

import React, { useState, useRef, useEffect } from 'react';
import { Spin, Empty } from 'antd';
import { FileImageOutlined } from '@ant-design/icons';

const LazyImage = ({
  src,
  alt = '',
  width,
  height,
  placeholder = true,
  threshold = 0.1,
  rootMargin = '50px',
  onLoad,
  onError,
  style = {},
  className = '',
  objectFit = 'cover',
  ...rest
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  // 使用 IntersectionObserver 监听图片是否进入视口
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin]);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
    if (onLoad) onLoad();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    if (onError) onError();
  };

  const containerStyle = {
    position: 'relative',
    width: width || '100%',
    height: height || 'auto',
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
    ...style,
  };

  const imageStyle = {
    width: '100%',
    height: '100%',
    objectFit,
    opacity: isLoaded ? 1 : 0,
    transition: 'opacity 0.3s ease-in-out',
  };

  return (
    <div ref={containerRef} style={containerStyle} className={className}>
      {/* 占位符 */}
      {placeholder && !isLoaded && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
          }}
        >
          {hasError ? (
            <Empty
              image={<FileImageOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
              description="加载失败"
            />
          ) : (
            <Spin size="small" />
          )}
        </div>
      )}

      {/* 错误状态 */}
      {hasError && !placeholder && (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
          }}
        >
          <Empty
            image={<FileImageOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
            description="图片加载失败"
          />
        </div>
      )}

      {/* 实际图片 */}
      {isInView && !hasError && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          style={imageStyle}
          onLoad={handleLoad}
          onError={handleError}
          {...rest}
        />
      )}
    </div>
  );
};

// 图片画廊组件（带懒加载）
export const LazyImageGallery = ({ 
  images = [], 
  columns = 3,
  gap = 16,
  ...imageProps 
}) => {
  const galleryStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: `${gap}px`,
  };

  return (
    <div style={galleryStyle}>
      {images.map((img, index) => (
        <LazyImage
          key={index}
          src={img.src}
          alt={img.alt}
          {...imageProps}
        />
      ))}
    </div>
  );
};

// 背景图片懒加载组件
export const LazyBackgroundImage = ({
  src,
  children,
  style = {},
  className = '',
  ...rest
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView) return;

    const img = new Image();
    img.src = src;
    img.onload = () => setIsLoaded(true);
  }, [isInView, src]);

  const containerStyle = {
    backgroundImage: isLoaded ? `url(${src})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundColor: '#f5f5f5',
    transition: 'opacity 0.3s ease-in-out',
    opacity: isLoaded ? 1 : 0.5,
    ...style,
  };

  return (
    <div ref={containerRef} style={containerStyle} className={className} {...rest}>
      {!isLoaded && (
        <div style={{ 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <Spin />
        </div>
      )}
      {children}
    </div>
  );
};

export default LazyImage;
