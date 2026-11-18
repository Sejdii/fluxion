# The core runs server-side and the frontend is an HTTP client

The core runs only in the CLI process. `fluxion` starts a local HTTP server, an incoming adapter that calls the core's use cases, and the browser frontend calls that API. The frontend depends on the core only through type-only shared definitions (metric ids, periods, statistics, response shapes). We rejected running the core in the browser because the output ports need `gh` and the file system, which a browser cannot reach. The frontend is tested with Playwright against the real server wired to in-memory ports.
