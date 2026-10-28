# Capybara pond

A small, fully browser-rendered wetland with seven capybaras. Built with TypeScript, Three.js and Vite. The character, landscape, print shading, icons and optional ambient audio are generated locally; there are no remote asset or API calls.

## Run

Use Node.js 22.18 or newer.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite, normally http://127.0.0.1:5173/.

```sh
npm test
npm run build
npm run preview
```

## Play

Click any capybara to select it and open its actions: Pet, Feed, Hop, Lie down / Wake up, Roll in grass, and Visit pond / Back to bank. Feed offers greens that it walks over to eat. Look closer smoothly frames and follows it. The herd wanders and nibbles, pauses for nose-to-nose greetings, follows companions, and naps side by side. Capybaras occasionally take a dip on their own, then return to the bank. Three birds make staggered fly-throughs, two small birds perch on the bank, and three frogs hop around the water. Click a frog to make it hop. Press a capybara to lift it immediately, even before moving the pointer. Drag to carry it, then release to settle it onto the terrain or into the pond. A short click still opens its action menu. Direct actions interrupt autonomous plans.

| Control | Action |
| --- | --- |
| Press, drag and release a capybara | Lift immediately, carry and drop |
| Left-drag empty ground | Orbit the camera |
| Right-drag | Pan |
| Scroll | Zoom |
| Reset view or R | Restore the original framing |
| Arrow keys with the canvas focused | Pan |
| [ / ] | Select previous / next capybara |
| G, then arrows, then G | Pick up, carry and put down with the keyboard |
| Space | Hop |
| F | Feed |
| E | Pet |
| O | Roll in grass |
| C | Look closer / Step back |
| L | Lie down / Wake up |
| V | Visit pond / Back to bank |
| P | Pause / Resume |
| Enter with the canvas focused | Open the animal's actions |
| Escape | Dismiss actions and return to overview framing |

The world moves through an eight-minute day–night cycle automatically. After dusk, capybaras return from the water and settle beside one another on the sheltered bank. At dawn they wake with a small stretch and return to roaming. Direct actions take priority, and an interrupted animal can rejoin its friends later. Manually requested naps remain under your control.

The Landscape button opens an Automatic time toggle, Day / Dusk / Night presets, a continuous time-of-day slider, breeze strength, light shafts and rain. Gather for snacks calls the herd to a shared patch; Wake the frogs triggers their hops. Lighting uses inexpensive feathered transparent light slices, not a volumetric ray marcher.

Sound starts muted. Pause freezes the automatic clock, animal behavior and decorative animation while keeping the camera and manual lighting controls usable. Turning Automatic time off holds the current time; presets and the slider reposition the cycle without disabling it. Hidden tabs stop the render loop. Reduced-motion preferences suppress decorative movement and automatic camera easing. WebGL 2 is required.

## Implementation

- `src/simulation.ts`: deterministic behavior, navigation, hop and feeding state.
- `src/herd-behavior.ts`: paired greetings, following, shared naps, and autonomous pond scheduling.
- `src/night-routine.ts` and `src/night-navigation.ts`: bedtime slots, staggered arrivals, routes around sleeping companions and morning release.
- `src/capybara.ts`: procedural character, gait, expression and pose animation.
- `src/environment.ts`: rolling terrain, painterly ground shader, pond, instanced foliage and landing ripples.
- `src/terrain.ts`: shared height, shoreline and island constraints for rendering and movement.
- `src/bird.ts` and `src/bird-flight.ts`: bird geometry, wing animation and occasional flight schedule.
- `src/landscape-details.ts`: instanced pigment strokes, flower fields, ferns, log and mushrooms.
- `src/wildlife.ts`: interactive frogs and perched birds.
- `src/world-state.ts` and `src/atmosphere.ts`: time transitions, light shafts, rain and fireflies.
- `src/art.ts`: geometry and toon/print material helpers.
- `src/main.ts`: rendering, camera, input, audio and accessible UI integration.
- `src/style.css`: minimal upright typography and interface styling.
- `tests/`: behavior, social, group feeding and daylight-transition regression coverage.

Append `?stats` to the URL for a small frame-time and scene-complexity overlay. Read-only runtime measurements are also exposed on `#app` as `data-pond-state` for verification.

## Current scope

This is a desktop-first game with seven animals. Phone-specific refinement and saved state are future work.

## Deployment

The app is a static Vite build. Vercel builds it with `npm run build` and serves `dist/`; no environment variables are required to play. GitHub Actions runs the behavior tests and production build on pushes and pull requests.

Local planning records, review screenshots, environment files and unrelated documents are excluded from the repository and deployment.
