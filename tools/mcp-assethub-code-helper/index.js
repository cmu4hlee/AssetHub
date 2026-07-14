const { Server } = require("@modelcontextprotocol/sdk");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk");
const { execSync } = require("child_process");
const { readFileSync, readdirSync } = require("fs");
const { join } = require("path");

const PROJECT_ROOT = "/Volumes/移动硬盘（500）/AssetHub";
const BACKEND_ROOT = join(PROJECT_ROOT, "backend");
const API_DOC_PATH = join(BACKEND_ROOT, "docs", "api-documentation.json");

function searchCode(pattern, fileTypes = [".js", ".ts", ".jsx", ".tsx"]) {
  try {
    const cmd = `cd "${BACKEND_ROOT}" && grep -rn --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" "${pattern}" --max-count=50 2>/dev/null | head -100`;
    const result = execSync(cmd, { encoding: "utf-8", maxBuffer: 1024 * 1024 });
    return result || `未找到匹配 "${pattern}" 的代码`;
  } catch (e) {
    return `搜索出错: ${e}`;
  }
}

function readSourceFile(relativePath, maxLines = 100) {
  try {
    const fullPath = join(PROJECT_ROOT, relativePath);
    const content = readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");
    if (lines.length > maxLines) {
      return lines.slice(0, maxLines).join("\n") + `\n... (共 ${lines.length} 行，显示前 ${maxLines} 行)`;
    }
    return content;
  } catch (e) {
    return `读取文件出错: ${e}`;
  }
}

function analyzeProjectStructure() {
  try {
    const backendDirs = ["routes", "services", "middleware", "utils", "config"];
    let result = "=== AssetHub 项目结构分析 ===\n\n";
    
    result += "📁 后端目录结构:\n";
    for (const dir of backendDirs) {
      const dirPath = join(BACKEND_ROOT, dir);
      try {
        const files = readdirSync(dirPath).filter(f => !f.startsWith("."));
        result += `  ${dir}/: ${files.length} 个文件\n`;
      } catch {
        result += `  ${dir}/: (不存在)\n`;
      }
    }
    
    const routesPath = join(BACKEND_ROOT, "routes");
    try {
      const routeFiles = readdirSync(routesPath).filter(f => f.endsWith(".js"));
      result += `\n📝 路由文件 (${routeFiles.length} 个):\n`;
      for (const f of routeFiles.slice(0, 20)) {
        result += `  - ${f}\n`;
      }
      if (routeFiles.length > 20) {
        result += `  ... 还有 ${routeFiles.length - 20} 个\n`;
      }
    } catch (e) {
      result += `路由目录读取失败: ${e}\n`;
    }
    
    return result;
  } catch (e) {
    return `分析项目结构出错: ${e}`;
  }
}

function queryApiDocs(keyword) {
  try {
    const doc = JSON.parse(readFileSync(API_DOC_PATH, "utf-8"));
    const paths = doc.paths || {};
    let results = [];
    let count = 0;
    
    for (const [path, methods] of Object.entries(paths)) {
      if (path.includes(keyword) || keyword === "*") {
        for (const [method, details] of Object.entries(methods)) {
          results.push(`  ${method.toUpperCase()} ${path}`);
          if (details.summary) {
            results.push(`    描述: ${details.summary}`);
          }
          if (details.tags) {
            results.push(`    标签: ${details.tags.join(", ")}`);
          }
          count++;
          if (count >= 20) break;
        }
      }
    }
    
    if (results.length === 0) {
      return `未找到匹配 "${keyword}" 的API端点`;
    }
    
    return `=== API文档搜索结果 (匹配 "${keyword}") ===\n${results.join("\n")}`;
  } catch (e) {
    return `查询API文档出错: ${e}`;
  }
}

function listApiEndpoints() {
  try {
    const doc = JSON.parse(readFileSync(API_DOC_PATH, "utf-8"));
    const paths = doc.paths || {};
    let result = "=== 所有API端点 ===\n\n";
    let count = 0;
    
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, details] of Object.entries(methods)) {
        result += `${method.toUpperCase()} ${path}`;
        if (details.summary) {
          result += ` - ${details.summary}`;
        }
        result += "\n";
        count++;
        if (count >= 50) break;
      }
      if (count >= 50) break;
    }
    
    result += `\n共 ${count} 个端点 (显示前50个)`;
    return result;
  } catch (e) {
    return `获取API端点列表出错: ${e}`;
  }
}

function findRouteHandler(path, method) {
  try {
    const pattern = `${method.toLowerCase()}'.*'|router\\.${method.toLowerCase()}`;
    const cmd = `cd "${BACKEND_ROOT}/routes" && grep -rn "${pattern}" --include="*.js" 2>/dev/null | head -20`;
    const result = execSync(cmd, { encoding: "utf-8" });
    return result || `未找到 ${method} ${path} 的路由处理`;
  } catch (e) {
    return `搜索路由出错: ${e}`;
  }
}

const server = new Server(
  {
    name: "assethub-code-helper",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.registerTool(
  {
    name: "code_search",
    description: "在代码库中搜索指定模式，支持搜索函数名、变量名、API路径等",
    inputSchema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "搜索的字符串模式",
        },
        fileTypes: {
          type: "array",
          items: { type: "string" },
          description: "要搜索的文件类型，默认 ['.js', '.ts', '.jsx', '.tsx']",
          default: [".js", ".ts", ".jsx", ".tsx"],
        },
      },
      required: ["pattern"],
    },
  },
  async ({ pattern, fileTypes }) => {
    const result = searchCode(pattern, fileTypes);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

server.registerTool(
  {
    name: "read_source_file",
    description: "读取项目中的源代码文件，支持查看源码内容",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "文件路径，如 'backend/routes/assets/index.js'",
        },
        maxLines: {
          type: "number",
          description: "最大显示行数，默认100",
          default: 100,
        },
      },
      required: ["path"],
    },
  },
  async ({ path, maxLines }) => {
    const result = readSourceFile(path, maxLines);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

server.registerTool(
  {
    name: "analyze_project",
    description: "分析项目结构，了解目录布局、文件组织",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  async () => {
    const result = analyzeProjectStructure();
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

server.registerTool(
  {
    name: "query_api",
    description: "查询API文档，搜索特定端点或关键词",
    inputSchema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "搜索关键词，如 '/assets', '/users' 等",
        },
      },
      required: ["keyword"],
    },
  },
  async ({ keyword }) => {
    const result = queryApiDocs(keyword);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

server.registerTool(
  {
    name: "list_api_endpoints",
    description: "列出所有可用的API端点",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  async () => {
    const result = listApiEndpoints();
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

server.registerTool(
  {
    name: "find_route_handler",
    description: "查找指定API路径的路由处理函数位置",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "API路径，如 '/api/assets'",
        },
        method: {
          type: "string",
          description: "HTTP方法，如 'get', 'post', 'put', 'delete'",
          default: "get",
        },
      },
      required: ["path", "method"],
    },
  },
  async ({ path, method }) => {
    const result = findRouteHandler(path, method);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);