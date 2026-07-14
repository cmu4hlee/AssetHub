# Excel字段到数据库字段映射表

## 完整字段映射

| Excel字段           | 数据库字段                    | 说明                         |
| ------------------- | ----------------------------- | ---------------------------- |
| code                | code                          | 原始编码code                 |
| code2               | code2                         | 原始编码code2                |
| code3               | code3                         | 原始编码code3                |
| name                | asset_name                    | 资产名称                     |
| type                | asset_type                    | 资产类型（通过映射函数转换） |
| band                | brand                         | 品牌                         |
| factory             | supplier, brand               | 供应商（优先），品牌（备用） |
| sn                  | model                         | 型号                         |
| date_of_acquisition | purchase_date                 | 购置日期                     |
| price               | purchase_price, current_value | 购置价格（同时作为当前价值） |
| department          | department                    | 使用部门                     |
| unit                | unit                          | 单位                         |
| location            | location                      | 存放位置                     |
| roomID              | location                      | 房间ID（作为位置备用）       |
| user                | responsible_person            | 责任人                       |
| user2               | responsible_person            | 责任人（备用）               |
| status              | status                        | 资产状态                     |
| check               | status                        | 检查状态（作为状态备用）     |
| remark              | remark                        | 备注                         |
| 管理科室核实情况    | remark                        | 管理科室核实情况（作为备注） |
| 数据标识            | data_id                       | 数据标识                     |
| 创建时间            | original_created_at           | 原始创建时间                 |

## 资产编号生成规则

- 优先使用 code3
- 其次使用 code
- 再次使用 code2
- 都没有则自动生成：ZC{时间戳}{序号}

## 资产类型映射规则

根据 type 和 name 字段智能判断：

- 包含"医疗"、"医院"、"CT"、"MRI"等 → 医疗设备
- 包含"房产"、"建筑"、"房屋"等 → 房产建筑
- 包含"家具"、"办公"、"桌"、"椅"、"柜"等 → 办公家具
- 其他 → 普通设备

## 状态映射规则

- 包含"闲置" → 闲置
- 包含"维修" → 维修
- 包含"报废" → 报废
- 包含"调配" → 调配中
- 其他 → 在用
