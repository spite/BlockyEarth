import { GUI, createParams } from "guspira";
import {
  Box,
  RoundedBox,
  PlasticBrick,
  Hexagon,
  Capsule,
  NoCrop,
  CircleCrop,
  HexagonCrop,
  NormalHeight,
  BlockHeight,
  HalfBlockHeight,
  QuarterBlockHeight,
} from "./HeightMap.js";
import { generators, resolutions, blockSizes } from "./BlockyEarth.js";

const STORAGE_KEY = "blocky-earth";

const defaults = {
  mapSize: "1024x1024",
  blockSize: 2,
  tiles: "Sentinel-2 cloudless",
  shape: Hexagon,
  crop: NoCrop,
  quantize: NormalHeight,
  verticalScale: 150,
  normalize: true,
  align: true,
  palette: false,
};

function createGuiParams() {
  return createParams(defaults, {
    storageKey: STORAGE_KEY,
    url: true,
  });
}

function syncQuery(params) {
  const query = params.$toQuery();
  const url = `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
  history.replaceState(null, "", url);
}

function buildGui(app, { onSnapshot }) {
  const params = app.params;
  const gui = new GUI("Blocky Earth", document.querySelector("#tools"), {
    storageKey: `${STORAGE_KEY}-gui`,
  });

  const reshape = () => {
    app.reshape();
    syncQuery(params);
  };
  const refetch = () => {
    app.refetch();
    syncQuery(params);
  };

  gui.addSelect("Map size", params.mapSize, resolutions, { onChange: refetch });
  gui.addSelect("Block size", params.blockSize, blockSizes, {
    onChange: refetch,
  });
  gui.addSelect("Tiles", params.tiles, Object.keys(generators), {
    onChange: refetch,
  });

  gui.addSegmented(
    "Shape",
    params.shape,
    [
      [Box, "Box"],
      [RoundedBox, "Rounded"],
      [PlasticBrick, "Brick"],
      [Hexagon, "Hexagon"],
      [Capsule, "Capsule"],
    ],
    { onChange: reshape }
  );

  gui.addSegmented(
    "Crop",
    params.crop,
    [
      [NoCrop, "None"],
      [CircleCrop, "Circle"],
      [HexagonCrop, "Hexagon"],
    ],
    { onChange: reshape }
  );

  gui.addSegmented(
    "Height",
    params.quantize,
    [
      [NormalHeight, "Natural"],
      [BlockHeight, "Block"],
      [HalfBlockHeight, "Half"],
      [QuarterBlockHeight, "Quarter"],
    ],
    { onChange: reshape }
  );

  gui.addSlider("Vertical scale", params.verticalScale, 1, 1000, 1, {
    curve: "log",
    onChange: reshape,
  });

  gui.addCheckbox("Normalize height", params.normalize, {
    title: "Stretch the relief in frame over the full height range",
    onChange: reshape,
  });
  gui.addCheckbox("Align", params.align, { onChange: reshape });
  gui.addCheckbox("Brick palette", params.palette, { onChange: reshape });

  gui.addButtons("Export", [
    { label: "Download model", onClick: () => app.bake() },
    { label: "Snapshot", onClick: onSnapshot },
  ]);

  return gui;
}

export { buildGui, createGuiParams, syncQuery };
