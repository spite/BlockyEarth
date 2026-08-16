import { GUI, createParams, signal } from "guspira";
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
import { generators, detailLevels } from "./BlockyEarth.js";

const STORAGE_KEY = "blocky-earth";

const defaults = {
  blocks: 256,
  tiles: "Sentinel-2 cloudless",
  shape: Hexagon,
  crop: NoCrop,
  quantize: NormalHeight,
  verticalScale: 2,
  projection: "corrected",
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

function buildGui(app, { onSnapshot, areaLabel, map }) {
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

  gui.addText(
    `<p>A world made of blocks. Pan and zoom the map to frame an area &mdash;
     whatever it shows is what gets built. Drag to orbit, scroll to zoom.</p>`
  );

  const mapRow = gui.addElement(map);
  mapRow.row.classList.add("gui-map-row");

  const query = signal("");
  const runSearch = async () => {
    const term = query().trim();
    if (term) await map.search(term);
  };
  const searchRow = gui.addTextInput("Search", query, {
    placeholder: "city or address",
  });
  searchRow.el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });
  gui.addButtons("Go to", [
    { label: "Search", onClick: runSearch },
    { label: "My location", onClick: () => map.onLocation() },
    { label: "Random", onClick: () => map.randomLocation() },
  ]);
  gui.addMonitor("Area", areaLabel, {});

  gui.addSeparator();

  gui.addSelect("Detail", params.blocks, detailLevels, {
    title: "Blocks across the model",
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

  gui.addSegmented(
    "Projection",
    params.projection,
    [
      ["mercator", "Mercator"],
      ["corrected", "Corrected"],
    ],
    {
      title: "Corrected resamples the tiles to true ground positions",
      onChange: refetch,
    }
  );

  gui.addSlider("Exaggeration", params.verticalScale, 0.5, 50, 0.1, {
    curve: "log",
    title: "1x is true scale: relief in the same proportion as the ground",
    onChange: reshape,
  });

  gui.addCheckbox("Align", params.align, {
    title: "Off nudges each block off the lattice, for a hand-stacked look",
    onChange: reshape,
  });
  gui.addCheckbox("Brick palette", params.palette, { onChange: reshape });

  gui.addSeparator();

  gui.addButtons("Export", [
    { label: "Download model", onClick: () => app.bake() },
    { label: "Snapshot", onClick: onSnapshot },
    {
      label: "Share",
      onClick: () =>
        window.open(
          `https://twitter.com/intent/tweet?url=${encodeURIComponent(
            location.href
          )}`,
          "_blank"
        ),
    },
  ]);

  gui.addText(
    `<p>Made with <a target="_blank" href="https://threejs.org/">three.js</a>.
     Code on <a target="_blank" href="https://github.com/spite/BlockyEarth/">GitHub</a>.</p>`
  );

  return gui;
}

export { buildGui, createGuiParams, syncQuery };
