# AssetHub 资产查询数据集 - Llama Factory 格式

## 数据集说明

- **生成时间**: 2026-04-13T00:10:01.690Z
- **样本数量**: 285
- **格式**: Llama Factory SFT JSONL
- **对话轮数**: 1轮 (user -> assistant)

## 字段说明

每行 JSONL 包含:
- `messages`: 对话消息数组
  - `system`: 系统提示词
  - `user`: 用户查询
  - `assistant`: 助手响应

## 覆盖意图

1. asset_list_query_by_department
2. asset_list_query_by_type
3. asset_list_query_by_status
4. asset_list_query_by_keyword
5. asset_detail_query
6. asset_statistics_query
7. asset_location_query
8. asset_depreciation_query
9. asset_change_logs_query
10. asset_category_tree_query
11. asset_filter_query
12. asset_paginated_query
13. asset_all_query
14. asset_brand_filter
15. asset_warranty_query
16. asset_value_summary
17. asset_department_distribution
18. asset_age_distribution
19. asset_status_summary

## 使用方法

在 LLaMA Factory 中使用:

```yaml
dataset: assethub_asset_query_sft
 cutoff_len: 2048
 max_length: 4096
 batch_size: 2
 workspace: /path/to/llama-factory
 ```

或通过命令行:

```bash
llamafactory-cli train examples/train_lora/assethub_asset_query.yaml
```
