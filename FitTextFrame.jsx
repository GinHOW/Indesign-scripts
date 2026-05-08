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
Version 1.1.0
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

  // --- 读取缓存设置 ---
  var cache = app.extractLabel("FitTextFrame_Cache");
  var c_vTop = true, c_hLeft = true, c_fitW = false, c_fitH = true;
  if (cache) {
    var arr = cache.split(",");
    if (arr.length == 4) {
      c_vTop = (arr[0] === "1");
      c_hLeft = (arr[1] === "1");
      c_fitW = (arr[2] === "1");
      c_fitH = (arr[3] === "1");
    }
  }

  var pV = w.add("panel", undefined, "垂直锚点（哪条边固定不动）");
  pV.alignChildren = ["left", "top"];
  var rbTop = pV.add("radiobutton", undefined, "以上边框为准（向下延伸）"); rbTop.value = c_vTop;
  var rbBottom = pV.add("radiobutton", undefined, "以下边框为准（向上延伸）"); rbBottom.value = !c_vTop;

  var pH = w.add("panel", undefined, "水平锚点（哪条边固定不动）");
  pH.alignChildren = ["left", "top"];
  var rbLeft = pH.add("radiobutton", undefined, "以左边框为准（向右延伸）"); rbLeft.value = c_hLeft;
  var rbRight = pH.add("radiobutton", undefined, "以右边框为准（向左延伸）"); rbRight.value = !c_hLeft;

  var pOpt = w.add("panel", undefined, "调整方向");
  pOpt.alignChildren = ["left", "top"];
  var cbW = pOpt.add("checkbox", undefined, "调整宽度"); cbW.value = c_fitW;
  var cbH = pOpt.add("checkbox", undefined, "调整高度"); cbH.value = c_fitH;

  var btns = w.add("group"); btns.alignment = "center";
  btns.add("button", undefined, "确定", { name: "ok" });
  btns.add("button", undefined, "取消", { name: "cancel" });

  if (w.show() != 1) return;
  if (!cbW.value && !cbH.value) { alert("请至少勾选一个方向"); return; }

  // --- 保存缓存设置 ---
  app.insertLabel("FitTextFrame_Cache",
    (rbTop.value ? "1" : "0") + "," +
    (rbLeft.value ? "1" : "0") + "," +
    (cbW.value ? "1" : "0") + "," +
    (cbH.value ? "1" : "0")
  );

  app.doScript(function () {
    for (var i = 0; i < frames.length; i++)
      fitFrame(frames[i], rbTop.value, rbLeft.value, cbW.value, cbH.value);
  }, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, "文本框自适应内容大小");
}

function fitFrame(frame, vTop, hLeft, fitW, fitH) {

  // ── 1. 确定需要保持不动的锚点 ────────────────────────────────
  var anchorPt;
  if (vTop && hLeft) {
    anchorPt = AnchorPoint.TOP_LEFT_ANCHOR;    // 上边框 + 左边框 -> 左上角
  } else if (!vTop && hLeft) {
    anchorPt = AnchorPoint.BOTTOM_LEFT_ANCHOR; // 下边框 + 左边框 -> 左下角
  } else if (vTop && !hLeft) {
    anchorPt = AnchorPoint.TOP_RIGHT_ANCHOR;   // 上边框 + 右边框 -> 右上角
  } else {
    anchorPt = AnchorPoint.BOTTOM_RIGHT_ANCHOR;// 下边框 + 右边框 -> 右下角
  }
  // ── 2. 记录锚点在页面坐标系中的实际位置（旋转后的真实角点）──
  // 注意：geometricBounds 是轴对齐包围盒，不是实际角点！
  // resolve() 才能得到旋转框的真实角点坐标。
  var anchorBefore = frame.resolve(anchorPt, CoordinateSpaces.PARENT_COORDINATES)[0];

  // ── 3. 获取框当前的本地尺寸（通过两个角点的距离计算）────────
  var tl0 = frame.resolve(AnchorPoint.TOP_LEFT_ANCHOR, CoordinateSpaces.PARENT_COORDINATES)[0];
  var tr0 = frame.resolve(AnchorPoint.TOP_RIGHT_ANCHOR, CoordinateSpaces.PARENT_COORDINATES)[0];
  var bl0 = frame.resolve(AnchorPoint.BOTTOM_LEFT_ANCHOR, CoordinateSpaces.PARENT_COORDINATES)[0];
  var oldW = Math.sqrt(Math.pow(tr0[0] - tl0[0], 2) + Math.pow(tr0[1] - tl0[1], 2));
  var oldH = Math.sqrt(Math.pow(bl0[0] - tl0[0], 2) + Math.pow(bl0[1] - tl0[1], 2));

  // ── 4. 原生适应内容（以框的左上角为基准，不会变形）──────────
  frame.fit(FitOptions.FRAME_TO_CONTENT);

  // ── 5. 获取适应后的本地尺寸 ──────────────────────────────────
  var tl1 = frame.resolve(AnchorPoint.TOP_LEFT_ANCHOR, CoordinateSpaces.PARENT_COORDINATES)[0];
  var tr1 = frame.resolve(AnchorPoint.TOP_RIGHT_ANCHOR, CoordinateSpaces.PARENT_COORDINATES)[0];
  var bl1 = frame.resolve(AnchorPoint.BOTTOM_LEFT_ANCHOR, CoordinateSpaces.PARENT_COORDINATES)[0];
  var newW = Math.sqrt(Math.pow(tr1[0] - tl1[0], 2) + Math.pow(tr1[1] - tl1[1], 2));
  var newH = Math.sqrt(Math.pow(bl1[0] - tl1[0], 2) + Math.pow(bl1[1] - tl1[1], 2));

  // ── 6. 按用户勾选确定最终尺寸 ────────────────────────────────
  var finalW = fitW ? newW : oldW;
  var finalH = fitH ? newH : oldH;

  // ── 7. 若需要恢复某个方向的尺寸，在本地坐标系缩放 ───────────
  // 关键：使用 INNER_COORDINATES + resize()，不会因为旋转而变形！
  if (Math.abs(finalW - newW) > 0.01 || Math.abs(finalH - newH) > 0.01) {
    frame.resize(
      CoordinateSpaces.INNER_COORDINATES,
      anchorPt, // 使用用户选定的锚点，而不是写死的左上角
      ResizeMethods.REPLACING_CURRENT_DIMENSIONS_WITH,
      [finalW, finalH]
    );
  }

  // ── 8. 平移补偿：使锚点回到原来的位置 ─────────────────────
  // 所有调整完成后，计算锚点的偏移量。
  // 使用 transform 矩阵变换进行精准平移，这比 move() 更能抵抗标尺原点设置带来的干扰。
  var anchorAfter = frame.resolve(anchorPt, CoordinateSpaces.PARENT_COORDINATES)[0];
  var dx = anchorBefore[0] - anchorAfter[0];
  var dy = anchorBefore[1] - anchorAfter[1];

  if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
    var translationMatrix = app.transformationMatrices.add(1, 1, 0, 0, dx, dy);
    frame.transform(
      CoordinateSpaces.PARENT_COORDINATES,
      anchorPt,
      translationMatrix
    );
  }
}

main();
