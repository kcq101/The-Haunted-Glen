// ---------------------------------------------------------------------------
// The Haunted Glen — world layout and character settings.
//
// Everything on the map is placed in "aerial pixels": the x/y position on the
// Google Maps screenshot of Kimberton Glen (752 x 1416 px, north is up).
// px() converts those to world units (1 unit ≈ 1 meter, slightly compressed
// so the neighborhood is quicker to walk across on a tablet).
// ---------------------------------------------------------------------------

export const MAP_SCALE = 0.32;
export const MAP_ORIGIN = { x: 420, y: 760 };

export function px(x, y) {
  return { x: (x - MAP_ORIGIN.x) * MAP_SCALE, z: (y - MAP_ORIGIN.y) * MAP_SCALE };
}

// World bounds the players can walk inside (aerial pixels).
export const BOUNDS = { minX: 20, maxX: 795, minY: 392, maxY: 1285 };

// Day/night: one full morning -> noon -> golden hour -> night loop, in seconds.
export const DAY_CYCLE_SECONDS = 720;

// --- Characters -----------------------------------------------------------
// Tweak these to make the boys look like themselves until the Meshy models
// arrive. Drop rigged models at assets/models/carter.glb / jack.glb later.
export const CHARACTERS = {
  carter: {
    name: 'Carter',
    age: 7,
    height: 1.3,
    skin: '#f2c7a5',
    hair: '#6b4426',
    hairStyle: 'short',
    eyes: '#4a3424',
    shirt: '#e8742c',
    pants: '#3d5a80',
    shoes: '#2b2b2b',
    speed: 5.6,
  },
  jack: {
    name: 'Jack',
    age: 4,
    height: 1.06,
    skin: '#f4ccad',
    hair: '#9a6a3c',
    hairStyle: 'shaggy',
    eyes: '#4a3424',
    shirt: '#4f9d4a',
    pants: '#4a4e69',
    shoes: '#8a2b2b',
    speed: 5.6,
  },
};

// --- Roads (center lines in aerial pixels, width in world units) -----------
export const ROADS = [
  {
    name: 'Iron Works Rd',
    width: 7.2,
    sidewalks: true,
    pts: [[665, 522], [560, 523], [455, 524], [300, 525], [228, 526], [210, 532], [202, 548], [200, 575],
      [200, 760], [201, 1015], [202, 1180], [203, 1335]],
  },
  {
    name: 'Brinell St',
    width: 6.8,
    sidewalks: true,
    pts: [[455, 524], [453, 600], [451, 800], [450, 955], [444, 985], [428, 1005], [405, 1013], [300, 1015], [201, 1015]],
  },
  {
    name: 'Crossover Blvd',
    width: 9,
    sidewalks: false,
    pts: [[-60, 1300], [120, 1312], [300, 1338], [420, 1342], [500, 1322], [580, 1262], [700, 1195], [820, 1140]],
  },
  {
    name: 'Snyder Ave',
    width: 6.5,
    sidewalks: false,
    pts: [[-60, 362], [150, 370], [400, 372], [600, 345], [760, 300], [820, 285]],
  },
];

export const CUL_DE_SAC = { x: 665, y: 522, r: 40, island: 13 };

// Woods behind the neighborhood (polygons in aerial pixels)
export const WOODS = [
  // East woods — home of the trail to Hares Hill
  [[565, 625], [640, 600], [705, 565], [760, 540], [830, 520], [830, 1240], [620, 1240], [520, 1290], [470, 1260],
    [468, 990], [530, 880], [560, 790], [552, 700]],
  // South woods between Brinell and Crossover
  [[330, 1035], [462, 1020], [470, 1250], [420, 1305], [335, 1300], [322, 1200]],
  // West tree line
  [[-80, 395], [72, 400], [78, 600], [72, 900], [60, 1290], [-80, 1290]],
  // North edge beyond Snyder Ave
  [[-80, 250], [830, 200], [830, 270], [600, 330], [400, 352], [150, 350], [-80, 342]],
];

// Creek following the real valley in the east woods (from the LiDAR); the
// trail crosses it on a footbridge.
export const CREEK = [[805, 575], [763, 605], [738, 670], [722, 730], [710, 800], [703, 870], [701, 950], [688, 1012], [668, 1075], [662, 1180], [645, 1262]];

// Trail from the cul-de-sac to the Hares Hill Halloween Emporium
export const TRAIL = [[714, 556], [708, 615], [694, 690], [682, 770], [684, 840], [700, 880], [720, 900], [733, 912]];
export const STORE = { x: 752, y: 932, facing: -Math.PI * 0.75 }; // up on the east bank, door faces the trail

// --- Houses ----------------------------------------------------------------
// facing: direction the front door faces. 'S' = toward the bottom of the map.
export const HOME_ID = 'h1018';
export const HOUSES = [
  // North row (backs onto Snyder Ave), front doors face the street to the south.
  // Garages on the right (seen from the street), except the corner house and
  // the last two on the cul-de-sac, which have them on the left.
  // (garage: 1 = right side seen from the street, -1 = left side)
  // Corner house next door: angled toward the bend in the road, white with a
  // dark roof and a stone lower story (from the 1015 Iron Works street view)
  { id: 'h1022', x: 146, y: 474, facing: 'SE', garage: -1,
    style: { siding: '#f3f2ee', roof: '#3a3e43', door: '#24282b', stone: '#a8937a', stoneBand: true, frontGable: true, porch: true, chimney: false, shutters: false, W: 12.4, D: 9.6, H: 6.2 } },
  { id: HOME_ID, x: 226, y: 462, facing: 'S', home: true },
  { id: 'h1014', x: 307, y: 460, facing: 'S', garage: 1 },
  { id: 'h1010', x: 390, y: 457, facing: 'S', garage: 1 },
  { id: 'h1006', x: 466, y: 455, facing: 'S', garage: 1 },
  { id: 'h1002', x: 556, y: 455, facing: 'S', garage: 1 },
  { id: 'h1000', x: 650, y: 440, facing: 'S', garage: -1 },
  { id: 'h0998', x: 733, y: 440, facing: 'SW', garage: -1 },
  // Cul-de-sac, south side (between Brinell and the cul-de-sac): garages on
  // the left seen from the street
  { id: 'h1001', x: 508, y: 592, facing: 'N', garage: -1 },
  { id: 'h1003', x: 595, y: 590, facing: 'N', garage: -1 },
  // East side of Brinell
  { id: 'b101', x: 512, y: 686, facing: 'W' },
  { id: 'b103', x: 515, y: 775, facing: 'W' },
  // Inner block, facing Iron Works (west)
  { id: 'h1011', x: 268, y: 598, facing: 'W' },
  { id: 'h1013', x: 268, y: 688, facing: 'W' },
  { id: 'h1015', x: 268, y: 775, facing: 'W' },
  { id: 'h1017', x: 276, y: 860, facing: 'W' },
  { id: 'h1019', x: 272, y: 940, facing: 'W' },
  // Inner block, facing Brinell (east). The ground falls away behind these, so
  // they have walkout basements with sliding doors and a raised deck out back.
  // Corner of Brinell and Iron Works: faces Brinell, garage on the Iron Works
  // side (doors on the side) with the driveway out to Iron Works
  { id: 'b100', x: 382, y: 602, facing: 'E', garage: 1, sideLoad: true, street: 'Iron Works Rd', walkout: true },
  { id: 'b102', x: 384, y: 682, facing: 'E', walkout: true },
  { id: 'b104', x: 386, y: 770, facing: 'E', walkout: true },
  { id: 'b106', x: 384, y: 852, facing: 'E', walkout: true },
  { id: 'b108', x: 388, y: 930, facing: 'E', walkout: true },
  // West side of Iron Works, facing east (garages on the right, like the real ones).
  // The north ones sit on ground that falls away to the west, so they get
  // walkout basements like the Brinell houses.
  { id: 'h1020', x: 138, y: 592, facing: 'E', garage: 1, walkout: true },
  { id: 'h1024', x: 138, y: 672, facing: 'E', garage: 1, walkout: true },
  { id: 'h1026', x: 140, y: 752, facing: 'E', garage: 1, walkout: true },
  { id: 'h1028', x: 138, y: 840, facing: 'E', garage: 1 },
  { id: 'h1030', x: 142, y: 918, facing: 'E', garage: 1 },
  { id: 'h1032', x: 146, y: 998, facing: 'E', garage: 1 },
  { id: 'h1034', x: 150, y: 1080, facing: 'E', garage: 1 },
  { id: 'h1036', x: 155, y: 1162, facing: 'E', garage: 1 },
  // South end, east of Iron Works
  { id: 'h1021', x: 284, y: 1078, facing: 'W' },
  { id: 'h1023', x: 288, y: 1162, facing: 'W' },
];

export const FACING_ANGLE = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2, SW: -Math.PI / 4, SE: Math.PI / 4 };
