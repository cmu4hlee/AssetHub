import json
import os

# 安全：API Key 从环境变量读取，**禁止**写入代码/提交仓库
MINIMAX_API_KEY = os.environ.get("MINIMAX_API_KEY") or os.environ.get("OPENCODE_MINIMAX_API_KEY") or ""
MINIMAX_BASE_URL = os.environ.get("MINIMAX_BASE_URL") or "https://api.minimaxi.com/anthropic/v1"

if not MINIMAX_API_KEY:
    print("WARNING: MINIMAX_API_KEY 未设置，provider.minimax.apiKey 将留空（请在终端先 export MINIMAX_API_KEY=...）")

config = {
  "$schema": "https://opencode.ai/config.json",
  "model": "minimax/MiniMax-M2.7",
  "small_model": "minimax/MiniMax-M2.7",
  "mcp": {
    "assethub": {
      "type": "local",
      "command": ["/Users/cjlee/PJ/AssetHub/tools/mcp-assethub/mcp-assethub"],
      "environment": {
        "ASSETHUB_API_URL": "http://localhost:5183/api",
        "ASSETHUB_RUNTIME_AUTH_STORE_DIR": "/tmp/assethub-ai-runtime-auth",
        "ASSETHUB_TOOL_PREFIX": "assethub"
      },
      "enabled": True
    },
    "code-helper": {
      "type": "local",
      "command": ["node", "/Volumes/移动硬盘（500）/AssetHub/tools/mcp-assethub-code-helper/index.js"],
      "enabled": True
    }
  },
  "provider": {
    "minimax": {
      "npm": "@ai-sdk/anthropic",
      "name": "MiniMax",
      "options": {
        "baseURL": MINIMAX_BASE_URL,
        "apiKey": MINIMAX_API_KEY,
      },
      "models": {"MiniMax-M2.7": {"name": "MiniMax-M2.7"}}
    },
    "lmstudio": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LM Studio (remote)",
      "options": {"baseURL": "http://160ttth72797.vicp.fun/v1"},
      "models": {
        "qwen/qwen3-14b": {"name": "Qwen3-14B (LM Studio)"},
        "qwen/qwen3-vl-30b": {"name": "Qwen3-VL-30B (LM Studio)"}
      }
    }
  },
  "plugin": ["oh-my-openagent"]
}
with open("/Users/cjlee/.config/opencode/opencode.json", "w") as f:
  json.dump(config, f, indent=2)
print("Config updated successfully (apiKey:", ("<set>" if MINIMAX_API_KEY else "<empty>"), ")")