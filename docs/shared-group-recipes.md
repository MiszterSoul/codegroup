# Shared-group JSON recipes

These payloads use CodeGroup's shareable export format. Copy one, adjust its
relative paths, then run **File Groups: Import Shared Group** and choose the
clipboard source. Relative paths are resolved from the open workspace folder.

## Frontend and backend split

```json
{
  "version": 1,
  "source": "codegroup",
  "exportedAt": "2026-08-10T00:00:00.000Z",
  "rootGroupId": "app",
  "groups": [
    {
      "id": "app",
      "name": "Application",
      "icon": "folder-library",
      "color": "charts.blue",
      "files": []
    },
    {
      "id": "frontend",
      "name": "Frontend",
      "icon": "browser",
      "color": "charts.blue",
      "parentId": "app",
      "files": [
        { "path": "src/components/App.tsx", "name": "App.tsx" },
        { "path": "src/styles/app.css", "name": "app.css" }
      ]
    },
    {
      "id": "backend",
      "name": "Backend",
      "icon": "server",
      "color": "charts.green",
      "parentId": "app",
      "files": [
        { "path": "src/api/server.ts", "name": "server.ts" },
        { "path": "src/services/users.ts", "name": "users.ts" }
      ]
    }
  ]
}
```

## Bugfix working set

```json
{
  "version": 1,
  "source": "codegroup",
  "exportedAt": "2026-08-10T00:00:00.000Z",
  "rootGroupId": "bugfix-login",
  "groups": [
    {
      "id": "bugfix-login",
      "name": "Bugfix: login redirect",
      "icon": "bug",
      "color": "charts.red",
      "shortDescription": "Reproduction, fix, and regression test",
      "files": [
        { "path": "src/auth/login.ts", "name": "login.ts" },
        { "path": "src/auth/redirect.ts", "name": "redirect.ts" },
        { "path": "tests/login.test.ts", "name": "login.test.ts" }
      ]
    }
  ]
}
```

## Pull-request review

```json
{
  "version": 1,
  "source": "codegroup",
  "exportedAt": "2026-08-10T00:00:00.000Z",
  "rootGroupId": "pr-review",
  "groups": [
    {
      "id": "pr-review",
      "name": "PR review",
      "icon": "git-pull-request",
      "color": "charts.purple",
      "files": [
        { "path": "src/orders/controller.ts", "name": "controller.ts" },
        { "path": "src/orders/service.ts", "name": "service.ts" },
        { "path": "tests/orders.test.ts", "name": "orders.test.ts" }
      ]
    }
  ]
}
```

## Documentation and research

```json
{
  "version": 1,
  "source": "codegroup",
  "exportedAt": "2026-08-10T00:00:00.000Z",
  "rootGroupId": "research",
  "groups": [
    {
      "id": "research",
      "name": "Documentation research",
      "icon": "book",
      "color": "charts.yellow",
      "files": [
        { "path": "README.md", "name": "README.md" },
        { "path": "docs/architecture.md", "name": "architecture.md" },
        { "path": "docs/decisions.md", "name": "decisions.md" }
      ]
    }
  ]
}
```

CodeGroup generates new internal IDs during import, so recipe IDs only need to
be unique within each payload.
