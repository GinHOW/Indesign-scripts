// DESCRIPTION: Connect Frames with Lines for InDesign

/*
About Script
在多个选中的形状框之间建立全连接（两两连线），
连线端点位置为各形状框的几何中心。
所有连线自动组织到独立的「连接线」图层，便于管理与隐藏。

To Use:
1. 在文档中选中 2 个或更多对象（文本框、矩形等）。
2. 运行脚本。
3. 在弹出的对话框中：
   - 设置线条粗细。
   - 从色板列表中选择一个或多个颜色（Cmd/Shift 多选）。
   - 选择颜色赋予模式：顺序 或 随机。
4. 点击「确定」，脚本将在「连接线」图层中自动绘制所有连线。

Notes:
- 脚本会自动创建「连接线」图层（若已存在则直接使用），并置于最底层。
- 连线端点精确对齐各形状框的几何中心。
- 操作完全可撤销 (Cmd+Z)。

Copyright (c) by Gu Wenhao, 2026
Version 1.0.0
*/

// ── 工具：Fisher-Yates 洗牌（随机打乱数组副本）──────────────────────────────
function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    return a;
}

// ── 主函数 ────────────────────────────────────────────────────────────────────
function main() {
    // 1. 基础检查
    if (app.documents.length === 0) {
        alert("请先打开一个 InDesign 文档。");
        return;
    }

    var doc = app.activeDocument;
    var selection = app.selection;

    if (selection.length < 2) {
        alert("请至少选中 2 个对象，才能建立连接线。");
        return;
    }

    var page = app.activeWindow.activePage;
    var lineCount = selection.length * (selection.length - 1) / 2;

    // 2. 临时切换标尺原点到页面左上角
    var oldRulerOrigin = doc.viewPreferences.rulerOrigin;
    var oldZeroPoint = doc.zeroPoint;
    doc.viewPreferences.rulerOrigin = RulerOrigin.PAGE_ORIGIN;
    doc.zeroPoint = [0, 0];

    // ── 读取缓存 ────────────────────────────────────────────────────────────
    var c_weight = "0.5";
    var c_colorMode = 0;          // 0=顺序, 1=随机
    var c_selectedSwatchNames = []; // 上次选中的色板名

    var cache = app.extractLabel("ConnectFrames_Cache_v2");
    if (cache) {
        try {
            var parsed = JSON.parse(cache);
            c_weight = parsed.weight || c_weight;
            c_colorMode = parsed.colorMode || 0;
            c_selectedSwatchNames = parsed.swatches || [];
        } catch (e) { /* 忽略 JSON 解析失败 */ }
    }

    // ── 枚举文档色板（排除 "None" 以外的 None 类型，保留常规色）──────────────
    var swatchNames = [];
    for (var s = 0; s < doc.swatches.length; s++) {
        var sw = doc.swatches[s];
        // swatchType: ColorSwatch / TintSwatch / MixedInkSwatch / GradientSwatch
        // 排除内部特殊色板：""（未命名）
        if (sw.name && sw.name !== "") {
            swatchNames.push(sw.name);
        }
    }
    if (swatchNames.length === 0) swatchNames = ["Black"];

    // 3. ScriptUI 对话框
    var w = new Window("dialog", "形状框连接线 v1.1");
    w.alignChildren = ["fill", "top"];

    // ── 信息面板
    var pInfo = w.add("panel", undefined, "当前选择");
    pInfo.alignChildren = ["left", "top"];
    pInfo.add("statictext", undefined, "已选中对象数量：" + selection.length);
    pInfo.add("statictext", undefined, "将生成连线数量：" + lineCount);

    // ── 样式面板
    var pStyle = w.add("panel", undefined, "线条样式");
    pStyle.alignChildren = ["left", "top"];

    var gWeight = pStyle.add("group");
    gWeight.add("statictext", undefined, "线条粗细 (pt):").preferredSize.width = 110;
    var weightField = gWeight.add("edittext", undefined, c_weight);
    weightField.characters = 8;

    // ── 颜色面板
    var pColor = w.add("panel", undefined, "颜色选择（可 Cmd/Shift 多选）");
    pColor.alignChildren = ["fill", "top"];

    // 多选色板列表
    var swatchListbox = pColor.add("listbox", [0, 0, 260, 160], swatchNames, { multiselect: true });

    // 恢复上次选中的色板
    for (var li = 0; li < swatchListbox.items.length; li++) {
        for (var si = 0; si < c_selectedSwatchNames.length; si++) {
            if (swatchListbox.items[li].text === c_selectedSwatchNames[si]) {
                swatchListbox.items[li].selected = true;
            }
        }
    }
    // 若没有任何选中，默认选第一项（Black）
    var hasPreselect = false;
    for (var li2 = 0; li2 < swatchListbox.items.length; li2++) {
        if (swatchListbox.items[li2].selected) { hasPreselect = true; break; }
    }
    if (!hasPreselect && swatchListbox.items.length > 0) {
        swatchListbox.items[0].selected = true;
    }

    // ── 颜色模式
    var pMode = w.add("panel", undefined, "颜色赋予模式");
    pMode.alignChildren = ["left", "top"];
    var gMode = pMode.add("group");
    var rbSeq = gMode.add("radiobutton", undefined, "顺序（按选色顺序循环）");
    var rbRnd = gMode.add("radiobutton", undefined, "随机");
    rbSeq.value = (c_colorMode === 0);
    rbRnd.value = (c_colorMode === 1);

    // ── 按钮
    var buttons = w.add("group");
    buttons.alignment = "center";
    buttons.add("button", undefined, "确定", { name: "ok" });
    buttons.add("button", undefined, "取消", { name: "cancel" });

    // 4. 用户确认
    if (w.show() !== 1) {
        doc.viewPreferences.rulerOrigin = oldRulerOrigin;
        doc.zeroPoint = oldZeroPoint;
        return;
    }

    // ── 收集参数
    var strokeWeight = parseFloat(weightField.text) || 0.5;
    var colorMode = rbRnd.value ? 1 : 0; // 0=顺序, 1=随机

    // 收集选中色板名
    var selectedNames = [];
    for (var li3 = 0; li3 < swatchListbox.items.length; li3++) {
        if (swatchListbox.items[li3].selected) {
            selectedNames.push(swatchListbox.items[li3].text);
        }
    }
    if (selectedNames.length === 0) selectedNames = [swatchNames[0]];

    // 保存缓存（JSON）
    try {
        app.insertLabel("ConnectFrames_Cache_v2", JSON.stringify({
            weight: strokeWeight,
            colorMode: colorMode,
            swatches: selectedNames
        }));
    } catch (e) { /* 忽略 */ }

    // ── 解析色板对象
    var swatchObjects = [];
    for (var ni = 0; ni < selectedNames.length; ni++) {
        var sw2 = doc.swatches.itemByName(selectedNames[ni]);
        if (sw2 && sw2.isValid) {
            swatchObjects.push(sw2);
        }
    }
    if (swatchObjects.length === 0) {
        swatchObjects = [doc.swatches.itemByName("Black")];
    }

    // 若随机模式，打乱色板顺序（保证每次运行结果不同）
    if (colorMode === 1) {
        swatchObjects = shuffleArray(swatchObjects);
    }

    // 5. 确保「连接线」图层存在
    var lineLayer = doc.layers.itemByName("连接线");
    if (!lineLayer.isValid) {
        lineLayer = doc.layers.add({ name: "连接线" });
    }
    try { lineLayer.move(LocationOptions.AT_END); } catch (e) { }

    // 6. 计算各框几何中心
    var centers = [];
    for (var i = 0; i < selection.length; i++) {
        var gb = selection[i].geometricBounds; // [y1, x1, y2, x2]
        centers.push({
            x: (gb[1] + gb[3]) / 2,
            y: (gb[0] + gb[2]) / 2
        });
    }

    // 7. 绘制连线（封装为单步撤销）
    var colorIdx = 0; // 顺序模式计数器

    app.doScript(function () {
        for (var i = 0; i < centers.length; i++) {
            for (var j = i + 1; j < centers.length; j++) {
                var line = page.graphicLines.add();
                line.itemLayer = lineLayer;

                // 端点
                line.paths.item(0).pathPoints.item(0).anchor = [centers[i].x, centers[i].y];
                line.paths.item(0).pathPoints.item(1).anchor = [centers[j].x, centers[j].y];

                // 取色：顺序循环 or 随机（已在上面 shuffle，此处直接顺序取）
                var swatch;
                if (colorMode === 1) {
                    // 随机：每条线独立随机
                    swatch = swatchObjects[Math.floor(Math.random() * swatchObjects.length)];
                } else {
                    // 顺序循环
                    swatch = swatchObjects[colorIdx % swatchObjects.length];
                    colorIdx++;
                }

                try {
                    line.strokeWeight = strokeWeight;
                    line.strokeColor = swatch;
                } catch (e) { }
            }
        }
    }, ScriptLanguage.JAVASCRIPT, [], UndoModes.ENTIRE_SCRIPT, "Connect Frames");

    // 8. 恢复标尺设置
    doc.viewPreferences.rulerOrigin = oldRulerOrigin;
    doc.zeroPoint = oldZeroPoint;

    alert("完成！共绘制了 " + lineCount + " 条连接线。\n图层：「连接线」\n颜色模式：" + (colorMode === 1 ? "随机" : "顺序"));
}

main();
