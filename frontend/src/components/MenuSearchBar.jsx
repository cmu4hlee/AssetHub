import React, { useMemo, useState } from 'react';
import { AutoComplete, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

/**
 * 菜单关键字查找 / 定位组件
 * - 递归匹配菜单 label、完整路径、路由 key（不区分大小写）
 * - 下拉结果展示「父级 / 子级」完整路径并高亮关键字
 * - 选中后回调 onNavigate(key) 进行跳转定位
 */
const MenuSearchBar = ({ menuItems = [], onNavigate, placeholder = '搜索菜单…' }) => {
  const [value, setValue] = useState('');

  // 将树形菜单扁平化为 { key, label, parents } 列表
  const flatMenus = useMemo(() => {
    const list = [];
    const walk = (items, parents) => {
      (items || []).forEach(it => {
        if (!it || it.type === 'divider' || !it.key) return;
        const currentParents = [...parents, it.label];
        list.push({
          key: it.key,
          label: it.label,
          parents,
          path: currentParents.join(' / '),
        });
        if (it.children && it.children.length) {
          walk(it.children, currentParents);
        }
      });
    };
    walk(menuItems, []);
    return list;
  }, [menuItems]);

  // 高亮匹配文本
  const highlight = (text, q) => {
    if (!q) return text;
    const lower = String(text).toLowerCase();
    const idx = lower.indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {String(text).slice(0, idx)}
        <mark className="menu-search-hl">{String(text).slice(idx, idx + q.length)}</mark>
        {String(text).slice(idx + q.length)}
      </>
    );
  };

  // 根据关键字过滤（label / key / 父级路径 任一包含即命中）
  const options = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const matched = [];
    for (const it of flatMenus) {
      const haystack = `${it.label} ${it.key} ${it.parents.join(' ')}`.toLowerCase();
      if (haystack.includes(q)) matched.push(it);
      if (matched.length >= 30) break;
    }
    return matched.map(it => ({
      value: it.key,
      label: (
        <div className="menu-search-option">
          <span className="menu-search-option-label">{highlight(it.label, q)}</span>
          {it.parents.length > 0 && (
            <span className="menu-search-option-path">
              {it.parents.map((p, i) => (
                <React.Fragment key={i}>
                  {i > 0 && ' / '}
                  {highlight(p, q)}
                </React.Fragment>
              ))}
            </span>
          )}
        </div>
      ),
    }));
  }, [value, flatMenus]);

  const handleSelect = key => {
    if (typeof onNavigate === 'function') onNavigate(key);
    setValue('');
  };

  return (
    <div className="menu-search-bar">
      <AutoComplete
        value={value}
        options={options}
        onChange={setValue}
        onSelect={handleSelect}
        filterOption={false}
        placeholder={placeholder}
        style={{ width: '100%' }}
        classNames={{ popup: { root: 'menu-search-popup' } }}
        notFoundContent={value.trim() ? '未找到匹配菜单' : null}
      >
        <Input prefix={<SearchOutlined />} allowClear />
      </AutoComplete>
    </div>
  );
};

export default MenuSearchBar;
