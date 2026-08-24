# Hydrostatic Force Lab

An interactive CE2134 learning platform for hydrostatic forces on plane and curved surfaces. Its layout, Explore/Challenge modes, live diagrams, and AI-coach fallback follow the same classroom style as the companion `hydrostatic_pressure` platform.

## What students can explore

- Plane surfaces: vary inclination, top-edge depth, plate length, plate width, and fluid density.
- Live plane calculations: centroid depth, resultant force, centre of pressure, and pressure at the lower edge.
- Curved surfaces: vary quarter-circle radius, depth, gate width, density, and the loaded side.
- Live curved calculations: horizontal projection force, imaginary-fluid vertical force, component lines of action, resultant magnitude, and angle.
- Challenge mode: predict the resultant and receive staged feedback.
- AI Proxy: uses the OpenAI Responses API when configured and a built-in lecture-aware coach otherwise.

The default examples reproduce the lecture values:

- Plane example: a 2 m square vertical panel whose top is 3 m below the free surface gives a centroid depth of 4 m, a 156.96 kN resultant, and a centre of pressure 0.083 m below the centroid.
- Curved example: a 2 m radius, 1 m wide quarter-circle gate beginning 4 m below the free surface gives approximately 98.1 kN horizontally and 109.29 kN vertically.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`. The platform works without an API key. To enable OpenAI-backed coaching, copy `.env.example` to `.env` and set `OPENAI_API_KEY`.

## Checks

```bash
npm run check
```

This validates the server and browser JavaScript and runs numerical tests for the lecture examples.

## Deploy on Render

The repository includes `render.yaml` for a Render Blueprint deployment.

1. In Render, choose **New → Blueprint**.
2. Connect this GitHub repository.
3. Confirm the detected `hydrostatic-force-surfaces` web service.
4. Optionally enter an `OPENAI_API_KEY`; the rest of the site does not require secrets.
5. Deploy. Render supplies `PORT`, and the server exposes `/health` for health checks.

The free instance type can spin down when idle. Choose a paid Render plan if the classroom requires an always-warm service.

## Project structure

```text
public/
  index.html          Interface structure
  styles.css          Responsive visual system
  app.js              Interactions and canvas diagrams
  calculations.js     Shared hydrostatic equations
tests/
  calculations.test.js
server.js             Express server and AI-coach endpoint
render.yaml           Render Blueprint
```

