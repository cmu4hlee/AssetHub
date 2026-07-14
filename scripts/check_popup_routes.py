from playwright.sync_api import sync_playwright

def check_popup_routes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 收集 console 日志
        console_logs = []
        page.on('console', lambda msg: console_logs.append(f'[{msg.type}] {msg.text}'))
        
        # 收集页面错误
        errors = []
        page.on('pageerror', lambda err: errors.append(str(err)))

        # 导航到主页面
        print("=== 导航到 http://localhost:13579/ ===")
        page.goto('http://localhost:13579/')
        page.wait_for_load_state('networkidle')
        
        # 截图主页面
        page.screenshot(path='/tmp/main_page.png', full_page=True)
        print("主页面截图已保存到 /tmp/main_page.png")
        print(f"当前 URL: {page.url}")
        print(f"页面标题: {page.title()}")

        # 检查是否有 popup 相关的路由或链接
        print("\n=== 检查页面上的链接和按钮 ===")
        buttons = page.locator('button, a, [role="button"]').all()
        for btn in buttons:
            text = btn.inner_text()
            href = btn.get_attribute('href')
            if text or href:
                print(f"- 文本: '{text}' | href: {href}")

        # 尝试访问常见的 popup 路由
        popup_routes = ['/popup', '/popups', '/modal', '/dialog']
        
        for route in popup_routes:
            url = f'http://localhost:13579{route}'
            print(f"\n=== 访问 {url} ===")
            console_logs.clear()
            errors.clear()
            
            page.goto(url)
            page.wait_for_load_state('networkidle')
            
            # 截图
            screenshot_path = f'/tmp/popup_{route.replace("/", "_")}.png'
            page.screenshot(path=screenshot_path, full_page=True)
            print(f"截图已保存到 {screenshot_path}")
            print(f"当前 URL: {page.url}")
            print(f"页面标题: {page.title()}")
            
            # 检查页面内容
            body_text = page.locator('body').inner_text()
            is_blank = len(body_text.strip()) == 0
            print(f"页面是否为空白: {is_blank}")
            
            if not is_blank:
                print(f"页面内容预览: {body_text[:200]}...")
            
            # 输出 console 日志
            if console_logs:
                print(f"\nConsole 日志 ({len(console_logs)} 条):")
                for log in console_logs:
                    print(f"  {log}")
            else:
                print("\nConsole 日志: 无")
            
            # 输出错误
            if errors:
                print(f"\n页面错误 ({len(errors)} 条):")
                for err in errors:
                    print(f"  {err}")
            else:
                print("\n页面错误: 无")

        browser.close()

if __name__ == '__main__':
    check_popup_routes()
