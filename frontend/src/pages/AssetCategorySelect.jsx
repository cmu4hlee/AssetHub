import React, { useState, useEffect } from 'react';
import { Button, Card, Col, Row, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { assetAPI } from '../utils/api';

const { Title } = Typography;

const AssetCategorySelect = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const result = await assetAPI.getCategories({ level: 1 });
      if (result.success) {
        setCategories(result.data);
      } else {
        message.error('加载分类失败');
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      message.error('加载分类失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = category => {
    // 将选择的分类信息传递给资产表单页面
    navigate('/assets/new', { state: { selectedCategory: category } });
  };

  return (
    <div style={{ padding: isMobile ? 16 : 24 }}>
      <Title level={2} style={{ marginBottom: isMobile ? 24 : 32 }}>
        选择资产一级类别
      </Title>
      <Row gutter={[isMobile ? 16 : 24, isMobile ? 16 : 24]}>
        {categories.map(category => (
          <Col key={category.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              style={{ cursor: 'pointer', height: '100%' }}
              onClick={() => handleCategorySelect(category)}
              loading={loading}
            >
              <div style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 'bold', marginBottom: 8 }}>
                  {category.name}
                </div>
                <div style={{ color: '#666', marginBottom: 16 }}>
                  {category.description || '点击选择该类别'}
                </div>
                <Button type="primary" size={isMobile ? 'middle' : 'large'}>
                  选择
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default AssetCategorySelect;
