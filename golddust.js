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

  window.addEventListener("unload", e => {
    app.destroy(false, {children: true, texture: true, baseTexture: true});
  });

  // Scene
  const defaultTextStyle = new PIXI.TextStyle({
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
      let text = new PIXI.Text(d.word, defaultTextStyle.clone());
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
      if (!d.match) {
        drawPoint(graphics, d.x, d.y, r);
      }
    });
    graphics.endFill();

    graphics.beginFill(0xff0000);
    data.forEach(d => {
      if (d.match) {
        drawPoint(graphics, d.x, d.y, r);
      }
    });
    graphics.endFill();

    // Texts
    data.forEach(d => {
      let text = d.textGraphics;
      text.scale.x = 2**(-scaleFactor);
      text.scale.y = 2**(-scaleFactor);
      if (d.match) {
        text.style.fill = '#fff';
      }
      else {
        text.style.fill = '#444';
      }
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
      data.forEach(d => {
        d.match = false;
      });
    }
    else {
      document.querySelector("#message").innerText = 'not empty';
      const re = new RegExp(query);
      data.forEach(d => {
        d.match = re.test(d.word);
        if (d.match) {
          texts.setChildIndex(d.textGraphics, texts.children.length - 1);
        }
      });
      updateScene(data);
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
