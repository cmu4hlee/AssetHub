// ============================================
// 车载手机支架 - 出风口夹持式 (大屏手机)
// Phone Mount for Car Air Vent (Large Phone)
// ============================================

// ============ 参数定义 ============
PHONE_WIDTH = 78;        // 手机宽度 (大屏手机约75-78mm)
PHONE_LENGTH = 170;      // 手机长度
PHONE_THICKNESS = 10;    // 手机厚度 (带壳)
MOUNT_DEPTH = 50;        // 托盘深度
MOUNT_RIM_HEIGHT = 15;   // 边缘高度

// 出风口夹持参数
CLAMP_WIDTH = 40;        // 夹爪宽度
CLAMP_HEIGHT = 25;       // 夹爪高度
CLAMP_DEPTH = 35;        // 夹爪深度
VENT_GAP = 18;           // 风口叶片间隙 (可调)

// 颈部参数
NECK_WIDTH = 20;
NECK_LENGTH = 60;
NECK_HEIGHT = 15;

// 细节参数
$fn = 64;                // 圆滑度

// ============ 模块定义 ============

// 圆角矩形 (用于挤出)
module rounded_rect(w, h, r) {
    r = min(r, w/2, h/2);
    hull() {
        translate([r, r, 0]) cylinder(r=r);
        translate([w-r, r, 0]) cylinder(r=r);
        translate([r, h-r, 0]) cylinder(r=r);
        translate([w-r, h-r, 0]) cylinder(r=r);
    }
}

// 手机托盘
module phone_tray() {
    difference() {
        // 主体
        union() {
            // 底部托盘
            translate([-MOUNT_DEPTH/2, -CLAMP_WIDTH/2, 0])
                rounded_rect(MOUNT_DEPTH, CLAMP_WIDTH, 5);

            // 左侧护栏
            translate([-MOUNT_DEPTH/2, -CLAMP_WIDTH/2 - 8, 0])
                rounded_rect(10, CLAMP_WIDTH + 16, 3);

            // 右侧护栏
            translate([MOUNT_DEPTH/2 - 10, -CLAMP_WIDTH/2 - 8, 0])
                rounded_rect(10, CLAMP_WIDTH + 16, 3);

            // 底部加强筋
            translate([-MOUNT_DEPTH/2 + 5, -5, -8])
                rounded_rect(MOUNT_DEPTH - 10, 10, 2);
        }

        // 挖空手机放置区
        translate([0, 0, -1])
            rounded_rect(MOUNT_DEPTH - 8, PHONE_WIDTH, 5);

        // 底部减重孔
        translate([0, 0, -5])
            cylinder(d=20, h=20);

        // 通风口
        for (i = [-15, 0, 15])
            translate([-MOUNT_DEPTH/2 + 8, i, -5])
                cylinder(d=8, h=15);
    }
}

// 出风口夹持部
module vent_clamp() {
    difference() {
        union() {
            // 主体夹框
            translate([-CLAMP_DEPTH/2, -CLAMP_WIDTH/2, 0])
                rounded_rect(CLAMP_DEPTH, CLAMP_WIDTH, 5);

            // 上夹爪 (带齿)
            translate([-CLAMP_DEPTH/2, -VENT_GAP/2 - 3, CLAMP_HEIGHT - 5])
                rounded_rect(CLAMP_DEPTH + 15, VENT_GAP + 6, 3);

            // 下夹爪 (带齿)
            translate([-CLAMP_DEPTH/2, -VENT_GAP/2 - 3, -CLAMP_HEIGHT + 5])
                rounded_rect(CLAMP_DEPTH + 15, VENT_GAP + 6, 3);

            // 背板加强
            translate([-CLAMP_DEPTH/2 - 5, -CLAMP_WIDTH/2, -CLAMP_HEIGHT])
                rounded_rect(10, CLAMP_WIDTH, 3);

            // 防滑齿 (上)
            for (i = [0:3:VENT_GAP])
                translate([CLAMP_DEPTH/2 + 8, -VENT_GAP/2 + i, CLAMP_HEIGHT - 2])
                    cylinder(d1=4, d2=3, h=4);

            // 防滑齿 (下)
            for (i = [0:3:VENT_GAP])
                translate([CLAMP_DEPTH/2 + 8, -VENT_GAP/2 + i, -CLAMP_HEIGHT + 2])
                    cylinder(d1=4, d2=3, h=4);
        }

        // 夹持空间
        translate([-CLAMP_DEPTH/2 - 1, -VENT_GAP/2, -CLAMP_HEIGHT])
            rounded_rect(CLAMP_DEPTH + 10, VENT_GAP, CLAMP_HEIGHT * 2);

        // 减重孔
        for (pos = [[-8, -8], [-8, 8], [8, -8], [8, 8]])
            translate([pos[0], pos[1], 0])
                cylinder(d=8, h=50, center=true);

        // 中间槽
        translate([0, -2, 0])
            rounded_rect(20, 4, 2);
    }
}

// 连接颈部
module connecting_neck() {
    hull() {
        // 底部 (与夹持部连接)
        translate([-NECK_WIDTH/2, -NECK_WIDTH/2, 0])
            cylinder(d=NECK_WIDTH, h=5);

        // 顶部 (与托盘连接)
        translate([-NECK_WIDTH/2, -NECK_WIDTH/2, NECK_LENGTH])
            cylinder(d=NECK_WIDTH, h=5);
    }

    // 球形关节槽
    translate([0, 0, NECK_LENGTH - 10])
        sphere(d=NECK_WIDTH + 6);
}

// 球形关节
module ball_joint() {
    translate([0, 0, -5])
        sphere(d=NECK_WIDTH + 8);
}

// ============ 组合装配 ============
module car_phone_mount() {
    // 出风口夹持部
    vent_clamp();

    // 连接颈部
    translate([0, 0, CLAMP_HEIGHT])
        connecting_neck();

    // 球形关节
    translate([0, 0, CLAMP_HEIGHT + NECK_LENGTH - 5])
        ball_joint();

    // 手机托盘 (可分离设计)
    translate([0, 0, CLAMP_HEIGHT + NECK_LENGTH + 5])
        phone_tray();
}

// 渲染
car_phone_mount();

// ============ 打印设置建议 ============
/*
打印设置建议:
- 层高: 0.2mm
- 填充: 30-50%
- 打印材料: PLA 或 PETG
- 打印方向: 托盘朝下，夹持部朝上
- 是否需要支撑: 是 (建议使用支撑结构)
- 喷嘴温度: PLA 200-215°C, PETG 230-250°C

建议后处理:
- 打磨表面
- 如需弹性可安装橡胶圈
- 夹持部可包裹硅胶防滑垫

调整参数:
- 如手机更大/更小，修改 PHONE_WIDTH
- 如出风口不同，调整 VENT_GAP
*/