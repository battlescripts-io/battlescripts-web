# What Is This?

This is a stand-alone container for display of Game state aka rendering of a Game.

The only way to interface with this display is postMessage calls, which you can use to update the html, js, and css, and pass state to render.

This is stand-alone to ensure that there are no dependencies or tight coupling. At some point in the future when games are not trusted, this will be served up from a different hostname (canvas.battlescripts.io?) which will prevent XSS and other potential vulnerabilities. Having it contained in an iframe also avoids bleeding of styles, etc, and allows the game rendering to be unrestricted. 
