# battlescripts-web

## Installation

A local https server is required.

```
npm install -g serve
```

For Auth0 authentication to work, you must configure a local DNS mapping. Edit your hosts file:

```
127.0.0.1	local.battlescripts.io
```

Start the server

```
.\server.bat
```

Navigate to https://local.battlescripts.io/index.html

Since the local certs are self-signed, you will need to create an exception in your browser to allow SSL to local. This is only for development.

Pages won't load locally unless you specify index.html at the end of url's not just /. I don't know how to make the serve module have a default document.

