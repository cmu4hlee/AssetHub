# AssetDetail.jsx 重构计划

## 当前状态
- 文件行数: 2725行
- 问题: 单一巨型组件，职责过多，难以维护

## 建议的组件拆分结构

```
src/pages/AssetDetail/
├── AssetDetail.jsx              # 主组件（容器）
├── AssetDetailHeader.jsx         # 资产头部信息
├── AssetDetailBasicInfo.jsx      # 基本信息卡片
├── AssetDetailImageGallery.jsx   # 图片画廊
├── AssetDetailLocation.jsx       # 位置信息
├── AssetDetailTechnicalDocs.jsx   # 技术资料
├── AssetDetailChangeLog.jsx      # 变更记录
├── AssetDetailTransfer.jsx      # 调拨记录
├── AssetDetailModals/
│   ├── ImagePreviewModal.jsx
│   ├── DocumentLinkModal.jsx
│   └── ShareLinkModal.jsx
```

## 需要提取的状态
```javascript
// 从 AssetDetail.jsx 中提取的状态
const [asset, setAsset] = useState(null);
const [images, setImages] = useState([]);
const [imageLoading, setImageLoading] = useState(true);
const [previewVisible, setPreviewVisible] = useState(false);
const [changeLogs, setChangeLogs] = useState([]);
const [assetLocation, setAssetLocation] = useState(null);
const [technicalDocuments, setTechnicalDocuments] = useState([]);
const [transitions, setTransitions] = useState([]);
```

## 建议的重构步骤

1. **第一阶段: 创建目录结构**
   - 创建 `src/pages/AssetDetail/` 目录
   - 创建空组件占位符

2. **第二阶段: 提取图片画廊**
   - 创建 `AssetDetailImageGallery.jsx`
   - Props: `assetCode`, `images`, `onRefresh`
   - 需要: `previewVisible`, `previewImage`, `previewTitle` 等状态

3. **第三阶段: 提取技术资料**
   - 创建 `AssetDetailTechnicalDocs.jsx`
   - Props: `asset`, `documents`, `onLinkDocument`

4. **第四阶段: 提取位置信息**
   - 创建 `AssetDetailLocation.jsx`
   - Props: `location`, `history`, `onLocate`

5. **第五阶段: 简化主组件**
   - 主组件只负责数据获取和状态分发
   - 使用 Context 共享跨组件状态

## 风险评估
- 高风险: 直接拆分可能破坏现有功能
- 建议: 先添加自动化测试，再进行重构
- 备选方案: 逐步重写，而非逐步拆分
