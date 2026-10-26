# shadowbook
A character builder and other utilities for Shadowrun Anarchy 2.0

## Running locally

```
npm install
npm run dev
```

Open http://localhost:5173/.

## Deploying

A public Docker image is published to
`ghcr.io/tmilktoast/shadowbook` on every push to `main`. To run it on
TrueNAS SCALE, see `deploy/truenas-custom-app.md` (Custom App wizard)
or `deploy/truenas-compose.yaml` (Install via YAML). Anywhere else,
just run the image and publish container port 8080.
