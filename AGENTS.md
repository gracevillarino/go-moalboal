## Development

The one canonical local URL is `http://localhost:4331/`.

Before starting or restarting the development server, stop the currently
managed background server first:

```
astro dev stop
```

Then start it again on the canonical port in background mode:

```
astro dev --host localhost --port 4331 --background
```

Never allow Astro to select another port. The project configuration uses
`strictPort`, so if 4331 is occupied, inspect or stop that existing server
instead of starting a second instance. Manage the background server with
`astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
