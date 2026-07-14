import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import crypto from '../utils/crypto';
import { getHomePath } from '../utils/feishu';
import './Introduction.css';

const Introduction = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const token = await crypto.getItemAsync('token');
        const user = await crypto.getItemAsync('user');
        if (cancelled) return;

        const path = location.pathname;
        if (path === '/' || path === '/intro') {
          if (token && user) {
            navigate(getHomePath(), { replace: true });
          } else {
            navigate('/login', { replace: true });
          }
        }
      } catch {
        if (!cancelled) navigate('/login', { replace: true });
      }
    };
    init();
    return () => { cancelled = true; };
  }, [navigate, location.pathname]);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('.portal-reveal'));
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) entry.target.classList.add('in-view');
        });
      },
      { threshold: 0.15 }
    );
    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="intro-splash">
      <div className="intro-splash-content">
        <div className="intro-logo">A</div>

        <div className="intro-eyebrow">AssetHost</div>

        <h1 className="intro-title">
          资产<em>井然有序</em>
        </h1>

        <p className="intro-tagline">
          企业级资产全生命周期管理平台
        </p>

        <div className="intro-loader">
          <span className="intro-spinner" />
          <span>正在跳转</span>
          <span className="intro-dots">
            <span className="intro-dot" />
            <span className="intro-dot" />
            <span className="intro-dot" />
          </span>
        </div>
      </div>

      <div className="intro-footer">© AssetHost · v1.0</div>
    </div>
  );
};

export default Introduction;
