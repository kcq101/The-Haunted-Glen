# The Haunted Glen 🎃

A cozy Halloween game set in Kimberton Glen (Phoenixville, PA), made for Carter (7) and Jack (4).

Walk the neighborhood at golden hour and into the night, trick-or-treat at glowing doors, follow the lantern trail through the woods to the **Hares Hill Halloween Emporium** to mix and match costumes, and brave the (friendly) haunted house at home.

## Playing

Open the GitHub Pages link on the tablet, then **Share → Add to Home Screen** for a full-screen app with its own icon.

| Touch | What it does |
| --- | --- |
| Drag on the left half | Walk (joystick appears under your thumb) |
| Drag on the right half | Turn the camera |
| Orange button | Knock, enter, go shopping, BOO! |
| Purple button ⤴ | Jump (works while running, too) |
| Blue button ⚡ | Hold for a speed boost |
| Pink button 🌀 | 360 power spin jump (a scooter 360 when riding) |
| Green button 🛴 | Hop on (or off) the scooters: Carter's blue, Jack's red. Push the stick to kick off, let go to coast, pull back to brake |
| Kid button (top right) | Switch between Carter and Jack (the other brother follows along) |
| 🌅 ☀️ 🌇 🌙 | Skip ahead: morning → noon → golden hour → night |

Keyboard also works: WASD/arrows to walk, Q/E to turn, Space to jump, Shift to boost, R to spin, T for the scooter, Enter to use the orange button.

### The loop
- **Trick-or-treat:** every glowing door gives 2–4 candy once per night. A full day (morning, noon, golden hour, night) takes 12 minutes; each time night falls the doors glow again.
- **Hares Hill Halloween Emporium:** past the cul-de-sac, follow the lanterns over the footbridge. Hazel the hare runs the front desk; hats, outfits, faces and props sit on four shelf bays (pirate, firefighter, monsters, space and superhero). Tap a shelf to walk up to it, tap a piece to try it on for free, tap it again to take it off; buy with candy.
- **The haunted house:** the front door of 1018 opens into a 2D, Stardew-style house that is much bigger inside than out (library, great hall, portrait hall, spooky kitchen, Carter's and Jack's rooms, the toy room…). Ghosts hide in closets and the piano and pop out. Tap BOO! to scare them back for candy. Find the 8 golden candy corns for prizes: Skull Mask (3), Pumpkin Head (6), Ghost Sheet (8).

Progress (candy, costumes, candy corns) saves on the device.

## Project layout

```
index.html            page + UI
css/style.css         UI styling
data/elevation.json   real ground heights (from tools/build_elevation.py)
src/config.js         map layout (roads, houses, woods, trail, store) and the boys' looks
src/terrain.js        ground shape and painted ground (roads, sidewalks, creek, trail)
src/houses.js         house builder (home is modeled on the street view)
src/decor.js          Halloween decorations, street lamps, trail lanterns, haunted extras
src/props.js          jack-o'-lanterns, inflatable ghost, black cat, skeleton
src/nature.js         fall trees and falling leaves
src/sky.js            golden hour / night cycle
src/backdrop.js       the world beyond: farm fields, barns and hazy hills on the horizon
src/store.js          Hares Hill Emporium outside, plus Hazel's lines
src/shopinside.js     Inside the Emporium: shelf bays, front desk, tap targets, price tags
src/hazel.js          Hazel the hare shopkeeper (model + animation)
src/costumes.js       costume catalog (add new items here)
src/costumefit.js     per-boy costume fit + drop-in GLB models / outfit prints
src/fittuner.js       on-phone fit tuner (open the game with ?fit=1)
data/costume_fit.json     fit tweaks for each piece on Carter and Jack
data/costume_models.json  GPT/Meshy models and outfit prints that replace built-in pieces
src/character.js      the kids + costume anchors (stand-in body until the model loads)
src/meshykid.js       loads the Meshy boys: animation, bone anchors, outfit recolor, hands on the handlebar
src/scooter.js        Meshy kick scooters + wheels (axle and grip spots for each model)
src/haunted2d.js      the 2D haunted house
src/kidsprites.js     Carter and Jack's pixel sprites (atlas, outfit recolor, costume spots)
src/audio.js          music (crossfades by area) + synthesized sound effects and ambience
assets/music/         the songs that rotate through the game
lib/                  three.js r170 (bundled so it works offline)
assets/               icons, and future models / sprites / music
```

Everything on the map is placed using pixel positions from the aerial screenshot, so moving a house is just editing its `x, y` in `src/config.js`.

## Coming next / how to plug in assets

- **Costume models (GPT → Meshy):** put `<item id>.glb` in `assets/costumes/` and add a line to `data/costume_models.json` (fields: `glb`, `size`, `align`, `offset`, `rot`, `anchor`, `hideHead`, `keepParts`). Outfit prints go under `textures` (`shirt`, `pants`, `sleeves`, `shoes`). Anything missing or broken falls back to the built-in piece. Then open the game with `?fit=1`, slide each piece into place in Hares Hill, tap **Copy all** and paste into `data/costume_fit.json`.

- **Meshy models:** Carter and Jack are the rigged Meshy models in `assets/models/` (`src/meshykid.js`). They play idle, walk and run, costume pieces ride on the head, hand and spine bones, and outfits recolor the shirt, sleeves, pants and shoes. To swap in a new model, export from Meshy with animations as `.glb`, shrink the textures to 1024 px, and replace the file. The simple stand-in kid shows while a model downloads.
- **Kid sprites in the haunted house:** the GPT sprite sheets live in `tools/sprite_src/`. Run `python3 tools/build_sprites.py` to cut them out, snap them to a real pixel grid (Carter 32 px, Jack 27 px tall), and write `assets/sprites/`. Costumes are drawn on top, and outfits recolor the shirt, pants and shoes. Open `tools/sprite_preview.html` on a local server to see every costume in every direction.
- **Room tiles:** GPT pixel tiles at 16 px could replace the draw functions in `src/haunted2d.js` the same way.
- **Music:** the songs in `assets/music/` take turns on a loop everywhere in the game (street, Emporium and haunted house). To give the Emporium or haunted house its own song, add the file to `TRACKS` in `src/audio.js` and name it in `AREA_SONG`; to add a song to the rotation, add it to `PLAYLIST`.

## Elevation

The ground uses real heights from the USGS 3DEP 1 m LiDAR (sampled every 8 m around the cul-de-sac and stored in `tools/lidar_grid_8m.json`). `python3 tools/build_elevation.py` turns that into `data/elevation.json`. The LiDAR was flown before the houses went in, so the game adds back the graded bank the north-side houses sit on, and the creek and the store's trail follow the real valley in the east woods. Slopes are scaled to 90% to stay gentle.

## Running locally

Any static server works, for example `python3 -m http.server` and then open http://localhost:8000.
