// ============================================
// 杯架伸缩立柱 - 混合材料版 (PVC管 + 3D打印连接件)
// Telescopic Cup Holder Pole - Hybrid Version
// ============================================

// ============ 参数定义 ============

// === 底座参数 ===
BASE_OUTER_DIAMETER = 70;      // 底座外径 (适配大多数杯架)
BASE_HEIGHT = 35;              // 底座高度
BASE_WALL = 4;                 // 底座壁厚
BASE_BOTTOM_RIM = 8;           // 底部加重边厚度

// === 管材参数 (PVC/铝合金标准规格) ===
// 外管 (固定在底座上) - PVC给水管 DN40
OUTER_PIPE_OD = 48;            // 外管外径 (mm) - 标准 PVC 40mm
OUTER_PIPE_ID = 40;            // 外管内径 (mm)
OUTER_PIPE_LENGTH = 700;       // 外管长度 (可调整)

// 内管 (可伸缩) - PVC给水管 DN32
INNER_PIPE_OD = 34;            // 内管外径 (mm) - 标准 PVC 32mm
INNER_PIPE_ID = 28;            // 内管内径 (mm)
INNER_PIPE_LENGTH = 150;       // 内管伸出长度

// === 顶部配件参数 ===
TOP_PLATE_DIAMETER = 65;       // 顶板直径
TOP_PLATE_HEIGHT = 12;          // 顶板高度
TOP_COLLAR_HEIGHT = 20;        // 顶套高度

// === 夹紧机构参数 ===
CLAMP_SLOT_WIDTH = 8;          // 夹紧槽宽度
SETSCREW_DIAMETER = 6;         // 顶丝直径
SETSCREW_QTY = 3;              // 顶丝数量 (均匀分布)

// === 细节参数 ===
$fn = 64;                      // 圆滑度

// ============ 颜色定义 ============
COLOR_3DPRINT = [0.8, 0.8, 0.85];  // 3D 打印件颜色
COLOR_PIPE = [0.6, 0.6, 0.65];    // PVC 管颜色

// ============ 模块定义 ============

// 圆角底座
module rounded_base(d, h, r) {
    r = min(r, h/2);
    hull() {
        translate([0, 0, r])
            sphere(d=r*2);
        translate([0, 0, h-r])
            sphere(d=r*2);
    }
}

// ============ 底座模块 (杯架适配器) ============
module base_mount() {
    color(COLOR_3DPRINT)
    difference() {
        union() {
            // 主圆筒
            cylinder(d=BASE_OUTER_DIAMETER, h=BASE_HEIGHT);

            // 底部加重环
            translate([0, 0, -BASE_BOTTOM_RIM/2])
                rounded_base(BASE_OUTER_DIAMETER + 6, BASE_BOTTOM_RIM, 3);

            // 侧面防滑条纹
            for (i = [0:6:360]) {
                rotate([0, 0, i])
                    translate([BASE_OUTER_DIAMETER/2 - 3, 0, BASE_HEIGHT * 0.4])
                        cylinder(d=5, h=BASE_HEIGHT * 0.4);
            }

            // 内部加强筋
            for (i = [0:120:360]) {
                rotate([0, 0, i])
                    translate([0, 0, BASE_HEIGHT/2])
                        cube([BASE_OUTER_DIAMETER/2 - BASE_WALL - 5, 6, BASE_HEIGHT - 10]);
            }
        }

        // 内部腔体 (用于插入 PVC 管)
        translate([0, 0, -1])
            cylinder(d=OUTER_PIPE_OD + 2, h=BASE_HEIGHT + 2);

        // 定位扁位 (防止管子转动)
        translate([-CLAMP_SLOT_WIDTH/2, 0, BASE_HEIGHT - 6])
            cube([CLAMP_SLOT_WIDTH, BASE_OUTER_DIAMETER/2, 8]);

        // 底座减重孔
        for (i = [0:120:360]) {
            rotate([0, 0, i + 60])
                translate([BASE_OUTER_DIAMETER/3, 0, 10])
                    cylinder(d=12, h=BASE_HEIGHT - 15);
        }
    }
}

// 底座内衬套 (插入底座固定管子)
module base_insert_sleeve() {
    color(COLOR_3DPRINT)
    difference() {
        // 外圈
        cylinder(d=OUTER_PIPE_OD + 8, h=BASE_HEIGHT - 5);

        // 内腔
        translate([0, 0, -1])
            cylinder(d=OUTER_PIPE_OD + 1, h=BASE_HEIGHT - 3);

        // 减重槽
        for (i = [0:4]) {
            rotate([0, 0, i * 72])
                translate([OUTER_PIPE_OD/2 + 4, 0, 0])
                    cube([10, 8, BASE_HEIGHT], center=true);
        }
    }
}

// ============ 夹紧环模块 ============
module clamp_ring(outer_d, inner_d, height) {
    color(COLOR_3DPRINT)
    difference() {
        // 外环
        cylinder(d=outer_d, h=height);

        // 内孔
        translate([0, 0, -1])
            cylinder(d=inner_d, h=height + 2);

        // 夹紧槽 (3等分)
        for (i = [0:120:360]) {
            rotate([0, 0, i])
                translate([outer_d/2 + 2, -CLAMP_SLOT_WIDTH/2, height/2])
                    cube([outer_d, CLAMP_SLOT_WIDTH, height + 2], center=true);
        }

        // 顶丝孔
        for (i = [0:120:360]) {
            rotate([0, 0, i])
                translate([outer_d/2 + 2, 0, height/2])
                    rotate([90, 0, 0])
                        cylinder(d=SETSCREW_DIAMETER, h=outer_d + 10);
        }
    }
}

// 外管夹紧环
module outer_clamp_ring() {
    translate([0, 0, BASE_HEIGHT - 10])
        clamp_ring(OUTER_PIPE_OD + 16, OUTER_PIPE_OD + 2, 15);
}

// 内管夹紧环
module inner_clamp_ring() {
    translate([0, 0, BASE_HEIGHT + OUTER_PIPE_LENGTH - 30])
        clamp_ring(INNER_PIPE_OD + 14, INNER_PIPE_OD + 2, 12);
}

// ============ 顶部连接模块 ============
module top_connector() {
    color(COLOR_3DPRINT)
    difference() {
        union() {
            // 主圆盘
            cylinder(d=TOP_PLATE_DIAMETER, h=TOP_PLATE_HEIGHT);

            // 中心套筒
            translate([0, 0, TOP_PLATE_HEIGHT])
                cylinder(d=INNER_PIPE_OD + 8, h=TOP_COLLAR_HEIGHT);

            // 边缘加强筋
            for (i = [0:6]) {
                rotate([0, 0, i * 60])
                    translate([TOP_PLATE_DIAMETER/2 - 8, 0, TOP_PLATE_HEIGHT/2])
                        cylinder(d=6, h=TOP_PLATE_HEIGHT);
            }
        }

        // 内管通道
        translate([0, 0, -1])
            cylinder(d=INNER_PIPE_OD + 2, h=TOP_PLATE_HEIGHT + TOP_COLLAR_HEIGHT + 2);

        // 安装螺丝孔 (4个)
        for (i = [0:90:360]) {
            rotate([0, 0, i])
                translate([TOP_PLATE_DIAMETER/2.5, 0, TOP_PLATE_HEIGHT/2])
                    cylinder(d=4, h=TOP_PLATE_HEIGHT + 2);
        }

        // 侧面顶丝孔
        for (i = [0:120:360]) {
            rotate([0, 0, i])
                translate([TOP_PLATE_DIAMETER/2 + 5, 0, TOP_PLATE_HEIGHT + TOP_COLLAR_HEIGHT/2])
                    rotate([90, 0, 0])
                        cylinder(d=SETSCREW_DIAMETER, h=20);
        }
    }
}

// 顶板边缘橡胶垫 (可选)
module rubber_pad() {
    color([0.3, 0.3, 0.3])
    difference() {
        cylinder(d=TOP_PLATE_DIAMETER + 4, h=3);
        translate([0, 0, -1])
            cylinder(d=TOP_PLATE_DIAMETER - 4, h=5);
    }
}

// ============ PVC 管 (可视化) ============
module pvc_pipe(od, id, length) {
    color(COLOR_PIPE)
    difference() {
        cylinder(d=od, h=length);
        translate([0, 0, -1])
            cylinder(d=id, h=length + 2);
    }
}

// 外管 (PVC)
module outer_pipe() {
    pvc_pipe(OUTER_PIPE_OD, OUTER_PIPE_ID, OUTER_PIPE_LENGTH);
}

// 内管 (PVC)
module inner_pipe() {
    pvc_pipe(INNER_PIPE_OD, INNER_PIPE_ID, INNER_PIPE_LENGTH);
}

// ============ 备选顶部配件 ============

// 手机夹
module phone_clamp_mount() {
    PHONE_WIDTH = 78;
    PHONE_DEPTH = 15;

    color(COLOR_3DPRINT)
    difference() {
        union() {
            // 底座
            cylinder(d=40, h=15);

            // 左夹臂
            translate([-35, 0, 15])
                cube([20, 15, 40]);

            // 右夹臂
            translate([15, 0, 15])
                cube([20, 15, 40]);

            // 夹爪
            translate([-35, 0, 50])
                cylinder(d=15, h=20);

            translate([15, 0, 50])
                cylinder(d=15, h=20);
        }

        // 夹持空间
        translate([0, -2, 55])
            cube([PHONE_WIDTH, PHONE_DEPTH, 30]);
    }
}

// 球头连接件
module ball_joint_connector() {
    color(COLOR_3DPRINT)
    difference() {
        union() {
            // 连接座
            cylinder(d=35, h=12);

            // 球头
            translate([0, 0, 20])
                sphere(d=28);

            // 安装孔
            for (i = [0:90:360]) {
                rotate([0, 0, i])
                    translate([15, 0, 6])
                        cylinder(d=5, h=15);
            }
        }

        // 球头中心孔
        translate([0, 0, 35])
            cylinder(d=20, h=15);
    }
}

// ============ 完整装配 ============
module full_assembly() {
    // 底座
    base_mount();

    // 底座内衬套
    translate([0, 0, BASE_HEIGHT - 5])
        base_insert_sleeve();

    // 外管 (PVC管)
    translate([0, 0, BASE_HEIGHT])
        outer_pipe();

    // 外管夹紧环
    outer_clamp_ring();

    // 内管 (PVC管, 伸出100mm)
    translate([0, 0, BASE_HEIGHT + 10])
        inner_pipe();

    // 内管夹紧环
    inner_clamp_ring();

    // 顶部连接器
    translate([0, 0, BASE_HEIGHT + OUTER_PIPE_LENGTH + 10])
        top_connector();

    // 橡胶垫 (可选)
    // translate([0, 0, BASE_HEIGHT + OUTER_PIPE_LENGTH + TOP_PLATE_HEIGHT + TOP_COLLAR_HEIGHT])
    //     rubber_pad();

    // 手机夹 (备选)
    // translate([0, 0, BASE_HEIGHT + OUTER_PIPE_LENGTH + 10])
    //     phone_clamp_mount();

    // 球头 (备选)
    // translate([0, 0, BASE_HEIGHT + OUTER_PIPE_LENGTH + 10])
    //     ball_joint_connector();
}

// ============ 零件单独显示 ============
module show_all_parts() {
    // 底座
    translate([0, 0, 0])
        base_mount();

    // 底座内衬套
    translate([0, 0, 40])
        base_insert_sleeve();

    // 外管夹紧环
    translate([0, 0, 60])
        outer_clamp_ring();

    // 内管夹紧环
    translate([0, 0, 85])
        inner_clamp_ring();

    // 顶部连接器
    translate([0, 0, 105])
        top_connector();

    // PVC 管示意
    translate([80, 0, 35])
        outer_pipe();

    translate([80, 0, 60])
        inner_pipe();
}

// ============ 渲染 ============
// 显示完整装配
full_assembly();

// 显示零件分解图 (取消注释)
// %show_all_parts();

// ============ 打印指南 ============
/*
=== 3D 打印零件清单 ===

需要打印的零件:
1. base_mount()         - 底座 (杯架适配器)
2. base_insert_sleeve()  - 底座内衬套
3. outer_clamp_ring()    - 外管夹紧环
4. inner_clamp_ring()    - 内管夹紧环
5. top_connector()       - 顶部连接器
6. rubber_pad()          - 橡胶垫 (可选)

需要购买的材料:
- PVC 给水管 DN40 (外径48mm) - 长度约 700mm
- PVC 给水管 DN32 (外径34mm) - 长度约 150mm
- M6 螺丝 (顶丝) - 6颗
- M4 螺丝 - 4颗
- 橡胶垫/防滑垫

=== 打印设置 ===
层高: 0.2mm
填充: 40-50%
材料: PETG (推荐) 或 PLA
支撑: 根据形状决定

=== 组装步骤 ===
1. 将 PVC DN40 管插入底座，深度约 20mm
2. 用夹紧环固定 PVC 管
3. 将 PVC DN32 管插入外管，伸出约 100mm
4. 用内管夹紧环固定
5. 安装顶部连接器
6. 放入杯架，调整高度
7. 旋紧所有顶丝固定
*/