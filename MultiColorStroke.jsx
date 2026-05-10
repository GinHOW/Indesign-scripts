// DESCRIPTION: Multi-Color Stroke for InDesign

/*
About Script
更改选定形状框的线框（描边）颜色。
支持从色板中选择多个颜色，并以「顺序」或「随机」模式赋予。

To Use:
1. 在文档中选中一个或多个形状框。
2. 运行脚本。
3. 在弹出的对话框中：
   - 设置描边粗细。
   - 从色板列表中选择一个或多个颜色（Cmd/Shift 多选）。
   - 选择颜色赋予模式：顺序 或 随机。
4. 点击「确定」。

Copyright (c) by Gu Wenhao, 2026
Version 1.0.1
*/

function main() {
    // 1. 基础检查
    if (app.documents.length === 0) {
        alert("请先打开一个 InDesign 文档。");
        return;
    }

    var doc = app.activeDocument;
    var selection = app.selection;

    if (selection.length === 0) {
        alert("请先选中至少一个对象。");
        return;
    }

    // ── 读取缓存 (使用 ExtendScript 原生 toSource/eval 替代 JSON) ──────────
    var c_weight = "1";
    var c_colorMode = 0; // 0=顺序, 1=随机
    var c_selectedSwatchNames = [];

    var cache = app.extractLabel("MultiColorStroke_Cache_v3");
    if (cache && cache !== "") {
        try {
            var parsed = eval(cache);
            if (parsed) {
                c_weight = parsed.weight || c_weight;
                c_colorMode = (parsed.colorMode !== undefined) ? parsed.colorMode : 0;
                c_selectedSwatchNames = parsed.swatches || [];
            }
        } catch (e) {}
    }

    // ── 枚举色板 ────────────────────────────────────────────────────────────
    var swatchNames = [];
    for (var s = 0; s < doc.swatches.length; s++) {
        var sw = doc.swatches[s];
        if (sw.name && sw.name !== "") {
            swatchNames.push(sw.name);
        }
    }
    if (swatchNames.length === 0) swatchNames = ["Black"];

    // 2. ScriptUI 对话框
    var w = new Window("dialog", "多色描边工具");
    w.alignChildren = ["fill", "top"];

    // ── 样式面板
    var pStyle = w.add("panel", undefined, "描边样式");
    pStyle.alignChildren = ["left", "top"];

    var gWeight = pStyle.add("group");
    gWeight.add("statictext", undefined, "描边粗细 (pt):").preferredSize.width = 110;
    var weightField = gWeight.add("edittext", undefined, c_weight);
    weightField.characters = 8;

    // ── 颜色面板
    var pColor = w.add("panel", undefined, "选择颜色（可多选）");
    pColor.alignChildren = ["fill", "top"];
    var swatchListbox = pColor.add("listbox", [0, 0, 260, 200], swatchNames, { multiselect: true });

    // 恢复选中
    for (var li = 0; li < swatchListbox.items.length; li++) {
        for (var si = 0; si < c_selectedSwatchNames.length; si++) {
            if (swatchListbox.items[li].text === c_selectedSwatchNames[si]) {
                swatchListbox.items[li].selected = true;
            }
        }
    }
    if (swatchListbox.selection === null && swatchListbox.items.length > 0) {
        swatchListbox.items[0].selected = true;
    }

    // ── 模式面板
    var pMode = w.add("panel", undefined, "赋予模式");
    pMode.alignChildren = ["left", "top"];
    var rbSeq = pMode.add("radiobutton", undefined, "顺序");
    var rbRnd = pMode.add("radiobutton", undefined, "随机");
    rbSeq.value = (c_colorMode === 0);
    rbRnd.value = (c_colorMode === 1);

    // ── 按钮
    var buttons = w.add("group");
    buttons.alignment = "center";
    buttons.add("button", undefined, "确定", { name: "ok" });
    buttons.add("button", undefined, "取消", { name: "cancel" });

    // 3. 执行
    if (w.show() === 1) {
        var strokeWeight = parseFloat(weightField.text) || 1;
        var colorMode = rbRnd.value ? 1 : 0;

        var selectedNames = [];
        for (var li2 = 0; li2 < swatchListbox.items.length; li2++) {
            if (swatchListbox.items[li2].selected) {
                selectedNames.push(swatchListbox.items[li2].text);
            }
        }
        if (selectedNames.length === 0) selectedNames = [swatchNames[0]];

        // 保存缓存 (使用 toSource)
        var saveData = {
            weight: strokeWeight,
            colorMode: colorMode,
            swatches: selectedNames
        };
        app.insertLabel("MultiColorStroke_Cache_v3", saveData.toSource());

        // 获取色板对象
        var swatchObjects = [];
        for (var ni = 0; ni < selectedNames.length; ni++) {
            var swObj = doc.swatches.itemByName(selectedNames[ni]);
            if (swObj.isValid) swatchObjects.push(swObj);
        }

        // 应用
        app.doScript(function() {
            for (var i = 0; i < selection.length; i++) {
                var item = selection[i];
                // 检查是否具有描边颜色属性
                if (!item.hasOwnProperty("strokeColor")) continue;

                var finalSwatch;
                if (colorMode === 1) {
                    finalSwatch = swatchObjects[Math.floor(Math.random() * swatchObjects.length)];
                } else {
                    finalSwatch = swatchObjects[i % swatchObjects.length];
                }

                try {
                    item.strokeWeight = strokeWeight;
                    item.strokeColor = finalSwatch;
                } catch (e) {}
            }
        }, ScriptLanguage.JAVASCRIPT, [], UndoModes.ENTIRE_SCRIPT, "Multi-Color Stroke");
    }
}

main();
