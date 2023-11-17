# kiota-gen
Kiota Gen is a wrapper around the Kiota CLI tool that is used to generated client SDKs
from OpenAPI specifications.

This package can be used, for example, in a standard node.js/npm project to generate
a client for a REST API.

## Usage

In your `package.json` file, you must add the `@kiota/kiota-gen` package
as a dev dependency, something like this:

```json
{
  "name": "kiota-gen-example",
  "version": "0.1.0",
  "devDependencies": {
    "@kiota/kiota-gen": "0.1.0"
  }
}
```

Once this is done, and `npm install` is run, you can use `kiota`` as a command in the
`scripts` section of your `package.json`.  For example:

```json
{
  "name": "kiota-gen-example",
  "version": "0.1.0",
  "scripts": {
    "kiota-help": "kiota --help",
    "kiota-generate": "kiota generate -l typescript -d openapi.yaml -c MyGeneratedClient -o ./client"
  }
}
```

See the [documentation for Kiota](https://learn.microsoft.com/en-us/openapi/kiota/using) for more 
information on usage of the Kiota CLI.

## Options

By default, this package will use the most recent version of Kiota, downloaded from the
Kiota GitHub repository (based on the most recent GitHub release of Kiota).  It will 
download and unpack that released binary to a temporary local location and execute the
CLI from there.

You can optionally customize the above behavior. This is done by setting ENV variables.
The following ENV variables are available:

| Variable Name       | Description                   | Default Value |
| ------------------- | ----------------------------- | ------------- |
| KIOTA_VERSION       | The version of Kiota to use.  | `latest`      |
| KIOTA_DOWNLOAD_URL  | Where to download Kiota from. | `https://github.com/microsoft/kiota/releases/download` |
| KIOTA_DOWNLOAD_DIR  | Where to download Kiota to.   | `./.kiota`    |
