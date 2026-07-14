import os
import re
from bs4 import BeautifulSoup


def convert_html_to_md(html_path, output_path, software_name, version):
    """将源代码 HTML 转换为 Markdown 格式"""

    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, 'lxml')

    pages = soup.find_all('div', class_='page')

    md_lines = []
    md_lines.append(f"# {software_name} 源代码")
    md_lines.append(f"**版本：** {version}")
    md_lines.append("")
    md_lines.append("---")
    md_lines.append("")

    for page_idx, page in enumerate(pages, 1):
        header = page.find('div', class_='header')
        code_div = page.find('div', class_='code')
        footer = page.find('div', class_='footer')

        if header:
            title = header.get_text(strip=True)
            md_lines.append(f"## 第 {page_idx} 页")
            md_lines.append("")

        if code_div:
            lines = code_div.find_all('span', class_='line-num')
            for line in lines:
                line_num = line.get_text(strip=True)
                code_text = line.next_sibling
                if code_text:
                    code_text = str(code_text)
                else:
                    code_text = ""
                md_lines.append(f"{line_num:>4}  {code_text}")

        md_lines.append("")
        md_lines.append(f"*{footer.get_text(strip=True) if footer else '第 ' + str(page_idx) + ' 页'}*")
        md_lines.append("")
        md_lines.append("---")
        md_lines.append("")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(md_lines))

    print(f'已生成 Markdown 文档：{output_path}')
    print(f'总页数：{len(pages)}')


if __name__ == '__main__':
    base_dir = '/Volumes/移动硬盘（500）/AssetHub/软著申请材料'
    html_path = os.path.join(base_dir, '01-源代码.html')
    output_path = os.path.join(base_dir, '01-源代码.md')

    software_name = 'AssetHost智能资产管理平台'
    version = 'V1.0'

    convert_html_to_md(html_path, output_path, software_name, version)
