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
import { generators, elevations, detailLevels } from "./BlockyEarth.js";

const STORAGE_KEY = "blocky-earth";

const defaults = {
  blocks: 256,
  tiles: "Sentinel-2 cloudless",
  elevation: "AWS terrain",
  shape: Hexagon,
  crop: NoCrop,
  quantize: NormalHeight,
  verticalScale: 2,
  heightScale: "fit",
  projection: "corrected",
  handPlaced: false,
  spots: 6,
  flightHeight: 1200,
  banking: true,
  previewPath: false,
  palette: false,
  ui: true,
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

function buildGui(app, {
  onSnapshot,
  areaLabel,
  sourceLabel,
  map,
  onFly,
  onFlyUpdate,
  onResetView,
}) {
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
  searchRow.row.classList.add("gui-compact", "gui-search-row");
  searchRow.el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });

  const searchButton = document.createElement("button");
  searchButton.type = "button";
  searchButton.className = "gui-btn gui-btn-mini";
  searchButton.textContent = "Search";
  searchButton.addEventListener("click", runSearch);
  searchRow.row.append(searchButton);

  gui.addButtons("Go to", [
    { label: "My location", onClick: () => map.onLocation() },
    { label: "Random", onClick: () => map.randomLocation() },
  ]);
  gui.addMonitor("Area", areaLabel, {});
  const sourceRow = gui.addMonitor("Source", sourceLabel, {
    title: "Tile providers to credit",
  });
  sourceRow.row.classList.add("gui-source-row");

  gui.addSeparator();

  gui.addSelect("Detail", params.blocks, detailLevels, {
    title: "Blocks across the model",
    onChange: refetch,
  });
  gui.addSelect("Tiles", params.tiles, Object.keys(generators), {
    onChange: refetch,
  });

  gui.addSelect("Elevation", params.elevation, Object.keys(elevations), {
    title: "AWS needs no key and reaches zoom 15; Nextzen is key-restricted",
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

  gui.addSegmented(
    "Relief",
    params.heightScale,
    [
      ["fit", "Fit"],
      ["true", "True scale"],
    ],
    {
      title:
        "Fit keeps the tile a similar height everywhere; True scale keeps real proportions",
      onChange: reshape,
    }
  );

  gui.addSlider("Exaggeration", params.verticalScale, 0.5, 50, 0.1, {
    curve: "log",
    title: "Multiplies the relief; 1x is true scale when Relief is True scale",
    onChange: reshape,
  });

  gui.addCheckbox("Hand placed", params.handPlaced, {
    title: "Nudge each block off the lattice, as if stacked by hand",
    onChange: reshape,
  });
  gui.addCheckbox("Brick palette", params.palette, { onChange: reshape });

  gui.addSeparator();

  const flightOptions = () => ({
    spots: params.spots(),
    height: params.flightHeight(),
    banking: params.banking(),
    preview: params.previewPath(),
  });
  const liveFlight = () => onFlyUpdate(flightOptions());

  gui.addSlider("Spots", params.spots, 3, 12, 1, {
    title: "How many high points the flight visits",
    onChange: liveFlight,
  });
  gui.addSlider("Altitude", params.flightHeight, 50, 5000, 10, {
    curve: "log",
    title: "Metres above the terrain",
    onChange: liveFlight,
  });
  gui.addCheckbox("Banking", params.banking, {
    title: "Roll into the turns",
    onChange: liveFlight,
  });
  gui.addCheckbox("Preview path", params.previewPath, {
    title: "Draw the flight path over the model",
    onChange: () => {
      liveFlight();
      syncQuery(params);
    },
  });
  gui.addButtons("Camera", [
    { label: "Fly over", onClick: () => onFly(flightOptions()) },
    { label: "Overview", onClick: onResetView },
  ]);

  gui.addText(
    `<p>Double click the landscape to stand on that spot. Then <b>WASD</b> or the
     arrow keys to walk, <b>shift</b> to run, mouse to look, <b>Esc</b> to leave.
     <b>Tab</b> hides this panel.</p>`
  );

  gui.addSeparator();

  gui.addButtons("Export", [
    { label: "Download", onClick: () => app.bake() },
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

  return { gui, flightOptions };
}

export { buildGui, createGuiParams, syncQuery };
