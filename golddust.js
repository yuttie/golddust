(function() {
  "use strict";

  function getCanvasSize() {
    return [window.innerWidth, window.innerHeight];
  }

  function getopt(f) {
    window.location.search.slice(1).split("&").forEach(function(param) {
      const kv = param.split("=");
      const key = decodeURIComponent(kv[0]);
      const value = decodeURIComponent(kv[1]);
      f(key, value);
    });
  }

  const data_name = "dataset.json";
  const limit = 100;
  getopt(function(key, value) {
    switch (key) {
    case "limit":
      value = parseInt(value);
      if (isNaN(value)) {
      }
      else {
        limit = value;
      }
      break;
    }
  });

  let [width, height] = getCanvasSize();
  const initScaleFactor = 3.0;
  let scaleFactor = initScaleFactor;

  // Initialize the application
  const app = new PIXI.Application({
    backgroundColor: 0x222222,
    antialias: true,
    resolution: window.devicePixelRatio,
  });
  app.renderer.autoResize = true;
  app.stage.interactive = true;
  const mainLayer = new PIXI.Container();
  app.stage.addChild(mainLayer);
  document.body.insertBefore(app.view, document.body.firstChild);
  function onResize() {
    let [width, height] = getCanvasSize();
    app.renderer.resize(width, height);

    // Center the origin of the stage
    app.stage.x = width / 2;
    app.stage.y = height / 2;
    app.stage.hitArea = app.screen.clone();
    app.stage.hitArea.x = -width / 2;
    app.stage.hitArea.y = -height / 2;
  }
  window.addEventListener("resize", onResize);
  window.addEventListener("DOMContentLoaded", onResize);

  window.addEventListener("unload", e => {
    app.destroy(false, {children: true, texture: true, baseTexture: true});
  });

  // Scene
  const normalTextStyle = new PIXI.TextStyle({
    fontSize: 16,
    fill: "#444",
  });
  const highlightedTextStyle = new PIXI.TextStyle({
    fontSize: 16,
    fill: "#fff",
  });
  const radius = 1;
  const fillColor = 0xffdd00;
  const highlightColor = 0xff0000;
  const texts = new PIXI.Container();
  mainLayer.addChild(texts);
  const points = new PIXI.Container();
  mainLayer.addChild(points);
  const pointTexture = (() => {
    const g = new PIXI.Graphics();
    g.beginFill(fillColor, 0.1);
    g.drawStar(0, 0, 3, radius, radius, 0);
    g.endFill();
    return g.generateCanvasTexture();
  })();
  const highlightedPointTexture = (() => {
    const g = new PIXI.Graphics();
    g.beginFill(highlightColor);
    g.drawStar(0, 0, 3, radius, radius, 0);
    g.endFill();
    return g.generateCanvasTexture();
  })();
  function initScene(data) {
    // Clear
    for (const point of points.children) {
      point.destroy();
    }
    for (const text of texts.children) {
      text.destroy();
    }
    points.removeChildren();
    texts.removeChildren();

    // Generate
    data.forEach(d => {
      // Points
      const point = new PIXI.Sprite(pointTexture);
      point.interactive = true;
      point.buttonMode = true;
      points.addChild(point);
      d.pointGraphics = point;

      // Texts
      const text = new PIXI.Text(d.word, normalTextStyle);
      text.anchor.set(0, 0.6);
      texts.addChild(text);
      d.textGraphics = text;
    });
  }
  function updateScene(data) {
    data.forEach(d => {
      // Points
      const point = d.pointGraphics;
      point.x = 2**scaleFactor * d.x;
      point.y = 2**scaleFactor * d.y;

      // Texts
      const text = d.textGraphics;
      text.x = 2**scaleFactor * d.x;
      text.y = 2**scaleFactor * d.y;
    });
  }

  // Dataset
  let data = null;
  fetch('dataset.json').then(res => {
    res.json().then(json => {
      data = json;
      initScene(data);
      updateScene(data);
    });
  })

  // Query
  document.addEventListener("keydown", function() {
    document.querySelector("#query").focus();
  });

  document.querySelector("#query").addEventListener("input", function() {
    const query = this.value;

    if (query == '') {
      document.querySelector("#message").innerText = 'empty';
      data.forEach(d => {
        d.pointGraphics.texture = pointTexture;
        d.textGraphics.style = normalTextStyle;
      });
    }
    else {
      document.querySelector("#message").innerText = 'not empty';
      const re = new RegExp(query);
      data.forEach(d => {
        if (re.test(d.word)) {
          d.pointGraphics.texture = highlightedPointTexture;
          d.textGraphics.style = highlightedTextStyle;
          texts.setChildIndex(d.textGraphics, texts.children.length - 1);
        }
        else {
          d.pointGraphics.texture = pointTexture;
          d.textGraphics.style = normalTextStyle;
        }
      });
    }
  });

  // Pan
  let grab = null;
  app.stage.on("pointerdown", e => {
    const initLayerPosition = new PIXI.Point(mainLayer.position.x, mainLayer.position.y);
    grab = {
      initLayerPosition: initLayerPosition,
      initPointerPosition: e.data.global.clone(),
      data: e.data,
    };
  });
  app.stage.on("pointermove", e => {
    if (grab) {
      const dx = grab.data.global.x - grab.initPointerPosition.x;
      const dy = grab.data.global.y - grab.initPointerPosition.y;
      mainLayer.position.x = grab.initLayerPosition.x + dx;
      mainLayer.position.y = grab.initLayerPosition.y + dy;
    }
  });
  app.stage.on("pointerup", e => {
    grab = null;
  });
  app.stage.on("pointerupoutside", e => {
    grab = null;
  });

  // Zoom
  function zoom(ratio, cx_canvas, cy_canvas) {
    scaleFactor += ratio;
    const cx_stage = cx_canvas - app.stage.x;
    const cy_stage = cy_canvas - app.stage.y;
    mainLayer.x = 2**ratio * (mainLayer.x - cx_stage) + cx_stage;
    mainLayer.y = 2**ratio * (mainLayer.y - cy_stage) + cy_stage;
    updateScene(data);
  }
  function onWheel(e) {
    e.stopPropagation();
    e.preventDefault();

    // Center of zoom
    const cx_canvas = e.clientX - e.target.clientLeft;
    const cy_canvas = e.clientY - e.target.clientTop;

    // Convert the amount into a scale factor
    const delta =  e.deltaY       // 'wheel' event
               || -e.wheelDeltaY  // Webkit's mousewheel event
               || -e.wheelDelta;  // other's mousewheel event
    if (delta > 0) {
      zoom(-0.1, cx_canvas, cy_canvas);
    }
    else if (delta < 0) {
      zoom(0.1, cx_canvas, cy_canvas);
    }
  }
  app.view.addEventListener("wheel", onWheel);
  app.view.addEventListener("mousewheel", onWheel);
  app.view.addEventListener("DOMMouseScroll", onWheel);
})();
