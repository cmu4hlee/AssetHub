/**
 * 移动端工具函数
 * 用于检测移动端和提供响应式工具
 */

/**
 * 检测是否为移动端
 * @returns {boolean}
 */
export const isMobile = () => {
  return window.innerWidth < 768;
};

/**
 * 获取响应式的列配置
 * @param {Object} config - 列配置 { xs, sm, md, lg, xl, xxl }
 * @returns {Object}
 */
export const getResponsiveColProps = (config = {}) => {
  return {
    xs: config.xs || 24,
    sm: config.sm || 12,
    md: config.md || 12,
    lg: config.lg || 8,
    xl: config.xl || 6,
    xxl: config.xxl || 6,
  };
};

/**
 * 获取响应式的表格滚动配置
 * @param {number} minWidth - 最小宽度
 * @returns {Object}
 */
export const getTableScroll = (minWidth = 600) => {
  return {
    x: isMobile() ? `${minWidth}px` : 'max-content',
  };
};

/**
 * 获取响应式的分页配置
 * @param {Object} pagination - 分页配置
 * @returns {Object}
 */
export const getResponsivePagination = (pagination = {}) => {
  return {
    ...pagination,
    size: isMobile() ? 'small' : 'default',
    showSizeChanger: !isMobile(),
    simple: isMobile(),
  };
};

/**
 * 渲染移动端卡片列表
 * @param {Array} data - 数据数组
 * @param {Function} renderCard - 渲染卡片的函数
 * @param {boolean} loading - 加载状态
 * @returns {JSX.Element}
 */
export const renderMobileCards = (data, renderCard, loading = false) => {
  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>;
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return (
    <div className="mobile-table-cards show-on-mobile">
      {data.map((item, index) => (
        <div key={item.id || index} className="mobile-card-item">
          {renderCard(item, index)}
        </div>
      ))}
    </div>
  );
};
