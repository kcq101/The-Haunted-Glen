# The Haunted Glen 🎃

A cozy Halloween game set in Kimberton Glen (Phoenixville, PA), made for Carter (7) and Jack (4).

Walk the neighborhood at golden hour and into the night, trick-or-treat at glowing doors, follow the lantern trail through the woods to the **Hares Hill Halloween Emporium** to mix and match costumes, and brave the (friendly) haunted house at home.

## Playing

Open the GitHub Pages link on the tablet, then **Share → Add to Home Screen** for a full-screen app with its own icon.

| Touch | What it does |
| --- | --- |
| Drag on the left half | Walk (joystick appears under your thumb) |
| Drag on the right half | Turn the camera / spin the kid in the shop |
| Orange button | Knock, enter, go shopping, BOO! |
| Purple button | Jump |
| Kid button (top right) | Switch between Carter and Jack (the other brother follows along) |
| 🌙 / ☀️ | Jump to night or back to golden hour |

Keyboard also works: WASD/arrows to walk, Q/E to turn, Space to jump, Enter to use the orange button.

### The loop
- **Trick-or-treat:** every glowing door gives 2–4 candy once per night. A full golden hour → night → golden hour cycle takes 10 minutes; each new night the doors glow again.
- **Hares Hill Halloween Emporium:** past the cul-de-sac, follow the lanterns over the footbridge. Hazel the hare sells hats, faces, outfits and props (pirate, firefighter, monsters, space and superhero). Try anything on for free; buy with candy.
- **The haunted house:** the front door of 1018 opens into a 2D, Stardew-style house that is much bigger inside than out (library, great hall, portrait hall, spooky kitchen, Carter's and Jack's rooms, the toy room…). Ghosts hide in closets and the piano and pop out. Tap BOO! to scare them back for candy. Find the 8 golden candy corns for prizes: Skull Mask (3), Pumpkin Head (6), Ghost Sheet (8).

Progress (candy, costumes, candy corns) saves on the device.

## Project layout

```
index.html            page + UI
css/style.css         UI styling
src/config.js         map layout (roads, houses, woods, trail, store) and the boys' looks
src/terrain.js        ground shape and painted ground (roads, sidewalks, creek, trail)
src/houses.js         house builder (home is modeled on the street view)
src/decor.js          Halloween decorations, street lamps, trail lanterns, haunted extras
src/nature.js         fall trees and falling leaves
src/sky.js            golden hour / night cycle
src/store.js          Hares Hill Emporium (outside, inside, and Hazel)
src/costumes.js       costume catalog (add new items here)
src/character.js      the kids' 3D models + costume anchors
src/haunted2d.js      the 2D haunted house
src/audio.js          sound effects (synthesized, no files needed)
lib/                  three.js r170 (bundled so it works offline)
assets/               icons, and future models / sprites / music
```

Everything on the map is placed using pixel positions from the aerial screenshot, so moving a house is just editing its `x, y` in `src/config.js`.

## Coming next / how to plug in assets

- **Meshy models:** drop rigged models at `assets/models/carter.glb` and `assets/models/jack.glb`. The loader and costume anchor hookup is the next step.
- **GPT sprites for the haunted house:** pixel tiles at 16 px (32 px also fine). They'll replace the draw functions in `src/haunted2d.js`.
- **Theme music:** put an mp3 at `assets/music/theme.mp3`, and it plays automatically on a loop.
- **Real elevation:** the hills are hand-shaped approximations right now (the house sits up on a bank above the street, the east woods drop to a creek). USGS LiDAR elevations can replace them once the elevation service is reachable from the build environment.

## Running locally

Any static server works, for example `python3 -m http.server` and then open http://localhost:8000.
