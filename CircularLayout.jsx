function main() {
    // 1. 检查文档和选中项
    if (app.documents.length == 0) {
        alert("请先打开一个 InDesign 文档。");
        return;
    }

    var selection = app.selection;
    if (selection.length == 0) {
        alert("请先选中需要排版的对象。");
        return;
    }

    var doc = app.activeDocument;
    var page = app.activeWindow.activePage;

    // 保存原始标尺设置，以便最后恢复
    var oldRulerOrigin = doc.viewPreferences.rulerOrigin;
    var oldZeroPoint = doc.zeroPoint;

    // 将标尺原点临时设置为当前页面左上角 [0, 0]
    doc.viewPreferences.rulerOrigin = RulerOrigin.PAGE_ORIGIN;
    doc.zeroPoint = [0, 0];

    // 页面尺寸单位：毫米（InDesign 页面坐标系默认单位）
    // 注意：bounds 返回的是 [y1, x1, y2, x2]，单位 mm

    // 获取页面尺寸
    var pageBounds = page.bounds; // [y1, x1, y2, x2]
    var pageW = pageBounds[3] - pageBounds[1];
    var pageH = pageBounds[2] - pageBounds[0];

    // 2. 创建用户界面 (使用 ScriptUI 以支持动态交互)
    var w = new Window("dialog", "高级圆周排版 (含放射线)");
    w.alignChildren = ["fill", "top"];

    var p1 = w.add("panel", undefined, "基本参数");
    p1.alignChildren = ["left", "top"];
    p1.add("statictext", undefined, "选中对象总数: " + selection.length);

    var gX = p1.add("group");
    gX.add("statictext", undefined, "圆心 X (mm):").preferredSize.width = 90;
    var centerXField = gX.add("edittext", undefined, (pageW / 2).toFixed(2));
    centerXField.characters = 8;

    var gY = p1.add("group");
    gY.add("statictext", undefined, "圆心 Y (mm):").preferredSize.width = 90;
    var centerYField = gY.add("edittext", undefined, (pageH / 2).toFixed(2));
    centerYField.characters = 8;

    var gR = p1.add("group");
    gR.add("statictext", undefined, "半径 (mm):").preferredSize.width = 90;
    var radiusField = gR.add("edittext", undefined, "100");
    radiusField.characters = 8;

    var p2 = w.add("panel", undefined, "排列模式");
    p2.alignChildren = ["left", "top"];

    var gMode = p2.add("group");
    gMode.add("statictext", undefined, "模式选择:").preferredSize.width = 90;
    var layoutModeDropdown = gMode.add("dropdownlist", undefined, ["自定义范围 (两点间均分)", "固定间隔 (起始角+步长)"]);
    layoutModeDropdown.selection = 0;

    var gSA = p2.add("group");
    gSA.add("statictext", undefined, "起始角度 (度):").preferredSize.width = 90;
    var startAngleField = gSA.add("edittext", undefined, "0");
    startAngleField.characters = 8;

    var gEA = p2.add("group");
    gEA.add("statictext", undefined, "终止角度 (度):").preferredSize.width = 90;
    var endAngleField = gEA.add("edittext", undefined, "360");
    endAngleField.characters = 8;

    var gFS = p2.add("group");
    gFS.add("statictext", undefined, "固定间隔 (度):").preferredSize.width = 90;
    var fixedStepField = gFS.add("edittext", undefined, "30");
    fixedStepField.characters = 8;

    var p3 = w.add("panel", undefined, "高级选项");
    p3.alignChildren = ["left", "top"];
    var drawLineCheckbox = p3.add("checkbox", undefined, "绘制放射线 (中心点到文本框连线)");
    drawLineCheckbox.value = true;

    var gAlign = p3.add("group");
    gAlign.add("statictext", undefined, "对齐方式:");
    var alignDropdown = gAlign.add("dropdownlist", undefined, ["底部居中对齐", "左下角对齐 (沿线向外)", "右下角对齐 (沿线向内)"]);
    alignDropdown.selection = 0;

    var buttons = w.add("group");
    buttons.alignment = "center";
    buttons.add("button", undefined, "确定", {name: "ok"});
    buttons.add("button", undefined, "取消", {name: "cancel"});

    // 动态交互逻辑：切换模式时自动灰显（禁用）不需要的输入框
    layoutModeDropdown.onChange = function() {
        if (layoutModeDropdown.selection.index == 0) {
            gEA.enabled = true;
            gFS.enabled = false;
        } else {
            gEA.enabled = false;
            gFS.enabled = true;
        }
    }
    layoutModeDropdown.onChange(); // 初始化界面状态

    // 3. 执行逻辑
    if (w.show() == 1) {
        var centerX = parseFloat(centerXField.text) || 0;
        var centerY = parseFloat(centerYField.text) || 0;
        var radius = parseFloat(radiusField.text) || 0;
        var startAngle = parseFloat(startAngleField.text) || 0;
        var endAngle = parseFloat(endAngleField.text) || 0;
        var fixedStep = parseFloat(fixedStepField.text) || 0;
        var drawLine = drawLineCheckbox.value;
        var alignMode = alignDropdown.selection.index;
        var layoutMode = layoutModeDropdown.selection.index;
        var count = selection.length;

        // 准备独立图层
        var textLayer = doc.layers.itemByName("圆周文本");
        if (!textLayer.isValid) {
            textLayer = doc.layers.add({name: "圆周文本"});
        }
        var lineLayer = doc.layers.itemByName("放射线");
        if (!lineLayer.isValid) {
            lineLayer = doc.layers.add({name: "放射线"});
            // 将放射线图层置于文本图层下方，防止线遮挡文字
            try {
                lineLayer.move(LocationOptions.AFTER, textLayer);
            } catch(e) {}
        }

        // 根据模式计算角度步长
        var angleStep;
        if (layoutMode === 1) {
            // 固定间隔模式：直接使用用户指定的固定步长
            angleStep = fixedStep;
        } else {
            // 自定义范围：在 [startAngle, endAngle] 内均分
            if (count > 1) {
                angleStep = (endAngle - startAngle) / (count - 1);
                // 如果范围 >= 360° 则不重叠首尾
                if (Math.abs(endAngle - startAngle) >= 360) {
                    angleStep = (endAngle - startAngle) / count;
                }
            } else {
                angleStep = 0;
            }
        }

        // 循环处理选中的对象
        for (var i = 0; i < count; i++) {
            var item = selection[i];
            var currentAngle = startAngle + (i * angleStep);
            
            // InDesign 的 Y 轴向下，正常数学角度（顺时针增加）：
            var radians = currentAngle * Math.PI / 180;

            // 计算放射线终点 P
            var targetX = centerX + radius * Math.cos(radians);
            var targetY = centerY + radius * Math.sin(radians);

            // 绘制放射线
            if (drawLine) {
                var line = page.graphicLines.add();
                line.itemLayer = lineLayer; // 分配到放射线图层
                line.paths.item(0).pathPoints.item(0).anchor = [centerX, centerY];
                line.paths.item(0).pathPoints.item(1).anchor = [targetX, targetY];
                try {
                    line.strokeWeight = 1;
                    line.strokeColor = doc.swatches.item("Black");
                } catch(e) {}
            }

            // 将文本框分配到文本图层
            item.itemLayer = textLayer;

            // 1. 先重置旋转角度为 0，以准确计算原始尺寸
            item.rotationAngle = 0;

            // 2. 获取对象尺寸
            var gb = item.geometricBounds;
            var itemW = gb[3] - gb[1];
            var itemH = gb[2] - gb[0];

            // 3. 计算文本框应处于的中心点坐标 (C_X, C_Y)
            // 使得在旋转后，特定的锚点(底部居中/左下/右下)刚好落在终点 P 上
            var cx = 0;
            var cy = 0;
            
            if (alignMode === 0) { 
                // 底部居中：使得文本框的底边中心正好卡在放射线终点
                cx = targetX + (itemH / 2) * Math.sin(radians);
                cy = targetY - (itemH / 2) * Math.cos(radians);
            } else if (alignMode === 1) { 
                // 左下角：使得文本框左下角在终点，文本框沿着放射线向外延伸
                cx = targetX + (itemW / 2) * Math.cos(radians) + (itemH / 2) * Math.sin(radians);
                cy = targetY + (itemW / 2) * Math.sin(radians) - (itemH / 2) * Math.cos(radians);
            } else if (alignMode === 2) { 
                // 右下角：使得文本框右下角在终点，文本框沿着放射线向内延伸
                cx = targetX - (itemW / 2) * Math.cos(radians) + (itemH / 2) * Math.sin(radians);
                cy = targetY - (itemW / 2) * Math.sin(radians) - (itemH / 2) * Math.cos(radians);
            }

            // 4. 将对象中心移动到计算出的 (cx, cy)
            item.geometricBounds = [
                cy - (itemH / 2),
                cx - (itemW / 2),
                cy + (itemH / 2),
                cx + (itemW / 2)
            ];
            
            // 5. 应用旋转 (InDesign 默认正值为逆时针，由于我们希望文本框底边顺时针贴合放射线，所以取负值)
            item.rotationAngle = -currentAngle; 
        }
    }

    // 恢复原始标尺设置
    doc.viewPreferences.rulerOrigin = oldRulerOrigin;
    doc.zeroPoint = oldZeroPoint;
}

main();
