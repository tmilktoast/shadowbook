# Installing on TrueNAS SCALE: Custom App

Shadowbook is a static site served by nginx — no database, no
persistent storage, no environment variables. The image publishes to
GitHub Container Registry on every push to `main`
(`.github/workflows/docker.yml`) and is public, so TrueNAS can pull it
with no registry login.

Field names below match the TrueNAS SCALE 25.10 "Install Custom App"
wizard (**Apps → Discover Apps → Custom App**); labels have moved
around a bit release to release, but the values themselves won't
change. If your version doesn't have this wizard, use **Install via
YAML** instead — `deploy/truenas-compose.yaml` is a ready-to-paste
compose snippet that does the same thing.

## 1. Application Name

- **Application Name**: `shadowbook` (or anything you like — can't be
  changed later without reinstalling).

## 2. Image Configuration

- **Repository**: `ghcr.io/tmilktoast/shadowbook`
- **Tag**: `latest`
- **Pull Policy**: "Always pull image even if present on host" — the
  default ("only if not present") means TrueNAS won't notice a new
  `latest` build on its own; see "Updating" below either way.

## 3. Container Configuration

Leave everything here at its default (no entrypoint/command override,
no environment variables needed). **Restart Policy**: "Unless Stopped"
is a reasonable default.

## 4. Security Context Configuration

Leave **Custom User** unchecked. The image already runs as a non-root
user baked in by `nginxinc/nginx-unprivileged` — forcing TrueNAS's
default UID/GID (568) here isn't necessary and risks a permissions
mismatch with that image's own user setup.

## 5. Network Configuration

- **Ports** → Add one:
  - **Container Port**: `8080`
  - **Host Port**: any free port, e.g. `30080`
  - **Protocol**: TCP

## 6. Portal Configuration (optional)

Add one if you want a clickable link to the app from the TrueNAS Apps
page:
- **Name**: Shadowbook
- **Protocol**: HTTP
- **Use Node IP**: checked (default)
- **Port**: the same Host Port from step 5 (e.g. `30080`)
- **Path**: `/`

## 7. Storage Configuration

Skip — nothing to add. The app has no persistent data yet (a
server-side database for shared/cross-device Character Database data
is planned — see `CLAUDE.md`'s "Deployment" section — but doesn't
exist yet).

## 8. Resources Configuration

Optional. This is a small static site; default/no limits are fine, or
set a conservative cap (e.g. 0.5 CPU / 256 MB) if you want one.

## Updating

TrueNAS doesn't watch GHCR for new builds on its own. After a new push
to `main` lands a new `latest` image on GHCR, go to the app →
**Edit** → re-save (with Pull Policy set to "Always pull," this
re-pulls `latest`), or use the app's **Upgrade**/redeploy action if
your version has one. Pinning to a specific version tag
(`docker/metadata-action` also tags `vX.Y.Z` on git tags, and a short
commit SHA on every build) is the more deliberate way to control
exactly what's running, at the cost of updating the Tag field by hand
each time.
