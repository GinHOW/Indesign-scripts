//DESCRIPTION: Fit Text Frame to Content

/*
About Script
Resizes selected text frames to fit their actual text content,
with full control over which edge stays anchored (fixed) during resizing.

Uses InDesign's native "Fit Frame to Content" engine (the same as
double-clicking a frame handle), so the result is pixel-perfect and
consistent with manual operations.

To Use:
1. Select one or more text frames in your document.
2. Run the script.
3. Choose the anchor edge for vertical direction (top or bottom stays fixed).
4. Choose the anchor edge for horizontal direction (left or right stays fixed).
5. Check which dimensions to adjust (width, height, or both).
6. Click OK.

Notes:
- Height adjustment: shrinks or expands the frame vertically to wrap
  exactly around the text content, based on the current layout.
- Width adjustment: shrinks or expands the frame horizontally to wrap
  exactly around the longest text line, based on the current layout.
- The operation is fully undoable (Cmd+Z).

Copyright (c) by Gu Wenhao, 2026
Version 1.0.0
*/

function main() {
  if (app.documents.length == 0) { alert("请先打开文档"); return; }
  var allSelected = app.selection;
  var frames = [];
  for (var i = 0; i < allSelected.length; i++)
    if (allSelected[i].constructor.name === "TextFrame") frames.push(allSelected[i]);
  if (frames.length == 0) { alert("请先选中至少一个文本框"); return; }

  var w = new Window("dialog", "文本框自适应内容大小");
  w.alignChildren = ["fill", "top"];
  var info = w.add("statictext", undefined, "已选中 " + frames.length + " 个文本框");
  info.alignment = "center";

  var pV = w.add("panel", undefined, "垂直锚点（哪条边固定不动）");
  pV.alignChildren = ["left", "top"];
  var rbTop = pV.add("radiobutton", undefined, "以上边框为准（向下延伸）"); rbTop.value = true;
  pV.add("radiobutton", undefined, "以下边框为准（向上延伸）");

  var pH = w.add("panel", undefined, "水平锚点（哪条边固定不动）");
  pH.alignChildren = ["left", "top"];
  var rbLeft = pH.add("radiobutton", undefined, "以左边框为准（向右延伸）"); rbLeft.value = true;
  pH.add("radiobutton", undefined, "以右边框为准（向左延伸）");

  var pOpt = w.add("panel", undefined, "调整方向");
  pOpt.alignChildren = ["left", "top"];
  var cbW = pOpt.add("checkbox", undefined, "调整宽度"); cbW.value = false;
  var cbH = pOpt.add("checkbox", undefined, "调整高度"); cbH.value = true;

  var btns = w.add("group"); btns.alignment = "center";
  btns.add("button", undefined, "确定", { name: "ok" });
  btns.add("button", undefined, "取消", { name: "cancel" });

  if (w.show() != 1) return;
  if (!cbW.value && !cbH.value) { alert("请至少勾选一个方向"); return; }

  app.doScript(function () {
    for (var i = 0; i < frames.length; i++)
      fitFrame(frames[i], rbTop.value, rbLeft.value, cbW.value, cbH.value);
  }, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, "文本框自适应内容大小");
}

function fitFrame(frame, vTop, hLeft, fitW, fitH) {
  var ob = frame.geometricBounds;
  var oldH = ob[2] - ob[0];
  var oldW = ob[3] - ob[1];

  // 直接调用 InDesign 原生"使框架适合内容"
  // 等同于：对象 → 适合 → 使框架适合内容（或双击边框手柄）
  // 它会按当前文字排版状态精准地收缩/扩展框，与手动操作完全一致
  frame.fit(FitOptions.FRAME_TO_CONTENT);

  var nb = frame.geometricBounds;
  var newH = nb[2] - nb[0];
  var newW = nb[3] - nb[1];

  // 按用户勾选，决定哪个方向用新尺寸、哪个方向保留原尺寸
  var fH = fitH ? newH : oldH;
  var fW = fitW ? newW : oldW;

  // fit() 固定以左上角为基准，按锚点选择重新定位
  var y1 = vTop ? ob[0] : ob[2] - fH;
  var x1 = hLeft ? ob[1] : ob[3] - fW;
  frame.geometricBounds = [y1, x1, y1 + fH, x1 + fW];
}

main();
