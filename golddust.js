(function() {
  "use strict";

  function getCanvasSize() {
    return [window.innerWidth, window.innerHeight];
  }

  function getopt(f) {
    window.location.search.slice(1).split("&").forEach(function(param) {
      var kv = param.split("=");
      var key = decodeURIComponent(kv[0]);
      var value = decodeURIComponent(kv[1]);
      f(key, value);
    });
  }

  var data_name = "dataset.json";
  var limit = 100;
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
  let scaleFactor = 3.0;

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

  // Scene
  const textStyle = new PIXI.TextStyle({
    fontSize: 16,
    fill: "#444",
  });
  const radius = 4;
  const fillColor = 0xffdd00;
  const texts = new PIXI.Container();
  mainLayer.addChild(texts);
  const graphics = new PIXI.Graphics();
  graphics.interactive = true;
  graphics.buttonMode = true;
  mainLayer.addChild(graphics);
  function drawPoint(graphics, x, y, r) {
    graphics.drawStar(x, y, 3, r, r, 0);
  }
  function initScene(data) {
    graphics.clear();
    texts.removeChildren();

    // Points
    const r = radius * 2**(-scaleFactor);
    graphics.beginFill(fillColor, 0.1);
    data.forEach(d => {
      drawPoint(graphics, d.x, d.y, r);
    });
    graphics.endFill();

    // Texts
    data.forEach(d => {
      let text = new PIXI.Text(d.word, textStyle);
      text.anchor.set(0, 0.6);
      text.x = d.x + 0;
      text.y = d.y + 0;
      text.scale.x = 2**(-scaleFactor);
      text.scale.y = 2**(-scaleFactor);
      texts.addChild(text);
      d.textGraphics = text;
    });
  }
  function updateScene(data) {
    graphics.clear();

    // Points
    const r = radius * 2**(-scaleFactor);
    graphics.beginFill(fillColor, 0.1);
    data.forEach(d => {
      drawPoint(graphics, d.x, d.y, r);
    });
    graphics.endFill();

    // Texts
    data.forEach(d => {
      let text = d.textGraphics;
      text.scale.x = 2**(-scaleFactor);
      text.scale.y = 2**(-scaleFactor);
    });

    // Layer
    mainLayer.scale.x = 2**scaleFactor;
    mainLayer.scale.y = 2**scaleFactor;
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
    }
    else {
      document.querySelector("#message").innerText = 'not empty';
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
  function onWheel(e) {
    e.stopPropagation();
    e.preventDefault();

    // Convert the amount into a scale factor
    const delta =  e.deltaY       // 'wheel' event
               || -e.wheelDeltaY  // Webkit's mousewheel event
               || -e.wheelDelta;  // other's mousewheel event
    let relativeScale = null;
    if (delta > 0) {
      scaleFactor -= 0.1;
      relativeScale = 2**(-0.1);
    }
    else if (delta < 0) {
      scaleFactor += 0.1;
      relativeScale = 2**0.1;
    }
    const ex_canvas = e.clientX - e.target.clientLeft;
    const ey_canvas = e.clientY - e.target.clientTop;
    const ex_stage = ex_canvas - app.stage.x;
    const ey_stage = ey_canvas - app.stage.y;
    mainLayer.x = relativeScale * (mainLayer.x - ex_stage) + ex_stage;
    mainLayer.y = relativeScale * (mainLayer.y - ey_stage) + ey_stage;
    updateScene(data);
  }
  app.view.addEventListener("wheel", onWheel);
  app.view.addEventListener("mousewheel", onWheel);
  app.view.addEventListener("DOMMouseScroll", onWheel);
})();
